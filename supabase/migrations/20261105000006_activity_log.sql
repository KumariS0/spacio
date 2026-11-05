-- Admin check-in / check-out activity log.
-- Derived from reservations (checked_in_at / checked_out_at), so it can never
-- disagree with the real booking state. Admins only: it names students.

alter table public.profiles add column if not exists is_demo boolean not null default false;
comment on column public.profiles.is_demo is 'Fictional account created by supabase/seed_demo_activity.sql. Never a real student.';

create or replace function public.admin_recent_activity(p_limit integer default 25)
returns table (
  event_at       timestamptz,
  kind           text,          -- 'in' | 'out' | 'auto_out' (session ended without a check-out scan)
  reservation_id uuid,
  student_name   text,
  student_email  text,
  is_demo        boolean,
  facility_name  text,
  facility_slug  text,
  building_name  text,
  floor_label    text,
  seat_label     text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  return query
  with events as (
    select r.checked_in_at as at, 'in'::text as kind, r.*
      from public.reservations r
     where r.checked_in_at is not null
    union all
    select r.checked_out_at, case when r.status = 'EXPIRED' then 'auto_out' else 'out' end, r.*
      from public.reservations r
     where r.checked_out_at is not null and r.status in ('CHECKED_OUT', 'EXPIRED')
  )
  select e.at, e.kind, e.id, p.full_name, p.email, p.is_demo, f.name, f.slug, b.name, f.floor_label, s.label
    from events e
    join public.profiles p on p.id = e.user_id
    join public.facilities f on f.id = e.facility_id
    left join public.buildings b on b.id = f.building_id
    left join public.facility_seats s on s.id = e.seat_id
   where e.at <= now()
   order by e.at desc
   limit least(greatest(coalesce(p_limit, 25), 1), 200);
end $$;

revoke execute on function public.admin_recent_activity(integer) from public, anon;
grant execute on function public.admin_recent_activity(integer) to authenticated;

create index if not exists reservations_checked_in_idx on public.reservations (checked_in_at desc) where checked_in_at is not null;
create index if not exists reservations_checked_out_idx on public.reservations (checked_out_at desc) where checked_out_at is not null;
