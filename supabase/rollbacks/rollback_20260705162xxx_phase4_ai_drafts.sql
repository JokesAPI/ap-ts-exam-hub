-- ROLLBACK for 20260705162849_phase4_publish_approve_reject_functions
-- and     20260705162807_phase4_ai_drafts_core_schema
-- Run this only if BOTH phase4 migrations are being reversed together
-- (and only after phase5 rollback has already run, since phase5 objects
-- depend on these tables).
--
-- WARNING: drops ai_drafts and ai_draft_logs INCLUDING ALL DATA.
-- Export first if any drafts/audit history matter:
--   copy (select * from ai_drafts)     to stdout with csv header;
--   copy (select * from ai_draft_logs) to stdout with csv header;

begin;

-- ── 20260705162849: publish/approve/reject functions ──
drop function if exists public.publish_draft(uuid, uuid);
drop function if exists public.approve_draft(uuid, uuid, text);
drop function if exists public.reject_draft(uuid, uuid, text);

-- ── 20260705162807: core schema ──
drop function if exists public.validate_draft(uuid);
drop function if exists public.check_duplicate_draft(text, text, text, text);

-- ai_draft_logs references ai_drafts (on delete cascade) — drop child first
drop table if exists ai_draft_logs;
drop table if exists ai_drafts;

-- pg_trgm: left installed intentionally. Other features may use it and
-- dropping an extension is cluster-wide impact. Uncomment only if certain:
-- drop extension if exists pg_trgm;

commit;
