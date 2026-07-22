-- ROLLBACK for 20260722100000_phase7_5a_mock_test_metadata
--
-- Safe to run at any time: both columns are nullable and were added with no
-- default, so no data was backfilled into them by the forward migration --
-- dropping them cannot lose information that existed before this migration.
--
-- If any row has since had duration_minutes / negative_mark_per_wrong
-- deliberately set by an admin, dropping the columns will discard those
-- values. Confirm with `select test_id, duration_minutes,
-- negative_mark_per_wrong from public.mock_tests where duration_minutes is
-- not null or negative_mark_per_wrong is not null;` before rolling back in a
-- production window where that might have happened.
--
-- The frontend (officialTests.js / MockTestEngine.jsx) already treats a
-- missing/NULL value as "use the legacy hardcoded constant", so once these
-- columns are gone the app returns to its pre-Phase-7.5A behaviour with no
-- further code changes required, PROVIDED the corresponding frontend patch
-- is also reverted (this rollback only covers the database side).

alter table public.mock_tests
  drop constraint if exists mock_tests_duration_minutes_check,
  drop constraint if exists mock_tests_negative_mark_per_wrong_check;

alter table public.mock_tests
  drop column if exists duration_minutes,
  drop column if exists negative_mark_per_wrong;
