-- ════════════════════════════════════════════════════════════════════════════
-- SPACIO · 0003 · Row Level Security and privileges
--
-- Principles
--  • Hiding a button is never the protection: every table has RLS.
--  • Reservations have NO insert/update/delete policies. All state changes go
--    through the SECURITY DEFINER functions in 0002, which validate ownership
--    and the state machine.
--  • Admin rights come from profiles.role, which students cannot write
--    (column-level grants), checked server-side by public.is_admin().
-- ════════════════════════════════════════════════════════════════════════════

alter table public.app_settings             enable row level security;
alter table public.allowed_email_domains    enable row level security;
alter table public.profiles                 enable row level security;
alter table public.buildings                enable row level security;
alter table public.facility_categories      enable row level security;
alter table public.facilities               enable row level security;
alter table public.facility_operating_hours enable row level security;
alter table public.facility_amenities       enable row level security;
alter table public.facility_seats           enable row level security;
alter table public.reservations             enable row level security;
alter table public.favorites                enable row level security;
alter table public.facility_qr_codes        enable row level security;
alter table public.qr_scan_events           enable row level security;
alter table public.otp_requests             enable row level security;
alter table public.facility_live            enable row level security;
alter table public.admin_audit_logs         enable row level security;

-- ─── Table privileges ───────────────────────────────────────────────────────
-- Supabase grants ALL on new tables to anon/authenticated by default. Tighten.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.app_settings, public.buildings, public.facility_categories, public.facilities,
               public.facility_operating_hours, public.facility_amenities, public.facility_seats,
               public.facility_live
  to authenticated;

-- Admin-managed inventory (RLS restricts writes to admins).
grant insert, update, delete on public.buildings, public.facility_categories, public.facilities,
                                public.facility_operating_hours, public.facility_amenities,
                                public.facility_seats, public.facility_qr_codes, public.allowed_email_domains
  to authenticated;
grant update on public.app_settings to authenticated;
grant select on public.facility_qr_codes, public.qr_scan_events, public.admin_audit_logs,
               public.allowed_email_domains
  to authenticated;

-- Profiles: read (RLS: own row / admin); students may edit only these columns.
grant select on public.profiles to authenticated;
grant update (full_name, register_number) on public.profiles to authenticated;

-- Reservations: read only. Writes happen exclusively through RPCs.
grant select on public.reservations to authenticated;

-- Favorites: students manage their own.
grant select, insert, delete on public.favorites to authenticated;

-- otp_requests: no client access at all (service role only).

-- ─── Policies ───────────────────────────────────────────────────────────────

-- app_settings
create policy app_settings_read on public.app_settings for select to authenticated using (true);
create policy app_settings_admin_update on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- allowed_email_domains
create policy domains_admin_read on public.allowed_email_domains for select to authenticated using (public.is_admin());
create policy domains_admin_insert on public.allowed_email_domains for insert to authenticated with check (public.is_admin());
create policy domains_admin_update on public.allowed_email_domains for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy domains_admin_delete on public.allowed_email_domains for delete to authenticated using (public.is_admin());

-- profiles
create policy profiles_read_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Inventory tables: any signed-in user can read; only admins can write.
create policy buildings_read on public.buildings for select to authenticated using (true);
create policy buildings_admin_insert on public.buildings for insert to authenticated with check (public.is_admin());
create policy buildings_admin_update on public.buildings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy buildings_admin_delete on public.buildings for delete to authenticated using (public.is_admin());

create policy categories_read on public.facility_categories for select to authenticated using (true);
create policy categories_admin_insert on public.facility_categories for insert to authenticated with check (public.is_admin());
create policy categories_admin_update on public.facility_categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy categories_admin_delete on public.facility_categories for delete to authenticated using (public.is_admin());

create policy facilities_read on public.facilities for select to authenticated using (is_active or public.is_admin());
create policy facilities_admin_insert on public.facilities for insert to authenticated with check (public.is_admin());
create policy facilities_admin_update on public.facilities for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy facilities_admin_delete on public.facilities for delete to authenticated using (public.is_admin());

create policy hours_read on public.facility_operating_hours for select to authenticated using (true);
create policy hours_admin_insert on public.facility_operating_hours for insert to authenticated with check (public.is_admin());
create policy hours_admin_update on public.facility_operating_hours for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy hours_admin_delete on public.facility_operating_hours for delete to authenticated using (public.is_admin());

create policy amenities_read on public.facility_amenities for select to authenticated using (true);
create policy amenities_admin_insert on public.facility_amenities for insert to authenticated with check (public.is_admin());
create policy amenities_admin_update on public.facility_amenities for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy amenities_admin_delete on public.facility_amenities for delete to authenticated using (public.is_admin());

create policy seats_read on public.facility_seats for select to authenticated using (true);
create policy seats_admin_insert on public.facility_seats for insert to authenticated with check (public.is_admin());
create policy seats_admin_update on public.facility_seats for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy seats_admin_delete on public.facility_seats for delete to authenticated using (public.is_admin());

-- reservations: owners and admins can read. No write policies on purpose.
create policy reservations_read_own on public.reservations for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- favorites
create policy favorites_read_own on public.favorites for select to authenticated using (user_id = auth.uid());
create policy favorites_insert_own on public.favorites for insert to authenticated with check (user_id = auth.uid());
create policy favorites_delete_own on public.favorites for delete to authenticated using (user_id = auth.uid());

-- QR codes: admins only (tokens are what the printed codes contain).
create policy qr_admin_read on public.facility_qr_codes for select to authenticated using (public.is_admin());
create policy qr_admin_insert on public.facility_qr_codes for insert to authenticated with check (public.is_admin());
create policy qr_admin_update on public.facility_qr_codes for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy qr_admin_delete on public.facility_qr_codes for delete to authenticated using (public.is_admin());

create policy scan_events_admin_read on public.qr_scan_events for select to authenticated using (public.is_admin());

create policy facility_live_read on public.facility_live for select to authenticated using (true);

create policy audit_admin_read on public.admin_audit_logs for select to authenticated using (public.is_admin());

-- ─── Function privileges ────────────────────────────────────────────────────
-- Functions are executable by PUBLIC by default. Lock everything down, then
-- grant only the RPCs the app calls.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;

grant execute on function
  public.is_admin(),
  public.is_verified_student(),
  public.email_domain_allowed(text),
  public.campus_tz(),
  public.facility_open_now(uuid),
  public.facility_window_open(uuid, timestamptz, timestamptz),
  public._is_live(public.reservations, integer),
  public._checkin_deadline(public.reservations, integer),
  public.sweep_reservations(),
  public.book_seat(uuid, timestamptz, timestamptz),
  public.book_capacity(uuid, timestamptz, timestamptz),
  public.cancel_reservation(uuid),
  public.admin_cancel_reservation(uuid, text),
  public.scan_facility(text),
  public.confirm_checkout(uuid, text),
  public.get_facility_availability(uuid[]),
  public.get_seat_map(uuid, timestamptz, timestamptz),
  public.get_facility_slots(uuid, date),
  public.get_campus_stats(),
  public.get_admin_stats(),
  public.admin_list_reservations(text, text, uuid, integer, integer),
  public.admin_rotate_qr(uuid),
  public.admin_generate_seats(uuid, integer, integer)
to authenticated;

-- Pre-login domain check used by the sign-in form.
grant execute on function public.email_domain_allowed(text) to anon;

-- Service role (server-side scripts, cron) gets the maintenance helpers.
grant execute on function public.grant_admin(text), public.revoke_admin(text), public.sweep_reservations()
  to service_role;
