-- Scheduler hardening: atomic run acquisition with concurrency guard,
-- stale-run sweep (timeout handling), and source registration.
--
-- Why: the collector's start_run() blindly inserted an automation_runs row,
-- so two overlapping executions (scheduled + manual) could race the
-- duplicate check and create duplicate drafts. A crashed job also left
-- finished_at NULL forever. This function fixes both at the database layer
-- so EVERY execution path (GitHub Actions, manual local run) is protected,
-- not just CI-scheduled ones.
--
-- Behavior:
--   1. pg_advisory_xact_lock serializes concurrent callers per source.
--   2. Unfinished runs older than p_stale_after_minutes are closed as
--      failed ("marked stale...") so a killed job cannot deadlock the
--      pipeline.
--   3. If a live (non-stale) run is still in flight -> returns NULL;
--      the caller must exit without doing anything.
--   4. Otherwise inserts the run row, registers the source in
--      automation_sources (no-op if present), and returns the run id.
--
-- Callers: the collector only (service role). Not exposed to anon or
-- authenticated -- run acquisition is not an app-facing operation.

begin;

create or replace function public.begin_automation_run(
  p_source_name text,
  p_connector_type text,
  p_source_url text default null,
  p_stale_after_minutes integer default 30
)
returns uuid
language plpgsql
security definer
as $$
declare
  new_run_id uuid;
begin
  -- Serialize concurrent callers for this source. Transaction-scoped:
  -- released automatically at commit/rollback, cannot leak.
  perform pg_advisory_xact_lock(hashtext('automation_run:' || p_source_name));

  -- Timeout handling: close out crashed/killed runs so they cannot hold
  -- the logical lock forever.
  update automation_runs
     set finished_at = now(),
         success = false,
         error_message = format(
           'marked stale by begin_automation_run: unfinished after %s minutes',
           p_stale_after_minutes)
   where source_name = p_source_name
     and finished_at is null
     and started_at < now() - make_interval(mins => p_stale_after_minutes);

  -- Concurrency guard: refuse while a live run is in flight.
  if exists (
    select 1 from automation_runs
    where source_name = p_source_name and finished_at is null
  ) then
    return null;
  end if;

  insert into automation_runs (source_name, connector_type, started_at)
  values (p_source_name, p_connector_type, now())
  returning id into new_run_id;

  insert into automation_sources (name, source_type, url)
  values (p_source_name, p_connector_type, p_source_url)
  on conflict (name) do nothing;

  return new_run_id;
end;
$$;

-- create function grants execute to PUBLIC by default -- lock it down.
revoke execute on function public.begin_automation_run(text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.begin_automation_run(text, text, text, integer)
  to service_role;

commit;
