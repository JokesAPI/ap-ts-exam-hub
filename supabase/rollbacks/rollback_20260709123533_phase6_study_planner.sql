-- ROLLBACK for 20260709123533_phase6_study_planner
-- Drops the two study-planner tables (and their tasks via cascade), the
-- trigger function, policies, and indexes. Deletes all study-plan data.
-- No other tables are affected.

begin;

drop policy if exists "study_plan_tasks_own" on public.study_plan_tasks;
drop policy if exists "study_plans_own" on public.study_plans;

drop trigger if exists trg_study_plans_updated_at on public.study_plans;

drop table if exists public.study_plan_tasks;   -- child first
drop table if exists public.study_plans;

drop function if exists public.study_plans_touch_updated_at();

commit;
