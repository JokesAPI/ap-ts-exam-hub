-- ============================================================================
-- Phase 9 — Indian Geography mock test destination
--
-- Adds exactly one public.mock_tests catalog row so the completed Indian
-- Geography QuestionBank batch (IGEO-IIGP-001, Q01-Q50, validator PASS) has a
-- valid import destination. AdminQuestions.jsx's bulkImport() and the AI
-- draft publish path (publish_draft(), 20260721045809_...sql) both require a
-- matching public.mock_tests.test_id to exist before any question can be
-- inserted -- today neither does, so the batch is blocked on catalog data,
-- not code.
--
-- No schema change: mock_tests already has every column this row needs
-- (create table in 20260711164633_phase4_access_tiers.sql, plus the
-- duration_minutes / negative_mark_per_wrong columns added in
-- 20260722100000_phase7_5a_mock_test_metadata.sql). Both are left NULL here,
-- same as all 8 existing rows -- NULL is "use the legacy hardcoded engine
-- default," not an accidental gap.
--
-- is_active = false is deliberate, not a placeholder. The batch has not been
-- imported, reviewed, or published yet. mock_tests_select_public only
-- exposes is_active = true rows, and loadTestCatalog() (src/lib/
-- officialTests.js) filters on the same column -- so this row stays
-- completely invisible on the public catalog until a separate, later,
-- explicit activation migration/change flips it to true. Without this, a
-- visible tile with zero published questions would hit
-- loadOfficialQuestions()'s "No questions are available for this test yet."
-- error the moment a student opened it.
--
-- Guarded insert, not a bare INSERT: if a row with this test_id already
-- exists (e.g. a prior manual/partial attempt), the INSERT ... WHERE NOT
-- EXISTS below is silently skipped rather than erroring or overwriting --
-- so the mandatory post-insert assertion is what actually enforces "fail
-- loudly on conflict." If a pre-existing row's values don't exactly match
-- the approved identity, the assertion raises and the migration aborts with
-- no row modified. If a pre-existing row already matches exactly (replaying
-- this migration), the assertion passes and nothing changes -- idempotent.
-- There is no UPDATE anywhere in this file: an existing row is never
-- silently altered under any circumstance.
--
-- Does not touch any of the 8 existing mock_tests rows (ap-geography
-- included), does not touch mock_questions, and does not touch any RLS
-- policy, constraint, index, or grant.
-- ============================================================================

insert into public.mock_tests (
  test_id, title, subject, access_tier, is_active, display_order
)
select
  'indian-geography', 'Indian Geography', 'Indian Geography', 'free', false, 9
where not exists (
  select 1 from public.mock_tests where test_id = 'indian-geography'
);

do $$
begin
  if not exists (
    select 1
    from public.mock_tests
    where test_id = 'indian-geography'
      and title = 'Indian Geography'
      and subject = 'Indian Geography'
      and access_tier = 'free'
      and is_active = false
      and display_order = 9
  ) then
    raise exception
      'phase9_indian_geography_destination: a public.mock_tests row with '
      'test_id = ''indian-geography'' either does not match the approved '
      'identity (title/subject/access_tier/is_active/display_order) or '
      'failed to insert. A conflicting pre-existing row is the likely '
      'cause. Aborting -- no row was modified by this migration.';
  end if;
end $$;
