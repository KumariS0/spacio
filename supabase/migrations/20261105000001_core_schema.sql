-- ════════════════════════════════════════════════════════════════════════════
-- SPACIO · 0001 · Core schema
-- Tables, constraints and indexes. Behaviour lives in 0002, security in 0003,
-- Supabase-platform wiring (storage, realtime, cron, auth hook) in 0004.
-- ════════════════════════════════════════════════════════════════════════════

create schema if not exists extensions;
-- btree_gist lets an exclusion constraint combine "same seat" (=) with
-- "overlapping time range" (&&). This is what makes double-booking impossible
-- at the database level, including under concurrent requests.
create extension if not exists btree_gist with schema extensions;

-- ─── App-wide settings (singleton row) ──────────────────────────────────────
create table public.app_settings (
  id                         boolean primary key default true check (id),
  campus_tz                  text    not null default 'Asia/Kolkata',
  booking_horizon_days       integer not null default 7  check (booking_horizon_days between 1 and 60),
  max_upcoming_reservations  integer not null default 3  check (max_upcoming_reservations between 1 and 20),
  scan_rate_limit_per_minute integer not null default 12 check (scan_rate_limit_per_minute between 1 and 120),
  double_scan_guard_seconds  integer not null default 30 check (double_scan_guard_seconds between 0 and 600),
  updated_at                 timestamptz not null default now()
);
insert into public.app_settings (id) values (true);

-- ─── Allowed sign-in domains (backend authority) ────────────────────────────
create table public.allowed_email_domains (
  domain     text primary key check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  created_at timestamptz not null default now()
);
insert into public.allowed_email_domains (domain) values ('srmist.edu.in');

-- ─── Profiles ───────────────────────────────────────────────────────────────
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  full_name       text check (full_name is null or char_length(full_name) between 2 and 80),
  register_number text check (register_number is null or register_number ~ '^[A-Za-z0-9]{4,20}$'),
  role            text not null default 'student' check (role in ('student', 'admin')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));

-- ─── Campus inventory ───────────────────────────────────────────────────────
create table public.buildings (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  code        text check (code is null or char_length(code) <= 20),
  description text,
  -- Real-world coordinates are optional and only shown on the street map when
  -- an administrator has entered verified values.
  lat         double precision check (lat is null or lat between -90 and 90),
  lng         double precision check (lng is null or lng between -180 and 180),
  -- Position on the schematic campus map, in percent of its width/height.
  map_x       numeric(5,2) check (map_x is null or map_x between 0 and 100),
  map_y       numeric(5,2) check (map_y is null or map_y between 0 and 100),
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint buildings_latlng_pair check ((lat is null) = (lng is null))
);
create unique index buildings_name_key on public.buildings (lower(name));

create table public.facility_categories (
  slug       text primary key check (slug ~ '^[a-z][a-z0-9_]{1,30}$'),
  name       text not null,
  icon       text not null default 'map-pin',
  sort_order integer not null default 100
);

-- Default categories (editable by admins).
insert into public.facility_categories (slug, name, icon, sort_order) values
  ('library',      'Library',             'book-open',        10),
  ('gym',          'Gym',                 'dumbbell',         20),
  ('study_room',   'Study Room',          'lamp-desk',        30),
  ('reading_room', 'Reading Room',        'book-marked',      40),
  ('lab',          'Labs',                'flask-conical',    50),
  ('auditorium',   'Auditorium',          'theater',          60),
  ('building',     'University Building', 'building-2',       70),
  ('other',        'Other',               'ellipsis',         90)
on conflict (slug) do nothing;

create table public.facilities (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name                  text not null check (char_length(name) between 2 and 120),
  tagline               text check (tagline is null or char_length(tagline) <= 140),
  description           text check (description is null or char_length(description) <= 4000),
  category              text not null references public.facility_categories (slug) on update cascade,
  building_id           uuid references public.buildings (id) on delete set null,
  floor_label           text check (floor_label is null or char_length(floor_label) <= 40),
  image_url             text check (image_url is null or image_url ~ '^(https://|/)'),
  booking_mode          text not null default 'none' check (booking_mode in ('seat', 'capacity', 'none')),
  -- Used by capacity-based facilities. Seat-based capacity = number of active seats.
  capacity              integer check (capacity is null or capacity between 1 and 10000),
  slot_minutes          integer not null default 60  check (slot_minutes in (15, 30, 45, 60, 90, 120)),
  max_booking_minutes   integer not null default 180 check (max_booking_minutes between 15 and 720),
  no_show_grace_minutes integer not null default 15  check (no_show_grace_minutes between 5 and 120),
  checkin_early_minutes integer not null default 15  check (checkin_early_minutes between 0 and 120),
  rules                 text[] not null default '{}',
  is_active             boolean not null default true,
  is_temporarily_closed boolean not null default false,
  closure_note          text check (closure_note is null or char_length(closure_note) <= 200),
  lat                   double precision check (lat is null or lat between -90 and 90),
  lng                   double precision check (lng is null or lng between -180 and 180),
  map_x                 numeric(5,2) check (map_x is null or map_x between 0 and 100),
  map_y                 numeric(5,2) check (map_y is null or map_y between 0 and 100),
  is_demo               boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint facilities_capacity_required check (booking_mode <> 'capacity' or capacity is not null),
  constraint facilities_slot_fits check (max_booking_minutes >= slot_minutes),
  constraint facilities_latlng_pair check ((lat is null) = (lng is null))
);
create index facilities_category_idx on public.facilities (category);
create index facilities_building_idx on public.facilities (building_id);

create table public.facility_operating_hours (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  opens_at    time not null default '08:00',
  closes_at   time not null default '20:00',
  is_closed   boolean not null default false,
  constraint facility_hours_unique unique (facility_id, weekday),
  constraint facility_hours_order check (is_closed or opens_at < closes_at)
);

create table public.facility_amenities (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 60),
  icon        text not null default 'check',
  sort_order  integer not null default 100,
  constraint facility_amenities_unique unique (facility_id, label)
);

create table public.facility_seats (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  label       text not null check (label ~ '^[A-Za-z0-9-]{1,10}$'),
  row_label   text not null check (row_label ~ '^[A-Za-z0-9]{1,4}$'),
  col_index   integer not null check (col_index between 1 and 200),
  status      text not null default 'active' check (status in ('active', 'maintenance', 'disabled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint facility_seats_label_unique unique (facility_id, label),
  constraint facility_seats_position_unique unique (facility_id, row_label, col_index)
);

-- ─── Reservations ───────────────────────────────────────────────────────────
create table public.reservations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  facility_id    uuid not null references public.facilities (id) on delete restrict,
  seat_id        uuid references public.facility_seats (id) on delete restrict,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  status         text not null default 'BOOKED'
                 check (status in ('BOOKED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'EXPIRED', 'NO_SHOW')),
  checked_in_at  timestamptz,
  checked_out_at timestamptz,
  cancelled_at   timestamptz,
  cancelled_by   uuid references public.profiles (id) on delete set null,
  cancel_reason  text check (cancel_reason is null or char_length(cancel_reason) <= 200),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint reservations_time_order check (ends_at > starts_at),
  constraint reservations_checkin_state check (status not in ('CHECKED_IN', 'CHECKED_OUT') or checked_in_at is not null),
  constraint reservations_checkout_state check (status <> 'CHECKED_OUT' or checked_out_at is not null),
  -- No two live reservations may hold the same seat at overlapping times.
  constraint reservations_no_seat_overlap exclude using gist (
    seat_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (seat_id is not null and status in ('BOOKED', 'CHECKED_IN')),
  -- A student can't hold two live reservations at overlapping times.
  constraint reservations_no_user_overlap exclude using gist (
    user_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('BOOKED', 'CHECKED_IN'))
);
create index reservations_facility_time_idx on public.reservations (facility_id, starts_at);
create index reservations_user_status_idx on public.reservations (user_id, status);
create index reservations_live_idx on public.reservations (status, ends_at) where status in ('BOOKED', 'CHECKED_IN');

-- ─── Favorites ──────────────────────────────────────────────────────────────
create table public.favorites (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  facility_id uuid not null references public.facilities (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, facility_id)
);
create index favorites_facility_idx on public.favorites (facility_id);

-- ─── QR codes ───────────────────────────────────────────────────────────────
-- The token is an opaque random identifier. It carries no student data and no
-- credentials; all meaning is resolved server-side by scan_facility().
create table public.facility_qr_codes (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  token       text not null unique check (token ~ '^[A-Za-z0-9_-]{16,64}$'),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create unique index facility_qr_one_active on public.facility_qr_codes (facility_id) where is_active;

create table public.qr_scan_events (
  id             bigint generated always as identity primary key,
  user_id        uuid references public.profiles (id) on delete set null,
  facility_id    uuid references public.facilities (id) on delete set null,
  reservation_id uuid references public.reservations (id) on delete set null,
  action         text not null check (action in ('scan', 'checkout')),
  result         text not null,
  created_at     timestamptz not null default now()
);
create index qr_scan_events_user_time_idx on public.qr_scan_events (user_id, created_at desc);

-- ─── OTP request log (server-only rate limiting) ────────────────────────────
create table public.otp_requests (
  id         bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash    text,
  created_at timestamptz not null default now()
);
create index otp_requests_email_idx on public.otp_requests (email_hash, created_at desc);
create index otp_requests_ip_idx on public.otp_requests (ip_hash, created_at desc);

-- ─── Realtime change signal ─────────────────────────────────────────────────
-- Clients subscribe to this table and re-fetch availability through RPCs when
-- a facility's version changes. Private reservation rows are never broadcast.
create table public.facility_live (
  facility_id uuid primary key references public.facilities (id) on delete cascade,
  version     bigint not null default 0,
  updated_at  timestamptz not null default now()
);

-- ─── Admin audit log ────────────────────────────────────────────────────────
create table public.admin_audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
create index admin_audit_logs_time_idx on public.admin_audit_logs (created_at desc);
create index admin_audit_logs_entity_idx on public.admin_audit_logs (entity_type, entity_id);
