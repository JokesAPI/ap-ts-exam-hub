-- ============================================================================
-- Phase 12 — mock_tests.questions_per_attempt (bounded random sampling)
--
-- Context: MockTestEngine.jsx currently loads and shows every published
-- mock_questions row for a test, in full, every attempt. For 100-question
-- destinations (Indian Geography, Indian History -- both already
-- is_active = true with 100 published rows each) this means every attempt is
-- the entire bank in a random order, not a bounded practice-test sample.
-- This migration adds a per-test questions_per_attempt column so the engine
-- can sample a configured number of questions per attempt.
--
-- questions_per_attempt is NOT NULL with a default of 25, unlike the Phase
-- 7.5A nullable overrides (duration_minutes / negative_mark_per_wrong):
-- there is no safe runtime distinction between "not configured" and "0" for
-- a row count, so NOT NULL DEFAULT 25 makes every row unambiguously valid on
-- its own. The client still normalizes defensively as a second, independent
-- layer (src/lib/mockAttemptSelection.js).
--
-- Idempotent and safe to re-run at any point, including after a partial
-- failure, AND safe to "re-run" conceptually after legitimate later admin
-- configuration changes (a row set to 10/50/100 by an admin is never
-- overwritten back to 25 -- the UPDATE below only ever touches NULLs):
--   - ADD COLUMN IF NOT EXISTS is a no-op if the column already exists.
--   - The UPDATE only touches rows still NULL (only possible from a partial
--     prior run, or -- structurally -- a row an admin has explicitly since
--     set to a positive value is never NULL, so it is never touched here).
--   - SET DEFAULT / SET NOT NULL are themselves idempotent no-ops when
--     already correct.
--   - The CHECK constraint is added inside a DO $$ guard keyed off
--     information_schema, so re-running never tries to re-add a constraint
--     that already exists.
--
-- Generic and reusable: applies uniformly to every row in public.mock_tests.
-- Does not name or special-case Indian Geography, Indian History, or any
-- other subject/test_id. Does not touch public.mock_questions.
-- ============================================================================

alter table public.mock_tests
  add column if not exists questions_per_attempt integer;

update public.mock_tests
set questions_per_attempt = 25
where questions_per_attempt is null;

alter table public.mock_tests
  alter column questions_per_attempt set default 25,
  alter column questions_per_attempt set not null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'mock_tests'
      and constraint_name = 'mock_tests_questions_per_attempt_check'
  ) then
    alter table public.mock_tests
      add constraint mock_tests_questions_per_attempt_check
        check (questions_per_attempt > 0);
  end if;
end $$;

comment on column public.mock_tests.questions_per_attempt is
  'Number of questions randomly sampled per attempt when the published pool '
  'exceeds this value. NOT NULL, default 25. Individual rows may legitimately '
  'be set to any positive value (10, 50, 100, ...) by a future admin action -- '
  'this migration guarantees every row starts at a valid positive default, '
  'not that every row stays at 25 forever.';

-- ── post-migration assertions -- abort loudly, not silently, on any drift ──
--
-- Permanent schema invariants ONLY: column shape, default, constraint
-- presence/definition, and "every row currently holds a positive value".
-- Deliberately does NOT assert every row equals 25 -- that is only true
-- immediately after this migration's first application and would wrongly
-- fail on a legitimate replay after an admin has since customized a row.
-- The "all rows = 25" check is a separate, one-time, first-application-only
-- verification step run outside this migration, not a migration invariant.
do $$
declare
  bad_count    integer;
  col_type     text;
  col_default  text;
  col_nullable text;
  check_def    text;
begin
  select data_type, column_default, is_nullable
    into col_type, col_default, col_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mock_tests'
      and column_name = 'questions_per_attempt';

  if col_type is null then
    raise exception 'phase12: questions_per_attempt column does not exist after migration';
  end if;
  if col_type <> 'integer' then
    raise exception 'phase12: questions_per_attempt has unexpected type %', col_type;
  end if;
  if col_nullable <> 'NO' then
    raise exception 'phase12: questions_per_attempt is nullable after migration';
  end if;
  if col_default is null or col_default not like '25%' then
    raise exception 'phase12: questions_per_attempt default is unexpected: %', col_default;
  end if;

  select pg_get_constraintdef(oid) into check_def
    from pg_constraint
    where conrelid = 'public.mock_tests'::regclass
      and conname = 'mock_tests_questions_per_attempt_check';

  if check_def is null then
    raise exception 'phase12: mock_tests_questions_per_attempt_check constraint is missing';
  end if;
  if check_def not ilike '%questions_per_attempt%' or check_def not ilike '%> 0%' then
    raise exception 'phase12: mock_tests_questions_per_attempt_check has unexpected definition: %', check_def;
  end if;

  select count(*) into bad_count
    from public.mock_tests
    where questions_per_attempt is null or questions_per_attempt <= 0;
  if bad_count > 0 then
    raise exception 'phase12: % row(s) have a null or non-positive questions_per_attempt', bad_count;
  end if;
end $$;
