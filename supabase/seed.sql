-- ════════════════════════════════════════════════════════════════════════════
-- SPACIO · Demonstration seed data
--
-- EVERYTHING BELOW IS ILLUSTRATIVE DEMO DATA (is_demo = true).
-- Names, capacities, floors, hours, seat counts and map positions are NOT
-- verified SRM infrastructure. No geographic coordinates are seeded; facilities
-- appear on the schematic map only. Replace or edit all of it from the admin
-- dashboard before real use.
-- `════════════════════════════════════════════════════════════════════════════`

insert into public.buildings (name, code, description, map_x, map_y, is_demo) values
  -- Building names below were provided by the project owner. Map X/Y are
  -- schematic positions only (not geographic coordinates).
  ('UB Building',               'UB',       null, 34, 30, false),
  ('Girls Hostel M Block',      'GH-M',     null, 38, 36, false),
  ('Main Ground',               'MG',       null, 18, 64, false),
  ('Demo Learning Commons',     'DEMO-LC',  'Demonstration building record. Edit in Admin → Buildings.', 62, 46, true),
  ('BEL Block',                 'BEL',      null, 78, 22, false),
  ('TP Ganesan Auditorium',     'TPG',      null, 70, 76, false)
on conflict do nothing;

insert into public.facilities
  (slug, name, tagline, description, category, building_id, floor_label, image_url, booking_mode, capacity,
   slot_minutes, max_booking_minutes, no_show_grace_minutes, checkin_early_minutes, rules, map_x, map_y, is_demo)
values
  ('central-library', 'Central Library', 'Quiet seats for focused study.',
   'A quiet reading hall with individual study seats. Reserve a specific seat, scan the library QR at the entrance to check in, and scan it again when you leave so the seat is released for someone else.',
   'library', (select id from public.buildings where code = 'UB'), 'Ground floor', '/images/library.webp',
   'seat', null, 60, 180, 15, 15,
   array['Keep your phone on silent', 'Check in within 15 minutes of your start time or the seat is released', 'Scan out when you leave', 'No food at the desks'],
   34, 30, true),
  ('reading-room', 'Reading Room', 'Smaller, quieter, by the windows.',
   'A compact reading room for silent study. Seats are reserved individually.',
   'reading_room', (select id from public.buildings where code = 'GH-M'), 'First floor', null,
   'seat', null, 60, 120, 15, 15,
   array['Silence at all times', 'Check in within 15 minutes of your start time'],
   38, 36, true),
  ('fitness-centre', 'Fitness Centre', 'Stay active between classes.',
   'Free weights, cardio machines and open floor space. Book a time slot, then scan the QR at the entrance to check in and again when you leave.',
   'gym', (select id from public.buildings where code = 'MG'), 'Ground floor', '/images/gym.webp',
   'capacity', 100, 60, 120, 15, 10,
   array['Carry your student ID', 'Bring a towel and a water bottle', 'Re-rack weights after use'],
   18, 64, true),
  ('study-commons', 'Study Commons', 'Open tables for group work.',
   'Open-plan tables suitable for group study. Book a place for a time slot; tables are first-come within the space.',
   'study_room', (select id from public.buildings where code = 'DEMO-LC'), 'Second floor', null,
   'capacity', 40, 30, 120, 10, 10,
   array['Keep discussions at a low volume', 'Clean up your table when you leave'],
   62, 46, true),
  ('computer-lab', 'Computer Lab', 'Workstations for coursework.',
   'Lab workstations for coursework and practice. Book a place for a time slot.',
   'lab', (select id from public.buildings where code = 'BEL'), 'Third floor', null,
   'capacity', 30, 60, 180, 15, 10,
   array['No food or drinks near the workstations', 'Log out of every account before leaving'],
   78, 22, true),
  ('main-auditorium', 'Main Auditorium', 'Events and guest lectures.',
   'Location information only — the auditorium is not bookable through SPACIO.',
   'auditorium', (select id from public.buildings where code = 'TPG'), 'Ground floor', null,
   'none', null, 60, 180, 15, 15, '{}',
   70, 76, true)
on conflict (slug) do nothing;

-- Opening hours: every space opens at 08:00 and closes at 22:00, all week.
insert into public.facility_operating_hours (facility_id, weekday, opens_at, closes_at, is_closed)
select f.id, d.weekday, time '08:00', time '22:00', false
from public.facilities f
cross join generate_series(0, 6) as d(weekday)
where f.is_demo
on conflict (facility_id, weekday) do nothing;

insert into public.facility_amenities (facility_id, label, icon, sort_order)
select f.id, a.label, a.icon, a.ord
from public.facilities f
join (values
  ('central-library', 'Wi-Fi', 'wifi', 1), ('central-library', 'Charging points', 'plug', 2),
  ('central-library', 'Air conditioned', 'snowflake', 3), ('central-library', 'Silent zone', 'volume-x', 4),
  ('reading-room', 'Wi-Fi', 'wifi', 1), ('reading-room', 'Natural light', 'sun', 2),
  ('fitness-centre', 'Weights', 'dumbbell', 1), ('fitness-centre', 'Cardio', 'heart-pulse', 2),
  ('fitness-centre', 'Lockers', 'lock', 3), ('fitness-centre', 'Showers', 'shower-head', 4),
  ('study-commons', 'Wi-Fi', 'wifi', 1), ('study-commons', 'Whiteboards', 'presentation', 2),
  ('study-commons', 'Charging points', 'plug', 3),
  ('computer-lab', 'Workstations', 'monitor', 1), ('computer-lab', 'Printing', 'printer', 2),
  ('main-auditorium', 'Projector', 'projector', 1), ('main-auditorium', 'Accessible seating', 'accessibility', 2)
) as a(slug, label, icon, ord) on a.slug = f.slug
on conflict (facility_id, label) do nothing;

-- Seats: Central Library 4 rows × 6 (A01–D06); Reading Room 2 rows × 8.
insert into public.facility_seats (facility_id, label, row_label, col_index)
select f.id, chr(64 + r) || lpad(c::text, 2, '0'), chr(64 + r), c
from public.facilities f
cross join generate_series(1, 4) r
cross join generate_series(1, 6) c
where f.slug = 'central-library'
on conflict do nothing;

insert into public.facility_seats (facility_id, label, row_label, col_index)
select f.id, chr(64 + r) || lpad(c::text, 2, '0'), chr(64 + r), c
from public.facilities f
cross join generate_series(1, 2) r
cross join generate_series(1, 8) c
where f.slug = 'reading-room'
on conflict do nothing;

-- One seat under maintenance, to demonstrate the grey state.
update public.facility_seats set status = 'maintenance'
where label = 'D06' and facility_id = (select id from public.facilities where slug = 'central-library');

-- QR tokens for every facility (opaque, random per database).
insert into public.facility_qr_codes (facility_id, token)
select f.id, public.generate_qr_token()
from public.facilities f
where not exists (select 1 from public.facility_qr_codes q where q.facility_id = f.id and q.is_active);
