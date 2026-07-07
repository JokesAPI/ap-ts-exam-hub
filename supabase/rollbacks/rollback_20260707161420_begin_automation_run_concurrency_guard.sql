-- ROLLBACK for 20260707161420_begin_automation_run_concurrency_guard
--
-- Drops the run-acquisition function. Pure function drop: no tables, no
-- columns, no data are touched by this rollback.
--
-- WARNING — coupled code change:
--   The collector (scripts/generate_current_affairs_v2.py, from the same
--   commit) calls begin_automation_run() at startup and will FAIL on the
--   next execution if this function is dropped. Rolling back this migration
--   only makes sense together with reverting that commit (which restores
--   the old direct-insert start_run) AND disabling/adjusting the GitHub
--   Actions workflow that assumes the concurrency guard exists.
--
--   Dropping this function removes:
--     * the per-source concurrency guard (overlapping runs become possible
--       again, which can race duplicate detection), and
--     * the stale-run sweep (crashed runs stay unfinished forever).

begin;

drop function if exists public.begin_automation_run(text, text, text, integer);

commit;
