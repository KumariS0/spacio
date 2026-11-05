-- ════════════════════════════════════════════════════════════════════════════
-- SPACIO · 0004 · Supabase platform wiring
-- Each block checks that the platform feature exists first, so these
-- migrations also run on plain Postgres (used by the automated SQL tests).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Auth hook permissions ──────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema public to supabase_auth_admin;
    grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
  end if;
end $$;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

-- ─── Realtime: broadcast the change-signal table only ───────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'facility_live'
    ) then
      alter publication supabase_realtime add table public.facility_live;
    end if;
  end if;
end $$;

-- ─── Storage: facility images (public read, admin write) ────────────────────
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('facility-images', 'facility-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update
      set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute $p$ create policy "facility images admin insert" on storage.objects for insert to authenticated
      with check (bucket_id = 'facility-images' and public.is_admin()) $p$;
    execute $p$ create policy "facility images admin update" on storage.objects for update to authenticated
      using (bucket_id = 'facility-images' and public.is_admin()) with check (bucket_id = 'facility-images' and public.is_admin()) $p$;
    execute $p$ create policy "facility images admin delete" on storage.objects for delete to authenticated
      using (bucket_id = 'facility-images' and public.is_admin()) $p$;
  end if;
end $$;

-- ─── Scheduled sweep (no-shows / overstays) via pg_cron, when available ─────
-- The app also sweeps lazily on every booking/scan, and /api/cron/sweep can be
-- called by an external scheduler, so this is an optimisation, not a must.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.unschedule(jobid) from cron.job where jobname = 'spacio-sweep-reservations';
      perform cron.schedule('spacio-sweep-reservations', '* * * * *', 'select public.sweep_reservations()');
    exception when others then
      raise notice 'pg_cron not configured (%). Use /api/cron/sweep instead.', sqlerrm;
    end;
  end if;
end $$;
