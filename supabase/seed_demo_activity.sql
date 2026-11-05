-- OPTIONAL demonstration activity for the admin check-in / check-out log.
--
-- Creates eight FICTIONAL students (emails end in .invalid, which can never
-- receive mail or belong to a real person; profiles are flagged is_demo) and
-- a few hours of check-ins and check-outs ending around the time you run it.
-- Run after seed.sql. Safe to re-run: it removes its own previous rows first.
-- Remove everything it created with the DELETE block at the bottom.

do $$
declare
  n timestamptz := now();
  v_ids uuid[];
begin
  -- Clear a previous run.
  delete from public.reservations where user_id in (select id from public.profiles where is_demo);
  delete from auth.users where id in (select id from public.profiles where is_demo);

  with demo(email, name) as (
    values
      ('aarav.sharma@demo.spacio.invalid', 'Aarav Sharma'),
      ('meera.iyer@demo.spacio.invalid',   'Meera Iyer'),
      ('rohan.das@demo.spacio.invalid',    'Rohan Das'),
      ('priya.nair@demo.spacio.invalid',   'Priya Nair'),
      ('kabir.singh@demo.spacio.invalid',  'Kabir Singh'),
      ('ananya.rao@demo.spacio.invalid',   'Ananya Rao'),
      ('vikram.menon@demo.spacio.invalid', 'Vikram Menon'),
      ('sara.thomas@demo.spacio.invalid',  'Sara Thomas')
  ), ins as (
    insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
    select gen_random_uuid(), d.email, n, jsonb_build_object('full_name', d.name) from demo d
    returning id, email
  )
  select array_agg(id order by email) into v_ids from ins;

  update public.profiles set is_demo = true where email like '%@demo.spacio.invalid';

  -- Fill the columns Supabase Auth expects, so these rows behave like normal
  -- (password-less, never-signed-in) users in the dashboard and the Auth API.
  -- Only columns that exist are touched, so this also runs on a bare schema.
  declare col text;
  begin
    for col in
      select column_name from information_schema.columns
      where table_schema = 'auth' and table_name = 'users'
        and column_name in ('confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change',
                            'email_change_token_current', 'phone_change', 'phone_change_token', 'reauthentication_token')
    loop
      execute format('update auth.users set %I = coalesce(%I, '''') where id = any($1)', col, col) using v_ids;
    end loop;
    -- No password (empty, as for users who only sign in with a code) and real timestamps.
    if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'encrypted_password') then
      execute 'update auth.users set encrypted_password = coalesce(encrypted_password, '''') where id = any($1)' using v_ids;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'updated_at') then
      execute 'update auth.users set created_at = coalesce(created_at, $2), updated_at = coalesce(updated_at, $2) where id = any($1)' using v_ids, n - interval '1 day';
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'instance_id') then
      execute 'update auth.users set instance_id = coalesce(instance_id, ''00000000-0000-0000-0000-000000000000'') where id = any($1)' using v_ids;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'aud') then
      execute 'update auth.users set aud = coalesce(aud, ''authenticated''), role = coalesce(role, ''authenticated'') where id = any($1)' using v_ids;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'raw_app_meta_data') then
      execute 'update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, ''{"provider":"email","providers":["email"]}''::jsonb) where id = any($1)' using v_ids;
    end if;
  end;

  -- (student, facility, seat, start, end, status, checked in, checked out)
  insert into public.reservations (user_id, facility_id, seat_id, starts_at, ends_at, status, checked_in_at, checked_out_at, created_at)
  select p.id, f.id, s.id, n + x.s_off, n + x.e_off, x.status, n + x.in_off, n + x.out_off, n + x.s_off - interval '1 day'
  from (values
    ('aarav.sharma',  'central-library', 'A02', interval '-60 min',  interval '60 min',  'CHECKED_IN',  interval '-56 min',  null::interval),
    ('meera.iyer',    'fitness-centre',  null,  interval '-120 min', interval '-60 min', 'CHECKED_OUT', interval '-118 min', interval '-64 min'),
    ('rohan.das',     'reading-room',    'A05', interval '-30 min',  interval '90 min',  'CHECKED_IN',  interval '-27 min',  null),
    ('priya.nair',    'study-commons',   null,  interval '-180 min', interval '-90 min', 'CHECKED_OUT', interval '-178 min', interval '-95 min'),
    ('kabir.singh',   'central-library', 'B04', interval '-150 min', interval '-30 min', 'CHECKED_OUT', interval '-146 min', interval '-33 min'),
    ('ananya.rao',    'computer-lab',    null,  interval '-20 min',  interval '100 min', 'CHECKED_IN',  interval '-12 min',  null),
    ('vikram.menon',  'fitness-centre',  null,  interval '-45 min',  interval '15 min',  'CHECKED_IN',  interval '-41 min',  null),
    ('sara.thomas',   'reading-room',    'B02', interval '-240 min', interval '-120 min','EXPIRED',     interval '-236 min', interval '-120 min'),
    ('meera.iyer',    'central-library', 'C03', interval '-50 min',  interval '70 min',  'CHECKED_IN',  interval '-48 min',  null),
    ('kabir.singh',   'study-commons',   null,  interval '-25 min',  interval '35 min',  'CHECKED_IN',  interval '-22 min',  null)
  ) as x(handle, slug, seat, s_off, e_off, status, in_off, out_off)
  join public.profiles p on p.email = x.handle || '@demo.spacio.invalid'
  join public.facilities f on f.slug = x.slug
  left join public.facility_seats s on s.facility_id = f.id and s.label = x.seat
  where f.is_active;
end $$;

-- To remove all demo activity later, run:
--   delete from public.reservations where user_id in (select id from public.profiles where is_demo);
--   delete from auth.users where id in (select id from public.profiles where is_demo);
