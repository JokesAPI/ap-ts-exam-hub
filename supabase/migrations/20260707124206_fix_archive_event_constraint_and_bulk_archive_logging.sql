-- Fix: bulk_archive_drafts() was 100% broken.
--
-- Bug 1 (reported): it logs event='archived', but ai_draft_logs_event_check
--   (from 20260705162807, never altered) does not allow 'archived', so every
--   call raises a check violation and rolls back.
-- Bug 2 (latent, found in this audit): the log insert writes a row for EVERY
--   id in p_draft_ids, not just rows actually archived. Once Bug 1 is fixed,
--   this (a) creates false 'archived' audit entries for drafts skipped due to
--   ineligible status, and (b) violates the ai_draft_logs.draft_id foreign key
--   whenever a passed id no longer exists in ai_drafts, rolling back the call.
--
-- Fix: (1) extend the event check constraint with 'archived';
--      (2) redefine bulk_archive_drafts to log only rows actually archived,
--          via UPDATE ... RETURNING. Identity/admin guards unchanged.
-- CREATE OR REPLACE preserves existing grants; the explicit grant below is
-- idempotent belt-and-braces.

begin;

alter table ai_draft_logs drop constraint if exists ai_draft_logs_event_check;
alter table ai_draft_logs add constraint ai_draft_logs_event_check
  check (event in (
    'scraped', 'ai_generated', 'duplicate_detected', 'validated',
    'validation_failed', 'approved', 'rejected', 'published',
    'publish_failed', 'retry', 'archived'
  ));

create or replace function public.bulk_archive_drafts(p_draft_ids uuid[], p_admin_id uuid)
returns int
language plpgsql
security definer
as $$
declare
  archived_ids uuid[];
begin
  if p_admin_id is distinct from auth.uid() then
    raise exception 'Not permitted: p_admin_id must match the authenticated caller.';
  end if;
  if not coalesce((select is_admin from profiles where id = p_admin_id), false) then
    raise exception 'Not permitted: only admins can archive drafts.';
  end if;

  with updated as (
    update ai_drafts set status = 'archived', updated_at = now()
    where id = any(p_draft_ids) and status in ('rejected', 'published')
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into archived_ids from updated;

  insert into ai_draft_logs (draft_id, event, actor, details)
  select unnest(archived_ids), 'archived', p_admin_id::text, jsonb_build_object('bulk', true);

  return coalesce(array_length(archived_ids, 1), 0);
end;
$$;

grant execute on function bulk_archive_drafts(uuid[], uuid) to authenticated;

commit;
