# Mock Test Improvements (Priority 2)

**Date:** 2026-07-08 · **Branch:** v2-development · Base: `2466429`

## Audit summary

Two mock-test implementations coexist (both pre-existing, both left intact):

1. **`MockTests.jsx`** — self-contained AI-generated *practice quiz* (Groq,
   instant answer reveal, no DB save). Untouched except for a resume banner.
2. **`MockTestEngine.jsx`** (`/mock-test/start`) — *exam-mode* engine
   (timer, -1/3 negative marking, saves to `mock_results`). All Priority 2
   engine features were added here, per "reuse existing engine".

Audit also found `get_test_rank()` already live in production (built in a
prior session) but **missing from the repo's migrations** — a
source-of-truth gap fixed in this phase (see Database changes). It was
reused, not duplicated.

## Features implemented

**Resume interrupted tests.** New `src/lib/testSession.js` persists the
in-progress exam session (question order, answers, current index, time
left) to localStorage on every answer/navigation and every 10s. Reopening
the engine for the same test shows a Resume / Start Fresh screen; time
remaining and `time_taken` accounting are restored accurately. Sessions
expire after 24h and are cleared on submit. Client-side only — no DB
writes per answer, no schema change.

**Continue last unfinished test.** Resume entry points: banner on
`/mock-tests` (with Discard) and a highlighted card at the top of the
dashboard's Continue Study section. All three surfaces share the one
session util — no duplicated logic.

**Previous attempts.** Result screen fetches the user's earlier attempts
for the same test (own rows, fetched *before* inserting the new result so
deltas exclude it), shows a "+/-N% vs your last attempt" trend and the
last four attempts with dates. Empty state for first attempts; sign-in
prompt for anonymous users.

**Rank prediction.** After the result insert, the engine calls the
existing `get_test_rank(p_test_id, p_percentage)` RPC and renders
"#rank of N attempts · better than X%". Empty state when the user is the
first participant; graceful "Rank unavailable" on RPC failure.

**Detailed analysis & subject insights.** Analytics tab now compares each
subject against the user's historical average from prior attempts
("+12% vs your avg" badges with trend arrows).

**Answer review mode.** Filter chips — All / Wrong / Skipped / Correct —
with counts and a friendly empty state ("No wrong answers — great job!").
Original question numbering is preserved when filtered. A "Review Wrong
(N)" quick action was added to the result hero.

**Personalized recommendations.** New `SUBJECT_TO_TEST` / `TEST_TITLES`
maps in `src/lib/questions.js` route the weakest subject (<70%, different
from the current test) to the catalog test that drills it. Same-route
navigation is handled by a `testId`-change effect that resets state and
reloads the correct question bank (avoids a stale-closure reload bug).

**Skeleton loading / empty states / mobile.** Engine loading spinner
replaced with layout-matching skeletons (`animate-pulse`, reusing `card`);
skeletons also cover rank/attempts cards while saving. Prev/Next/Submit
become icon-only below `sm` so the bottom bar never wraps; the question
palette gets a max height + scroll for longer tests.

## Files changed

- `src/lib/testSession.js` (new, shared session util)
- `src/lib/questions.js` (two exported maps appended; question bank untouched)
- `src/pages/public/MockTestEngine.jsx` (main feature work; scoring,
  paywall, and save logic unchanged)
- `src/pages/public/MockTests.jsx` (resume banner only)
- `src/pages/public/StudentDashboard.jsx` (resume card in Continue Study)
- Migration + rollback for `get_test_rank` codification
- `docs/MOCK_TEST_IMPROVEMENTS.md`, `CHANGELOG.md`

## Database changes

`20260708113000_codify_get_test_rank_rpc.sql` — codifies the byte-identical
production definition of `get_test_rank` into the repo and migration
history (safe no-op re-apply, executed against production). **No new
database objects, tables, columns, or policies.** Rollback drops the
function; the frontend degrades gracefully (rank card shows unavailable).

## Security review

- No RLS policies or existing RPCs modified. Previous-attempt reads go
  through the `mock_results_own` policy (own rows only).
- `get_test_rank` reused as-is: SECURITY DEFINER with pinned
  `search_path`, internal `auth.uid()` guard, aggregate-only output,
  EXECUTE revoked from `public`/`anon` (verified:
  `has_function_privilege('anon', ...) = false`).
- localStorage session contains the user's own in-progress test only
  (questions + own answers) — same sensitivity class as the existing
  free-test counter already stored there. Free-test paywall accounting is
  unchanged (counter still increments only at submit; resuming does not
  double-count).

## Testing

- Production-safe RPC test (transaction + `set local role authenticated` +
  simulated JWT claims + rollback): 70% over pool {80,60,40} → rank 2 of 3,
  percentile 66.7; 90% → rank 1, percentile 100; unknown test → rank 1,
  0 attempts. All seeded rows rolled back.
- `npm run build` passes (see CHANGELOG entry).
