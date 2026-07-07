-- PROPOSED MIGRATION — NOT YET APPLIED — awaiting approval
-- Name: automation_runs_records_rejected
--
-- Task 3 requires collectors to log a "rejected" count per run.
-- automation_runs currently has records_collected, records_drafted,
-- duplicate_count, retry_count — but no column for drafts that failed
-- the validate_draft() quality gate.
--
-- The collector already tolerates this column's absence (it retries the
-- run-finalize write without the field), so this can be applied any time
-- with zero deploy coordination.

alter table automation_runs
  add column if not exists records_rejected integer default 0;

comment on column automation_runs.records_rejected is
  'Drafts created this run that failed validate_draft() and need admin attention.';

-- ROLLBACK:
-- alter table automation_runs drop column if exists records_rejected;

-- NOTE on "duration": intentionally NOT adding a duration column.
-- It is derivable and adding it would create a second source of truth:
--   select *, finished_at - started_at as duration from automation_runs;
-- The health dashboard should compute it in the query.
