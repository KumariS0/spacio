-- ════════════════════════════════════════════════════════════════════════════
-- SPACIO · 0002 · Functions, triggers and the reservation state machine
--
-- Every function that touches reservations is SECURITY DEFINER with an empty
-- search_path, so callers can't redirect object lookups. Business errors are
-- raised as SQLSTATE P0001 with a stable machine-readable message
-- (e.g. 'SEAT_TAKEN') that the app maps to friendly copy.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Generic helpers ────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger app_settings_touch before update on public.app_settings for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger buildings_touch before update on public.buildings for each row execute function public.touch_updated_at();
create trigger facilities_touch before update on public.facilities for each row execute function public.touch_updated_at();
create trigger facility_seats_touch before update on public.facility_seats for each row execute function public.touch_updated_at();
create trigger reservations_touch before update on public.reservations for each row execute function public.touch_updated_at();

create or replace function public.campus_tz()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select campus_tz from public.app_settings where id), 'Asia/Kolkata');
$$;

-- Opaque 43-character URL-safe token built from two random UUIDs (~244 random bits).
create or replace function public.generate_qr_token()
returns text language sql volatile set search_path = '' as $$
  select translate(
    rtrim(encode(decode(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex'), 'base64'), '='),
    '+/', '-_'
  );
$$;

create or replace function public.email_domain_allowed(p_email text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_email is not null
     and position('@' in p_email) > 1
     and exists (
       select 1 from public.allowed_email_domains d
       where d.domain = lower(split_part(trim(p_email), '@', 2))
     );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- A signed-in user whose email is confirmed and belongs to an allowed domain.
create or replace function public.is_verified_student()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and public.email_domain_allowed(u.email)
  );
$$;

-- ─── Profiles: create on sign-up ────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 80), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Supabase Auth "Before User Created" hook. Rejects sign-ups from domains that
-- are not in allowed_email_domains. Enable it in Dashboard → Auth → Hooks.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_email text := event -> 'user' ->> 'email';
begin
  if public.email_domain_allowed(v_email) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Please sign in with your SRM student email address.'
    )
  );
end $$;

-- Admin bootstrap. Only callable by the service role / database owner.
create or replace function public.grant_admin(p_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  update public.profiles set role = 'admin' where lower(email) = lower(trim(p_email)) returning id into v_id;
  if v_id is null then
    raise exception using message = 'PROFILE_NOT_FOUND', errcode = 'P0001',
      hint = 'The user must sign in to SPACIO once before being made an admin.';
  end if;
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, after)
  values (null, 'grant_admin', 'profile', v_id::text, jsonb_build_object('email', lower(trim(p_email))));
  return v_id::text;
end $$;

create or replace function public.revoke_admin(p_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  update public.profiles set role = 'student' where lower(email) = lower(trim(p_email)) returning id into v_id;
  if v_id is null then
    raise exception using message = 'PROFILE_NOT_FOUND', errcode = 'P0001';
  end if;
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, after)
  values (null, 'revoke_admin', 'profile', v_id::text, jsonb_build_object('email', lower(trim(p_email))));
  return v_id::text;
end $$;

-- ─── Audit logging for inventory changes ────────────────────────────────────

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_entity_id text;
begin
  v_entity_id := coalesce(
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id',
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'domain',
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'slug'
  );
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

create trigger audit_facilities after insert or update or delete on public.facilities for each row execute function public.audit_row_change();
create trigger audit_buildings after insert or update or delete on public.buildings for each row execute function public.audit_row_change();
create trigger audit_facility_seats after insert or update or delete on public.facility_seats for each row execute function public.audit_row_change();
create trigger audit_facility_hours after insert or update or delete on public.facility_operating_hours for each row execute function public.audit_row_change();
create trigger audit_facility_amenities after insert or update or delete on public.facility_amenities for each row execute function public.audit_row_change();
create trigger audit_facility_qr after insert or update or delete on public.facility_qr_codes for each row execute function public.audit_row_change();
create trigger audit_facility_categories after insert or update or delete on public.facility_categories for each row execute function public.audit_row_change();
create trigger audit_allowed_domains after insert or update or delete on public.allowed_email_domains for each row execute function public.audit_row_change();
create trigger audit_app_settings after update on public.app_settings for each row execute function public.audit_row_change();

-- Role changes are always audited, whoever makes them.
create or replace function public.audit_profile_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role then
    insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, before, after)
    values (auth.uid(), 'role_change', 'profile', new.id::text,
            jsonb_build_object('role', old.role), jsonb_build_object('role', new.role));
  end if;
  return null;
end $$;
create trigger audit_profiles_role after update of role on public.profiles for each row execute function public.audit_profile_role();

-- ─── Realtime change signal ─────────────────────────────────────────────────

create or replace function public.bump_facility_live(p_facility_id uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.facility_live (facility_id, version, updated_at)
  values (p_facility_id, 1, now())
  on conflict (facility_id) do update
    set version = public.facility_live.version + 1, updated_at = now();
$$;

create or replace function public.on_inventory_change_bump()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'facilities' then
    if tg_op <> 'DELETE' then perform public.bump_facility_live(new.id); end if;
  else
    if tg_op in ('UPDATE', 'DELETE') then perform public.bump_facility_live(old.facility_id); end if;
    if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.facility_id is distinct from old.facility_id) then
      perform public.bump_facility_live(new.facility_id);
    end if;
  end if;
  return null;
end $$;

create trigger live_facilities after insert or update on public.facilities for each row execute function public.on_inventory_change_bump();
create trigger live_reservations after insert or update or delete on public.reservations for each row execute function public.on_inventory_change_bump();
create trigger live_seats after insert or update or delete on public.facility_seats for each row execute function public.on_inventory_change_bump();
create trigger live_hours after insert or update or delete on public.facility_operating_hours for each row execute function public.on_inventory_change_bump();

-- ─── Opening hours ──────────────────────────────────────────────────────────

-- True when [p_start, p_end) falls inside a single day's opening window.
create or replace function public.facility_window_open(p_facility_id uuid, p_start timestamptz, p_end timestamptz)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz        text := public.campus_tz();
  v_local     timestamp := p_start at time zone v_tz;
  v_day_start timestamp := date_trunc('day', v_local);
  v_start_off interval := v_local - v_day_start;
  v_end_off   interval := (p_end at time zone v_tz) - v_day_start;
  v_hours     record;
begin
  select opens_at, closes_at, is_closed into v_hours
  from public.facility_operating_hours
  where facility_id = p_facility_id and weekday = extract(dow from v_local)::smallint;

  if not found or v_hours.is_closed then
    return false;
  end if;
  return v_start_off >= (v_hours.opens_at - time '00:00')
     and v_end_off  <= (v_hours.closes_at - time '00:00')
     and v_end_off  >  v_start_off;
end $$;

create or replace function public.facility_open_now(p_facility_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.facility_window_open(p_facility_id, now(), now() + interval '1 second');
$$;

-- ─── Check-in deadline ──────────────────────────────────────────────────────
-- A booking must be checked into within the grace period. The grace period
-- runs from the later of the slot start and the booking time, so booking the
-- slot that is already running still gives the student time to walk over.
create or replace function public._checkin_deadline(p_res public.reservations, p_grace_minutes integer)
returns timestamptz language sql stable set search_path = '' as $$
  select least(greatest(p_res.starts_at, p_res.created_at) + make_interval(mins => p_grace_minutes), p_res.ends_at);
$$;

-- ─── Lazy state sweeping ────────────────────────────────────────────────────
-- BOOKED reservations whose check-in window closed become NO_SHOW (seat
-- released). CHECKED_IN reservations past their end become EXPIRED.
-- Called at the start of every booking/scan RPC and by cron when available.
create or replace function public.sweep_reservations()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_no_show integer;
  v_expired integer;
begin
  update public.reservations r
     set status = 'NO_SHOW'
    from public.facilities f
   where r.facility_id = f.id
     and r.status = 'BOOKED'
     and now() >= public._checkin_deadline(r, f.no_show_grace_minutes);
  get diagnostics v_no_show = row_count;

  update public.reservations
     set status = 'EXPIRED', checked_out_at = ends_at
   where status = 'CHECKED_IN' and now() >= ends_at;
  get diagnostics v_expired = row_count;

  return v_no_show + v_expired;
end $$;

-- ─── Booking ────────────────────────────────────────────────────────────────

-- Shared validation for both booking modes. Raises on any violation.
create or replace function public._assert_bookable(p_facility public.facilities, p_start timestamptz, p_end timestamptz, p_mode text)
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  v_settings  public.app_settings;
  v_tz        text := public.campus_tz();
  v_start_off interval;
  v_minutes   numeric;
  v_upcoming  integer;
begin
  if auth.uid() is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;
  if not (public.is_verified_student() or public.is_admin()) then
    raise exception using message = 'NOT_VERIFIED', errcode = 'P0001';
  end if;
  if p_facility.id is null or not p_facility.is_active then
    raise exception using message = 'FACILITY_NOT_FOUND', errcode = 'P0001';
  end if;
  if p_facility.is_temporarily_closed then
    raise exception using message = 'FACILITY_CLOSED', errcode = 'P0001';
  end if;
  if p_facility.booking_mode <> p_mode then
    raise exception using message = 'WRONG_BOOKING_MODE', errcode = 'P0001';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception using message = 'INVALID_TIME', errcode = 'P0001';
  end if;

  select * into v_settings from public.app_settings where id;

  -- Slots are aligned to the facility's slot length from local midnight.
  v_start_off := (p_start at time zone v_tz) - date_trunc('day', p_start at time zone v_tz);
  v_minutes   := extract(epoch from (p_end - p_start)) / 60;
  if (extract(epoch from v_start_off)::bigint % (p_facility.slot_minutes * 60)) <> 0
     or (v_minutes::bigint % p_facility.slot_minutes) <> 0
     or v_minutes <> trunc(v_minutes) then
    raise exception using message = 'INVALID_TIME', errcode = 'P0001';
  end if;
  if v_minutes > p_facility.max_booking_minutes then
    raise exception using message = 'DURATION_TOO_LONG', errcode = 'P0001';
  end if;
  -- The current slot may still be booked while it is running.
  if p_start + make_interval(mins => p_facility.slot_minutes) <= now() then
    raise exception using message = 'IN_PAST', errcode = 'P0001';
  end if;
  if p_start > now() + make_interval(days => v_settings.booking_horizon_days) then
    raise exception using message = 'TOO_FAR_AHEAD', errcode = 'P0001';
  end if;
  if not public.facility_window_open(p_facility.id, p_start, p_end) then
    raise exception using message = 'OUTSIDE_HOURS', errcode = 'P0001';
  end if;

  select count(*) into v_upcoming
  from public.reservations
  where user_id = auth.uid() and status in ('BOOKED', 'CHECKED_IN') and ends_at > now();
  if v_upcoming >= v_settings.max_upcoming_reservations then
    raise exception using message = 'TOO_MANY_RESERVATIONS', errcode = 'P0001';
  end if;
end $$;

create or replace function public.book_seat(p_seat_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_seat       public.facility_seats;
  v_facility   public.facilities;
  v_id         uuid;
  v_constraint text;
begin
  perform public.sweep_reservations();

  select * into v_seat from public.facility_seats where id = p_seat_id;
  if not found then
    raise exception using message = 'SEAT_NOT_FOUND', errcode = 'P0001';
  end if;
  select * into v_facility from public.facilities where id = v_seat.facility_id;
  perform public._assert_bookable(v_facility, p_starts_at, p_ends_at, 'seat');
  if v_seat.status <> 'active' then
    raise exception using message = 'SEAT_UNAVAILABLE', errcode = 'P0001';
  end if;

  begin
    insert into public.reservations (user_id, facility_id, seat_id, starts_at, ends_at)
    values (auth.uid(), v_facility.id, v_seat.id, p_starts_at, p_ends_at)
    returning id into v_id;
  exception when exclusion_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'reservations_no_seat_overlap' then
      raise exception using message = 'SEAT_TAKEN', errcode = 'P0001';
    end if;
    raise exception using message = 'USER_CONFLICT', errcode = 'P0001';
  end;
  return v_id;
end $$;

create or replace function public.book_capacity(p_facility_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_facility public.facilities;
  v_peak     integer;
  v_id       uuid;
begin
  perform public.sweep_reservations();

  -- Row lock serialises concurrent capacity bookings for this facility, so the
  -- count below can't be raced past the configured capacity.
  select * into v_facility from public.facilities where id = p_facility_id for update;
  perform public._assert_bookable(v_facility, p_starts_at, p_ends_at, 'capacity');

  select coalesce(max(cnt), 0) into v_peak
  from (
    select s.slot_start, count(r.id) as cnt
    from generate_series(p_starts_at, p_ends_at - interval '1 second', make_interval(mins => v_facility.slot_minutes)) as s(slot_start)
    left join public.reservations r
      on r.facility_id = v_facility.id
     and r.status in ('BOOKED', 'CHECKED_IN')
     and tstzrange(r.starts_at, r.ends_at, '[)') && tstzrange(s.slot_start, s.slot_start + make_interval(mins => v_facility.slot_minutes), '[)')
    group by s.slot_start
  ) slots;

  if v_peak >= v_facility.capacity then
    raise exception using message = 'CAPACITY_FULL', errcode = 'P0001';
  end if;

  begin
    insert into public.reservations (user_id, facility_id, starts_at, ends_at)
    values (auth.uid(), v_facility.id, p_starts_at, p_ends_at)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception using message = 'USER_CONFLICT', errcode = 'P0001';
  end;
  return v_id;
end $$;

create or replace function public.cancel_reservation(p_reservation_id uuid)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_res public.reservations;
begin
  if auth.uid() is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;
  perform public.sweep_reservations();

  select * into v_res from public.reservations
  where id = p_reservation_id and user_id = auth.uid()
  for update;
  if not found then
    raise exception using message = 'RESERVATION_NOT_FOUND', errcode = 'P0001';
  end if;
  if v_res.status <> 'BOOKED' then
    raise exception using message = 'CANNOT_CANCEL', errcode = 'P0001';
  end if;

  update public.reservations
     set status = 'CANCELLED', cancelled_at = now(), cancelled_by = auth.uid()
   where id = v_res.id;
  return 'CANCELLED';
end $$;

create or replace function public.admin_cancel_reservation(p_reservation_id uuid, p_reason text default null)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_res public.reservations;
begin
  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception using message = 'RESERVATION_NOT_FOUND', errcode = 'P0001';
  end if;
  if v_res.status not in ('BOOKED', 'CHECKED_IN') then
    raise exception using message = 'CANNOT_CANCEL', errcode = 'P0001';
  end if;

  update public.reservations
     set status = 'CANCELLED',
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancel_reason = left(nullif(trim(p_reason), ''), 200),
         checked_out_at = case when v_res.status = 'CHECKED_IN' then now() else checked_out_at end
   where id = v_res.id;

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (auth.uid(), 'cancel_reservation', 'reservations', v_res.id::text,
          jsonb_build_object('status', v_res.status),
          jsonb_build_object('status', 'CANCELLED', 'reason', p_reason));
  return 'CANCELLED';
end $$;

-- ─── QR scanning state machine ──────────────────────────────────────────────

create or replace function public._reservation_json(p_res public.reservations)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when p_res.id is null then null else jsonb_build_object(
    'id', p_res.id,
    'status', p_res.status,
    'starts_at', p_res.starts_at,
    'ends_at', p_res.ends_at,
    'checked_in_at', p_res.checked_in_at,
    'checked_out_at', p_res.checked_out_at,
    'seat_label', (select label from public.facility_seats where id = p_res.seat_id)
  ) end;
$$;

-- Resolve a facility QR for the signed-in student and advance their
-- reservation. Returns a JSON object whose "result" is one of:
--   INVALID_QR, RATE_LIMITED, FACILITY_UNAVAILABLE, NOT_BOOKABLE,
--   CHECKED_IN, JUST_CHECKED_IN, CONFIRM_CHECKOUT, TOO_EARLY,
--   NO_RESERVATION_HERE, NO_RESERVATION
-- Scanning while checked in never checks out by itself — it returns
-- CONFIRM_CHECKOUT and the student must call confirm_checkout().
create or replace function public.scan_facility(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid      uuid := auth.uid();
  v_settings public.app_settings;
  v_qr       public.facility_qr_codes;
  v_facility public.facilities;
  v_res      public.reservations;
  v_other_name text;
  v_other_slug text;
  v_recent   integer;
  v_result   text;
begin
  if v_uid is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;
  if not (public.is_verified_student() or public.is_admin()) then
    raise exception using message = 'NOT_VERIFIED', errcode = 'P0001';
  end if;

  select * into v_settings from public.app_settings where id;
  select count(*) into v_recent from public.qr_scan_events
   where user_id = v_uid and created_at > now() - interval '1 minute';
  if v_recent >= v_settings.scan_rate_limit_per_minute then
    return jsonb_build_object('result', 'RATE_LIMITED');
  end if;

  perform public.sweep_reservations();

  select * into v_qr from public.facility_qr_codes
   where token = trim(coalesce(p_token, '')) and is_active;
  if not found then
    insert into public.qr_scan_events (user_id, action, result) values (v_uid, 'scan', 'INVALID_QR');
    return jsonb_build_object('result', 'INVALID_QR');
  end if;

  select * into v_facility from public.facilities where id = v_qr.facility_id;
  if not v_facility.is_active or v_facility.is_temporarily_closed then
    v_result := 'FACILITY_UNAVAILABLE';
  elsif v_facility.booking_mode = 'none' then
    v_result := 'NOT_BOOKABLE';
  else
    -- 1) Already inside → offer checkout (with a short double-scan guard).
    select * into v_res from public.reservations
     where user_id = v_uid and facility_id = v_facility.id and status = 'CHECKED_IN'
     order by starts_at limit 1
     for update;
    if found then
      if v_res.checked_in_at > now() - make_interval(secs => v_settings.double_scan_guard_seconds) then
        v_result := 'JUST_CHECKED_IN';
      else
        v_result := 'CONFIRM_CHECKOUT';
      end if;
    else
      -- 2) A booking whose check-in window is open → check in.
      select * into v_res from public.reservations r
       where r.user_id = v_uid and r.facility_id = v_facility.id and r.status = 'BOOKED'
         and now() >= r.starts_at - make_interval(mins => v_facility.checkin_early_minutes)
         and now() <  public._checkin_deadline(r, v_facility.no_show_grace_minutes)
       order by r.starts_at limit 1
       for update;
      if found then
        update public.reservations
           set status = 'CHECKED_IN', checked_in_at = now()
         where id = v_res.id
         returning * into v_res;
        v_result := 'CHECKED_IN';
      else
        -- 3) A later booking here → too early.
        select * into v_res from public.reservations
         where user_id = v_uid and facility_id = v_facility.id and status = 'BOOKED' and starts_at > now()
         order by starts_at limit 1;
        if found then
          v_result := 'TOO_EARLY';
        else
          -- 4) Booked somewhere else? Never touch it from this QR.
          select f.name, f.slug into v_other_name, v_other_slug
            from public.reservations r join public.facilities f on f.id = r.facility_id
           where r.user_id = v_uid and r.status in ('BOOKED', 'CHECKED_IN') and r.ends_at > now()
           order by r.starts_at limit 1;
          if found then
            v_result := 'NO_RESERVATION_HERE';
          else
            v_result := 'NO_RESERVATION';
          end if;
        end if;
      end if;
    end if;
  end if;

  insert into public.qr_scan_events (user_id, facility_id, reservation_id, action, result)
  values (v_uid, v_facility.id, v_res.id, 'scan', v_result);

  return jsonb_build_object(
    'result', v_result,
    'facility', jsonb_build_object('id', v_facility.id, 'slug', v_facility.slug, 'name', v_facility.name),
    'reservation', public._reservation_json(v_res),
    'other_facility', case when v_other_slug is not null
                        then jsonb_build_object('name', v_other_name, 'slug', v_other_slug) end
  );
end $$;

-- Complete a checkout the student confirmed after scanning the facility QR.
-- Results: CHECKED_OUT, ALREADY_CHECKED_OUT, NOT_CHECKED_IN, WRONG_FACILITY,
--          INVALID_QR, RESERVATION_NOT_FOUND
create or replace function public.confirm_checkout(p_reservation_id uuid, p_token text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_qr     public.facility_qr_codes;
  v_res    public.reservations;
  v_result text;
begin
  if v_uid is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  select * into v_qr from public.facility_qr_codes where token = trim(coalesce(p_token, '')) and is_active;
  if not found then
    return jsonb_build_object('result', 'INVALID_QR');
  end if;

  -- Only the owner's own reservation is visible here.
  select * into v_res from public.reservations
   where id = p_reservation_id and user_id = v_uid
   for update;
  if not found then
    return jsonb_build_object('result', 'RESERVATION_NOT_FOUND');
  end if;

  if v_res.facility_id <> v_qr.facility_id then
    v_result := 'WRONG_FACILITY';
  elsif v_res.status in ('CHECKED_OUT', 'EXPIRED') then
    v_result := 'ALREADY_CHECKED_OUT';
  elsif v_res.status <> 'CHECKED_IN' then
    v_result := 'NOT_CHECKED_IN';
  else
    update public.reservations
       set status = 'CHECKED_OUT', checked_out_at = now()
     where id = v_res.id
     returning * into v_res;
    v_result := 'CHECKED_OUT';
  end if;

  insert into public.qr_scan_events (user_id, facility_id, reservation_id, action, result)
  values (v_uid, v_qr.facility_id, v_res.id, 'checkout', v_result);

  return jsonb_build_object(
    'result', v_result,
    'facility', (select jsonb_build_object('id', f.id, 'slug', f.slug, 'name', f.name)
                   from public.facilities f where f.id = v_res.facility_id),
    'reservation', public._reservation_json(v_res)
  );
end $$;

-- ─── Read models (aggregate only; never expose other students) ─────────────

-- A BOOKED reservation only holds its place until its check-in window closes,
-- so availability reads stay correct even between sweeps.
create or replace function public._is_live(p_res public.reservations, p_grace_minutes integer)
returns boolean language sql stable set search_path = '' as $$
  select p_res.status = 'CHECKED_IN'
      or (p_res.status = 'BOOKED'
          and now() < public._checkin_deadline(p_res, p_grace_minutes));
$$;

create or replace function public.get_facility_availability(p_facility_ids uuid[] default null)
returns table (
  facility_id   uuid,
  booking_mode  text,
  capacity      integer,
  occupied      integer,
  reserved      integer,
  available     integer,
  unavailable   integer,
  is_open_now   boolean,
  opens_at      time,
  closes_at     time
)
language sql stable security definer set search_path = '' as $$
  with fac as (
    select f.* from public.facilities f
    where (p_facility_ids is null or f.id = any (p_facility_ids))
      and (f.is_active or public.is_admin())
  ),
  today as (
    select h.facility_id, h.opens_at, h.closes_at, h.is_closed
    from public.facility_operating_hours h
    where h.weekday = extract(dow from (now() at time zone public.campus_tz()))::smallint
  ),
  live as (
    select r.facility_id, r.seat_id, r.status
    from public.reservations r
    join fac f on f.id = r.facility_id
    where r.status in ('BOOKED', 'CHECKED_IN')
      and r.starts_at <= now() and now() < r.ends_at
      and public._is_live(r, f.no_show_grace_minutes)
  ),
  seat_counts as (
    select s.facility_id,
           count(*) filter (where s.status = 'active')::int  as active_seats,
           count(*) filter (where s.status <> 'active')::int as inactive_seats
    from public.facility_seats s join fac f on f.id = s.facility_id
    group by s.facility_id
  ),
  live_counts as (
    select l.facility_id,
           count(*) filter (where l.status = 'CHECKED_IN')::int as occ,
           count(*) filter (where l.status = 'BOOKED')::int     as res
    from live l
    group by l.facility_id
  )
  select
    f.id,
    f.booking_mode,
    case f.booking_mode when 'seat' then coalesce(sc.active_seats, 0)
                        when 'capacity' then f.capacity end,
    coalesce(lc.occ, 0),
    coalesce(lc.res, 0),
    case f.booking_mode
      when 'seat'     then greatest(coalesce(sc.active_seats, 0) - coalesce(lc.occ, 0) - coalesce(lc.res, 0), 0)
      when 'capacity' then greatest(f.capacity - coalesce(lc.occ, 0) - coalesce(lc.res, 0), 0)
    end,
    coalesce(sc.inactive_seats, 0),
    (not f.is_temporarily_closed and public.facility_open_now(f.id)),
    case when t.is_closed then null else t.opens_at end,
    case when t.is_closed then null else t.closes_at end
  from fac f
  left join seat_counts sc on sc.facility_id = f.id
  left join live_counts lc on lc.facility_id = f.id
  left join today t on t.facility_id = f.id;
$$;

-- Seat states for a time window (defaults to "right now").
create or replace function public.get_seat_map(p_facility_id uuid, p_from timestamptz default null, p_to timestamptz default null)
returns table (
  seat_id     uuid,
  label       text,
  row_label   text,
  col_index   integer,
  seat_status text,
  state       text,   -- available | reserved | occupied | unavailable
  is_mine     boolean
)
language sql stable security definer set search_path = '' as $$
  with f as (
    select * from public.facilities
    where id = p_facility_id and (is_active or public.is_admin())
  ),
  win as (
    select coalesce(p_from, now()) as w_from,
           coalesce(p_to, coalesce(p_from, now()) + interval '1 minute') as w_to
  ),
  hits as (
    select r.seat_id,
           bool_or(r.status = 'CHECKED_IN') as any_in,
           bool_or(r.user_id = auth.uid())  as mine
    from public.reservations r, f, win
    where r.facility_id = f.id
      and r.seat_id is not null
      and r.status in ('BOOKED', 'CHECKED_IN')
      and tstzrange(r.starts_at, r.ends_at, '[)') && tstzrange(win.w_from, win.w_to, '[)')
      and public._is_live(r, f.no_show_grace_minutes)
    group by r.seat_id
  )
  select s.id, s.label, s.row_label, s.col_index, s.status,
         case when s.status <> 'active' then 'unavailable'
              when h.any_in then 'occupied'
              when h.seat_id is not null then 'reserved'
              else 'available' end,
         coalesce(h.mine, false)
  from public.facility_seats s
  join f on f.id = s.facility_id
  left join hits h on h.seat_id = s.id
  order by s.row_label, s.col_index;
$$;

-- Bookable slots for a date, with live counts per slot.
create or replace function public.get_facility_slots(p_facility_id uuid, p_date date)
returns table (
  slot_start timestamptz,
  slot_end   timestamptz,
  capacity   integer,
  booked     integer,
  available  integer,
  is_past    boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz  text := public.campus_tz();
  v_f   public.facilities;
  v_h   public.facility_operating_hours;
  v_cap integer;
begin
  select * into v_f from public.facilities where id = p_facility_id and (is_active or public.is_admin());
  if not found or v_f.booking_mode = 'none' then
    return;
  end if;
  select * into v_h from public.facility_operating_hours
   where facility_id = v_f.id and weekday = extract(dow from p_date)::smallint;
  if not found or v_h.is_closed then
    return;
  end if;

  if v_f.booking_mode = 'seat' then
    select count(*)::int into v_cap from public.facility_seats where facility_id = v_f.id and status = 'active';
  else
    v_cap := v_f.capacity;
  end if;

  return query
  with slots as (
    select (gs at time zone v_tz) as s_start,
           ((gs + make_interval(mins => v_f.slot_minutes)) at time zone v_tz) as s_end
    from generate_series(
      p_date + v_h.opens_at,
      p_date + (v_h.closes_at - time '00:00') - make_interval(mins => v_f.slot_minutes),
      make_interval(mins => v_f.slot_minutes)
    ) gs
  ),
  counted as (
    select s.s_start, s.s_end,
           (select count(distinct coalesce(r.seat_id, r.id))::int
              from public.reservations r
             where r.facility_id = v_f.id
               and r.status in ('BOOKED', 'CHECKED_IN')
               and tstzrange(r.starts_at, r.ends_at, '[)') && tstzrange(s.s_start, s.s_end, '[)')
               and public._is_live(r, v_f.no_show_grace_minutes)) as n
    from slots s
  )
  select c.s_start, c.s_end, v_cap, c.n, greatest(coalesce(v_cap, 0) - c.n, 0), c.s_end <= now()
  from counted c
  order by c.s_start;
end $$;

create or replace function public.get_campus_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  with a as (select * from public.get_facility_availability(null))
  select jsonb_build_object(
    'total_facilities',    (select count(*) from public.facilities where is_active),
    'bookable_facilities', (select count(*) from public.facilities where is_active and booking_mode <> 'none'),
    'total_capacity',      coalesce((select sum(capacity) from a), 0),
    'available',           coalesce((select sum(available) from a), 0),
    'occupied',            coalesce((select sum(occupied) from a), 0),
    'reserved',            coalesce((select sum(reserved) from a), 0),
    'active_reservations', coalesce((select sum(occupied + reserved) from a), 0),
    'my_active_reservations', (select count(*) from public.reservations
                                where user_id = auth.uid() and status in ('BOOKED', 'CHECKED_IN') and ends_at > now())
  );
$$;

create or replace function public.get_admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  return public.get_campus_stats() || jsonb_build_object(
    'inactive_facilities', (select count(*) from public.facilities where not is_active),
    'upcoming_reservations', (select count(*) from public.reservations where status = 'BOOKED' and starts_at > now()),
    'expired_24h',  (select count(*) from public.reservations where status = 'EXPIRED' and updated_at > now() - interval '24 hours'),
    'no_show_24h',  (select count(*) from public.reservations where status = 'NO_SHOW' and updated_at > now() - interval '24 hours'),
    'checkouts_24h', (select count(*) from public.reservations where status = 'CHECKED_OUT' and checked_out_at > now() - interval '24 hours'),
    'students', (select count(*) from public.profiles where role = 'student'),
    'seats_in_maintenance', (select count(*) from public.facility_seats where status <> 'active')
  );
end $$;

-- Admin view of reservations with student identity (admins only).
create or replace function public.admin_list_reservations(
  p_search text default null,
  p_status text default null,
  p_facility_id uuid default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid, status text, starts_at timestamptz, ends_at timestamptz,
  checked_in_at timestamptz, checked_out_at timestamptz, cancelled_at timestamptz, cancel_reason text,
  created_at timestamptz, facility_id uuid, facility_name text, seat_label text,
  student_email text, student_name text, total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  return query
  select r.id, r.status, r.starts_at, r.ends_at, r.checked_in_at, r.checked_out_at, r.cancelled_at, r.cancel_reason,
         r.created_at, f.id, f.name, s.label, p.email, p.full_name,
         count(*) over ()
  from public.reservations r
  join public.facilities f on f.id = r.facility_id
  join public.profiles p on p.id = r.user_id
  left join public.facility_seats s on s.id = r.seat_id
  where (p_status is null or r.status = p_status)
    and (p_facility_id is null or r.facility_id = p_facility_id)
    and (p_search is null or p_search = ''
         or p.email ilike '%' || p_search || '%'
         or coalesce(p.full_name, '') ilike '%' || p_search || '%'
         or f.name ilike '%' || p_search || '%'
         or coalesce(s.label, '') ilike '%' || p_search || '%'
         or r.id::text ilike p_search || '%')
  order by r.starts_at desc
  limit least(greatest(p_limit, 1), 500) offset greatest(p_offset, 0);
end $$;

-- Rotate (or create) a facility's QR token. The old token stops working.
create or replace function public.admin_rotate_qr(p_facility_id uuid)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_token text;
begin
  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if not exists (select 1 from public.facilities where id = p_facility_id) then
    raise exception using message = 'FACILITY_NOT_FOUND', errcode = 'P0001';
  end if;
  update public.facility_qr_codes set is_active = false, revoked_at = now()
   where facility_id = p_facility_id and is_active;
  v_token := public.generate_qr_token();
  insert into public.facility_qr_codes (facility_id, token) values (p_facility_id, v_token);
  return v_token;
end $$;

-- Create a rectangular seat grid (rows A.., columns 1..n). Existing labels are kept.
create or replace function public.admin_generate_seats(p_facility_id uuid, p_rows integer, p_cols integer)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if p_rows not between 1 and 26 or p_cols not between 1 and 40 then
    raise exception using message = 'INVALID_LAYOUT', errcode = 'P0001';
  end if;
  insert into public.facility_seats (facility_id, label, row_label, col_index)
  select p_facility_id, chr(64 + r) || lpad(c::text, 2, '0'), chr(64 + r), c
  from generate_series(1, p_rows) r, generate_series(1, p_cols) c
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
