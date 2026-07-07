-- ROLLBACK for 20260707124206_fix_archive_event_constraint_and_bulk_archive_logging
--
-- Restores the exact pre-migration state:
--   1. ai_draft_logs event check WITHOUT 'archived'
--   2. bulk_archive_drafts() to its 20260707014946 definition
--
-- WARNING — read before running:
--   * Step 1 is destructive: any ai_draft_logs rows with event='archived'
--     cannot exist under the restored constraint, so they are DELETED. This
--     removes audit history created after the fix. Export them first if you
--     need them (select * from ai_draft_logs where event='archived').
--   * The restored function is the KNOWN-BROKEN pre-fix version: every call
--     will fail again with a check violation. That is by definition what
--     rollback means here; only run this if the migration itself must be
--     reversed (e.g., as part of rolling back the whole phase).
--   * ai_drafts rows with status='archived' are untouched — 'archived' is a
--     legal ai_drafts status from 20260707014946 and is not part of this
--     migration's scope.

begin;

-- 1. Remove log rows that the old constraint forbids, then restore it.
delete from ai_draft_logs where event = 'archived';

alter table ai_draft_logs drop constraint if exists ai_draft_logs_event_check;
alter table ai_draft_logs add constraint ai_draft_logs_event_check
  check (event in (
    'scraped', 'ai_generated', 'duplicate_detected', 'validated',
    'validation_failed', 'approved', 'rejected', 'published',
    'publish_failed', 'retry'
  ));

-- 2. Restore the 20260707014946 function definition (verified against the
--    production pg_get_functiondef captured before this migration).
create or replace function public.bulk_archive_drafts(p_draft_ids uuid[], p_admin_id uuid)
returns int
language plpgsql
security definer
as $$
declare
  affected int;
begin
  if p_admin_id is distinct from auth.uid() then
    raise exception 'Not permitted: p_admin_id must match the authenticated caller.';
  end if;
  if not coalesce((select is_admin from profiles where id = p_admin_id), false) then
    raise exception 'Not permitted: only admins can archive drafts.';
  end if;
  update ai_drafts set status='archived', updated_at=now()
  where id = any(p_draft_ids) and status in ('rejected', 'published');
  get diagnostics affected = row_count;
  insert into ai_draft_logs (draft_id, event, actor, details)
  select unnest(p_draft_ids), 'archived', p_admin_id::text, jsonb_build_object('bulk', true);
  return affected;
end;
$$;

grant execute on function bulk_archive_drafts(uuid[], uuid) to authenticated;

commit;
