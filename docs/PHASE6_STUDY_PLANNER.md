# Phase 6 — AI Study Planner

**Date:** 2026-07-10 · **Branch:** v2-development · Base: `bae7131`
**Branding:** website remains **AP TS Exam Hub**; TG used for official
Telangana entities (TGPSC, TG DSC, TG Police in prompts).

## Audit summary

Phases 1–5 present at HEAD `bae7131`. A parallel session had applied the
Phase 6 database migration to production and left mostly-complete uncommitted
frontend work. This delivery **consolidates** (Option A): adopt the existing
normalized production schema, reconcile the repo, review the frontend, and
fix the one real bug it left behind.

## Database — reconciled (not newly created here)

Production already had, via migration `20260709123533_phase6_study_planner`:
- `study_plans` (id, **user_id → auth.users**, exam_id → exams, status,
  start_date, target_exam_date, daily_minutes, timestamps + updated_at
  trigger).
- `study_plan_tasks` (id, **study_plan_id → study_plans**, day_number,
  task_type, subject, topic, estimated_minutes, completed, completed_at,
  sort_order, created_at) — **no user_id** (owned transitively via the plan).
- RLS: `study_plans_own` (`auth.uid() = user_id`); `study_plan_tasks_own`
  (subquery: parent plan's `user_id = auth.uid()`). Grants to authenticated;
  anon revoked.

**Reconciliation performed:**
- Removed my earlier conflicting migration (which assumed `study_plan_tasks.
  user_id`) and a stray bookkeeping row I had inserted.
- Renamed the canonical migration + rollback files to the production version
  `20260709123533` so repo == production history (one Phase 6 entry).
- Verified the repo migration body is byte-identical to production's stored
  statements (only doc-comments differ, which Postgres strips from
  `statements`).
- Re-verified RLS under the parent-plan ownership model and idempotency
  (`create ... if not exists`, `create or replace`). Rollback drops both
  tables (child first), trigger, function, policies.
- No production data modified (all tests run in rolled-back transactions).

## Frontend (adopted from the parallel session; duplication removed; bug fixed)

- `src/lib/studyPlanner.js` — AI plan generation via the existing `callGroq`
  abstraction; derives weak/strong subjects from real `mock_results` (reuses
  `mockStats.aggregateSubjects`); archives any prior active plan; inserts
  tasks with **`study_plan_id` only** (schema-correct). I removed a duplicate
  `studyPlan.js` I had started, per "don't duplicate utilities".
- `src/pages/public/StudyPlanner.jsx` — `/study-planner`, **lazy-loaded**
  (own 11.86 kB chunk). Intake (daily hours), generate, list + calendar
  views, per-task completion (optimistic with rollback), progress %,
  streak, days-to-exam, next milestone, regenerate.
- **Dashboard integration bug fixed:** the page loaded `studyPlan` and called
  `setStudyPlan` but the `useState` was never declared — a runtime
  ReferenceError for any logged-in user. Added the state and a "Today's Study
  Plan" card (next incomplete tasks), plus a Study Planner tile in the
  quick-actions grid.

## Files changed
- `supabase/migrations/20260709123533_phase6_study_planner.sql` (reconciled)
- `supabase/rollbacks/rollback_20260709123533_phase6_study_planner.sql`
- `src/lib/studyPlanner.js`
- `src/pages/public/StudyPlanner.jsx`
- `src/App.jsx` (lazy route — already present from parallel session)
- `src/pages/public/StudentDashboard.jsx` (studyPlan state + card + quick action)
- `docs/PHASE6_STUDY_PLANNER.md`, `CHANGELOG.md`

## Security review
- Both tables own-row RLS; tasks authorized via parent plan
  (`study_plan_tasks_own` subquery). Verified: a different user sees 0 plans
  and 0 tasks. anon has no grants. Route behind `AuthRoute`.
- AI runs through the existing server-side `/api/groq-chat` (no key in
  frontend). No service-role usage.

## Performance review
- No new dependencies. Study Planner lazy-loaded (11.86 kB separate chunk);
  main bundle unchanged. Dashboard adds one small plan query.

## Testing
- RLS + full flow (plan insert, task insert via study_plan_id, completion,
  dashboard incomplete-task query, archive-on-regenerate) verified in
  rolled-back transactions — production untouched.
- `npm run build` passes; lazy chunk confirmed; 0 branding violations.

## Not fabricated
No sample plans/tasks were inserted into production. AI generation runs
against the live Groq key in the deployed environment.
