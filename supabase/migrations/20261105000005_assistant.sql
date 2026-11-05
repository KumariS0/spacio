-- SPACIO assistant (AI chatbot) — per-student rate limiting.
-- The chatbot itself runs in the Next.js server and calls OpenRouter with a
-- server-only key. This table only records when each student sent a message,
-- so limits hold across serverless instances. No message content is stored.

create table public.assistant_requests (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index assistant_requests_user_time_idx on public.assistant_requests (user_id, created_at desc);

alter table public.assistant_requests enable row level security;
revoke all on public.assistant_requests from anon, authenticated;

-- Records one assistant request for the caller if they are under the limit.
-- Returns 0 when allowed, otherwise the number of seconds to wait.
create or replace function public.assistant_take_quota(p_limit integer default 20, p_window_seconds integer default 600)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_oldest timestamptz;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 200);
  v_window interval := make_interval(secs => least(greatest(coalesce(p_window_seconds, 600), 10), 86400));
begin
  if v_uid is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;
  if not public.is_verified_student() then
    raise exception using message = 'NOT_VERIFIED', errcode = 'P0001';
  end if;

  -- Serialise per user so parallel requests can't slip past the limit.
  perform pg_advisory_xact_lock(hashtextextended('assistant:' || v_uid::text, 0));

  select count(*), min(created_at) into v_count, v_oldest
    from public.assistant_requests
   where user_id = v_uid and created_at > now() - v_window;

  if v_count >= v_limit then
    return greatest(1, ceil(extract(epoch from (v_oldest + v_window - now())))::integer);
  end if;

  insert into public.assistant_requests (user_id) values (v_uid);
  -- Keep the table small: drop this user's rows older than a day.
  delete from public.assistant_requests where user_id = v_uid and created_at < now() - interval '1 day';
  return 0;
end $$;

revoke execute on function public.assistant_take_quota(integer, integer) from public, anon;
grant execute on function public.assistant_take_quota(integer, integer) to authenticated;
