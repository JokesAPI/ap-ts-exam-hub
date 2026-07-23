# Phase 8.1 -- difficulty default migration

**Status: PREPARED, NOT EXECUTED.** Do not apply to production until Shaik
explicitly approves execution (this document and the accompanying SQL files
are the proposal, not a record of something already run).

## What this does
```sql
alter table mock_questions alter column difficulty set default null;
```
Changes the column's default from `'medium'` to `NULL`. Nothing else.

## Why (evidence, verified live this session)
- `mock_questions.difficulty`: `text`, nullable, `DEFAULT 'medium'::text`.
- `mock_questions_difficulty_check`: `CHECK (difficulty IS NULL OR difficulty
  IN ('easy','medium','hard'))` -- already permits NULL, unaffected by this
  change.
- Both currently-known insert paths already write difficulty explicitly and
  do not rely on this default:
  - `AdminQuestions.jsx` `buildPayload()` / `bulkImport()`: `difficulty: f.difficulty || null` / `r.difficulty || null`.
  - `publish_draft()` (AI content pipeline): `nullif(j->>'difficulty','')`.
- The default is therefore currently unreachable dead weight -- but it's the
  same failure class that already caused a real, shipped bug once in this
  project (Phase 8.0's silent `'medium'` default in `bulkImport()`). This
  migration removes the landmine permanently rather than relying on every
  future insert path remembering to defuse it by hand.

## What this does NOT do
- Does not touch existing rows. Verified distribution this session: 42
  `easy`, 32 `medium`, 5 `hard`, 10 `NULL` -- all untouched by a
  metadata-only `ALTER COLUMN ... SET DEFAULT`.
- Does not touch the CHECK constraint.
- Does not touch `validate_draft()` / `publish_draft()` -- confirmed both
  already set difficulty explicitly, independent of the column default.
- Does not touch `status`, `test_id`, or any other column.

## Lock / rewrite impact
`ALTER COLUMN ... SET DEFAULT` is a catalog-only change in Postgres. No
table rewrite, no row-level lock, briefly takes `ACCESS EXCLUSIVE` on the
table for the metadata update only (effectively instantaneous even at
current table size).

## Staging verification (before requesting production approval)
1. Apply this migration to a branch/clone of the production database.
2. `insert into mock_questions (test_id, question, option_a, option_b,
   option_c, option_d, correct_answer, subject) values (...)` -- omit
   `difficulty` entirely from the column list.
3. Confirm the inserted row's `difficulty` is `NULL`, not `'medium'`.
4. Confirm the existing 42/32/5/10 distribution is unchanged.
5. Run the full app test suite (`npm test`) and `npm run build` against
   the branch -- both already pass against the current schema without this
   migration, so this step is a regression check, not an expected fix.

## Production verification (after approval + apply)
1. Repeat the one-row omitted-difficulty insert check directly (then
   delete the test row).
2. Re-query the difficulty distribution and confirm it still reads
   42/32/5/10 (or whatever the live count is at execution time) -- i.e.
   confirm zero existing rows changed.
3. Spot-check one bulk import through `AdminQuestions.jsx` to confirm no
   behavior change from the application's point of view (it already sends
   explicit values either way).

## Rollback
`supabase/rollbacks/rollback_20260723090000_phase8_1_difficulty_default_null.sql`
-- one line, instant, reverses the default back to `'medium'`. No data is
at risk in either direction since no row is touched by either direction of
this change.
