-- ════════════════════════════════════════════════════════════════════════════
-- Booking passes: every reservation carries its own QR pass. The student shows
-- it at the entrance; an admin scans it and checks them in or out. The pass
-- encodes only an opaque random token — never student data.
--
-- The same server-side rules as facility scanning apply: check-in only inside
-- the booking's window, check-out only after check-in, each step at most once.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.reservations add column if not exists pass_token text;
update public.reservations set pass_token = public.generate_qr_token() where pass_token is null;
alter table public.reservations alter column pass_token set default public.generate_qr_token();
alter table public.reservations alter column pass_token set not null;
create unique index if not exists reservations_pass_token_key on public.reservations (pass_token);

-- Who scanned the pass (null when the student scanned a facility QR themselves).
alter table public.reservations add column if not exists checked_in_by  uuid references public.profiles (id) on delete set null;
alter table public.reservations add column if not exists checked_out_by uuid references public.profiles (id) on delete set null;

-- Pass scans are logged alongside facility scans.
alter table public.qr_scan_events drop constraint if exists qr_scan_events_action_check;
alter table public.qr_scan_events
  add constraint qr_scan_events_action_check check (action in ('scan', 'checkout', 'pass_check_in', 'pass_check_out'));

-- What an admin may do with a pass right now:
--   CHECK_IN, CHECK_OUT, TOO_EARLY, MISSED, DONE, CANCELLED, UNAVAILABLE
create or replace function public._pass_state(p_res public.reservations)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when p_res.status = 'CANCELLED' then 'CANCELLED'
    when p_res.status = 'NO_SHOW' then 'MISSED'
    when p_res.status in ('CHECKED_OUT', 'EXPIRED') then 'DONE'
    when p_res.status = 'CHECKED_IN' then
      case when now() >= p_res.ends_at then 'DONE' else 'CHECK_OUT' end
    else (
      select case
        when not f.is_active or f.is_temporarily_closed then 'UNAVAILABLE'
        when now() < p_res.starts_at - make_interval(mins => f.checkin_early_minutes) then 'TOO_EARLY'
        when now() >= public._checkin_deadline(p_res, f.no_show_grace_minutes) then 'MISSED'
        else 'CHECK_IN'
      end
      from public.facilities f where f.id = p_res.facility_id
    )
  end;
$$;

create or replace function public._pass_json(p_res public.reservations, p_result text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'result', p_result,
    'state', public._pass_state(p_res),
    'reservation', public._reservation_json(p_res),
    'student', (select jsonb_build_object('name', p.full_name, 'email', p.email, 'register_number', p.register_number)
                  from public.profiles p where p.id = p_res.user_id),
    'facility', (select jsonb_build_object(
                    'id', f.id, 'slug', f.slug, 'name', f.name, 'floor_label', f.floor_label,
                    'building', b.name,
                    'checkin_opens_at', p_res.starts_at - make_interval(mins => f.checkin_early_minutes),
                    'checkin_deadline', public._checkin_deadline(p_res, f.no_show_grace_minutes))
                  from public.facilities f left join public.buildings b on b.id = f.building_id
                  where f.id = p_res.facility_id)
  );
$$;

-- Admin: read a pass without changing anything.
-- result: FOUND | INVALID_PASS
create or replace function public.staff_lookup_pass(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_res public.reservations;
begin
  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  perform public.sweep_reservations();
  select * into v_res from public.reservations where pass_token = trim(coalesce(p_token, ''));
  if not found then
    return jsonb_build_object('result', 'INVALID_PASS');
  end if;
  return public._pass_json(v_res, 'FOUND');
end $$;

-- Admin: check the pass holder in or out.
-- p_action: 'check_in' | 'check_out'
-- result: CHECKED_IN | CHECKED_OUT | ALREADY_CHECKED_IN | NOT_CHECKED_IN | INVALID_PASS
--         or the blocking state (TOO_EARLY, MISSED, DONE, CANCELLED, UNAVAILABLE)
create or replace function public.staff_pass_action(p_token text, p_action text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_res    public.reservations;
  v_state  text;
  v_result text;
begin
  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if p_action not in ('check_in', 'check_out') then
    raise exception using message = 'INVALID_ACTION', errcode = 'P0001';
  end if;

  perform public.sweep_reservations();

  select * into v_res from public.reservations where pass_token = trim(coalesce(p_token, '')) for update;
  if not found then
    return jsonb_build_object('result', 'INVALID_PASS');
  end if;

  v_state := public._pass_state(v_res);

  if p_action = 'check_in' then
    if v_state = 'CHECK_IN' then
      update public.reservations
         set status = 'CHECKED_IN', checked_in_at = now(), checked_in_by = v_uid
       where id = v_res.id
       returning * into v_res;
      v_result := 'CHECKED_IN';
    elsif v_state = 'CHECK_OUT' then
      v_result := 'ALREADY_CHECKED_IN';
    else
      v_result := v_state;
    end if;
  else
    if v_state = 'CHECK_OUT' then
      update public.reservations
         set status = 'CHECKED_OUT', checked_out_at = now(), checked_out_by = v_uid
       where id = v_res.id
       returning * into v_res;
      v_result := 'CHECKED_OUT';
    elsif v_state = 'CHECK_IN' or v_state = 'TOO_EARLY' then
      v_result := 'NOT_CHECKED_IN';
    else
      v_result := v_state;
    end if;
  end if;

  insert into public.qr_scan_events (user_id, facility_id, reservation_id, action, result)
  values (v_uid, v_res.facility_id, v_res.id, 'pass_' || p_action, v_result);

  return public._pass_json(v_res, v_result);
end $$;

-- The helpers take a whole reservation row, so a caller could pass one they
-- built themselves; only the definer functions above may call them.
revoke all on function public._pass_state(public.reservations), public._pass_json(public.reservations, text)
  from public, anon, authenticated;
revoke all on function public.staff_lookup_pass(text), public.staff_pass_action(text, text) from public, anon;
grant execute on function public.staff_lookup_pass(text), public.staff_pass_action(text, text) to authenticated;
