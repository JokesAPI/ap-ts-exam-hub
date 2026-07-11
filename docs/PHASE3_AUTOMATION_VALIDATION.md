# Phase 3 — Production Automation Validation

**Date:** 2026-07-10 · **Branch:** v2-development
**Scope:** validate the existing Current Affairs automation end-to-end and fix
only defects that prevent it running. No new dashboards, pages, tables, or
features.

## Validation method + honest limitation

The live GitHub Actions run and the collector's real RSS→OpenAI calls could
**not** be executed here — they require the runner environment with
`OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, which this environment does
not have. Approach used instead: static audit + config inspection + a
controlled, rolled-back DB test of the publish chain. Each stage below is
marked **[live-DB]**, **[inspection]**, or **[config]** accordingly.

## Stage-by-stage evidence

| Stage | Result | Evidence |
|---|---|---|
| 0. Env vars | ✅ | Collector reads `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_MODEL` (optional), each validated with a clear `sys.exit` **[inspection]** |
| 1. GitHub Actions | ⚠️→✅ | Cron `0 1 * * *`, `workflow_dispatch` with count/dry_run, concurrency group, 15-min timeout, 1 retry, issue-on-failure. **Defect #1 found + fixed** (below) **[config]** |
| 2. RSS collect | ✅ | `feedparser` on a confirmed live feed; empty-feed guard **[inspection]** |
| 3. OpenAI generate | ✅ | `https://api.openai.com/v1/chat/completions`, grounded prompt from RSS survivors, bounded retries, `gpt-4o-mini` default **[inspection]** |
| 4. Draft store | ✅ | Inserts `ai_drafts` (status='draft', content_type='current_affairs') **[live-DB]** |
| 5. Validate | ✅ | `validate_draft()` ran on a sample draft, returned pass **[live-DB]** |
| 6. Dedup | ✅ | `check_duplicate_draft()` (pg_trgm) + `source_hash` called **before** drafting **[inspection]** |
| 7. Publish | ✅ | `publish_draft(draft_id, admin_id)` executed, returned success **[live-DB]** |
| 8. Homepage table | ✅ | Row reached `current_affairs`; the Phase 2 homepage reads this table **[live-DB]** |

The Stage 4–8 test ran inside a transaction that ended with a forced rollback
(`raise 'rollback_qa'`) — **production data was not modified**.

## 🔴 Defect #1 (found + fixed) — the only pipeline blocker

**File:** `.github/workflows/current-affairs-daily.yml`.
**Root cause:** the collector was migrated Groq→OpenAI and now reads
`OPENAI_API_KEY`, but the workflow's `env:` block still injected
`GROQ_API_KEY` and never passed `OPENAI_API_KEY`. Every scheduled/dispatched
run would have exited immediately with
`ERROR: OPENAI_API_KEY environment variable is not set.`
**Fix (minimal):** replace `GROQ_API_KEY` with `OPENAI_API_KEY` (+ optional
`OPENAI_MODEL`) in the env block. No logic, schedule, or retry change.

**Action still required by the repo owner (cannot be done from here):** ensure
the GitHub repository secret `OPENAI_API_KEY` exists (and optionally
`OPENAI_MODEL`). The old `GROQ_API_KEY` secret is now unused.

## Everything else: already production-ready (no change needed)

- DB backend: 6 tables + 13 functions (validate/approve/reject/publish/bulk/
  dedup/health/run-bookkeeping/versioning), all admin-RLS.
- Collector: real RSS, OpenAI grounding, dedup, dead-letter, run logging.
- Review UI: `AdminDrafts.jsx` (approve/reject/publish/bulk/search/filter/
  status). Health: `AdminAutomation.jsx`.
- Publish→homepage: `publish_draft` writes `current_affairs`; the homepage
  already reads it live (Phase 2).

## First-run guidance (owner-run, since credentials aren't available here)

1. Confirm repo secrets: `OPENAI_API_KEY`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` (optional `OPENAI_MODEL`).
2. Actions → "Current Affairs Pipeline" → Run workflow with **dry_run = true**
   (RSS+OpenAI, zero DB writes) → confirm success in the job log.
3. Re-run with dry_run=false, count=2 → check `ai_drafts` for 2 drafts and
   `automation_runs` for a `success=true` row.
4. `/admin/drafts` → review → Publish → confirm the item appears on
   `/current-affairs` and the homepage.

---

# Design only (NOT implemented this phase): Notifications + Exams collectors

**Key finding that makes these cheap:** `validate_draft` and `publish_draft`
**already branch on `content_type` for `notifications` and `exams`** (lines
174/179 of the automation-hardening migration), routing published rows to the
correct table. So both new collectors need **zero DB/schema/RPC/RLS changes** —
they only produce `ai_drafts` rows with the right `content_type`, and the
existing pipeline (validate → review → publish → table → homepage) carries them
the rest of the way.

## Notifications Collector (design)

- **Source:** official exam-board notification pages / RSS where available
  (APPSC, TGPSC, SSC, RRB). Where no RSS exists, a small HTML scrape of the
  notifications listing, normalized to {title, link, published_date}.
- **Shape:** mirror `generate_current_affairs_v2.py` structure exactly —
  `Supa` client, `begin_automation_run('notifications-<board>')`, per-item
  `source_hash`, `check_duplicate_draft`, `dead_letter`, `record_source_outcome`.
- **Draft:** insert `ai_drafts` with `content_type='notifications'`,
  `json_data` = the columns `publish_draft` expects for the `notifications`
  table (title, body/description, link, date). OpenAI used only to summarize/
  clean/translate — never to invent a notification (grounding preserved).
- **Schedule:** separate workflow (or a matrix job) on its own cron; reuse the
  same concurrency/timeout/retry/issue-on-failure pattern.

## Exams Collector (design)

- **Source:** exam-board calendar/schedule pages. Lower cadence (weekly), since
  exam schedules change slowly.
- **Shape:** same collector skeleton; `content_type='exams'`, `json_data`
  matching the `exams` columns `publish_draft` maps (title, organization,
  exam_date, last_date, category, etc.).
- **Dedup:** `source_hash` over (organization + exam_name + year); the existing
  `check_duplicate_draft` handles fuzzy title matches.
- **Care point:** exams are more structured than news — the OpenAI step should
  extract/normalize fields, not generate prose; validate_draft's `exams`
  branch already enforces required fields on publish.

Both designs deliberately reuse the existing architecture end-to-end and would
be implemented as **separate collector scripts + workflows only**, in a later
phase, with no backend changes.

---

# FINAL VALIDATION RECORD — Phase 3 sign-off

**Status:** ✅ **Phase 3 — Production Automation Validation is complete.**

**Date:** 2026-07-11
**Validated commit (workflow + collector, `main`):** `fd497c5`
  — `ci: enable Current Affairs Pipeline on main (workflow + runtime deps)`
**Prerequisite fix (`v2-development`):** `d094d58`
  — `fix(automation): pass OPENAI_API_KEY to collector workflow`
**Model:** `gpt-4o-mini` (via `OPENAI_MODEL`; collector default)
**Environment:** GitHub Actions (`ubuntu-latest`) → OpenAI → Supabase
  (`ijqdjlkzcygfjkmciqyy`)

> Note on branches: the workflow executes from **`main`** (GitHub schedules and
> dispatches workflows from the default branch). `fd497c5` is therefore the SHA
> that was actually exercised in production.

## Test evidence (verified against production, not asserted)

### Stage evidence

| # | Claim | Status | Evidence |
|---|---|---|---|
| 1 | GitHub Actions workflow executed successfully | ✅ **Verified by execution** | `automation_runs`: **2 runs, both `success=true`**, `retry_count=0`, `error_message=null` |
| 2 | RSS fetched 20 headlines | ✅ **Verified by execution** | `records_collected = 20` on **both** runs |
| 3 | OpenAI generated validated drafts with gpt-4o-mini | ✅ **Verified by execution** | 10 drafts, **10/10** carry `ai_model = openai/gpt-4o-mini`; `ai_processing_time_ms` 20,472 / 60,701 |
| 4 | Drafts reviewed, approved, published | ✅ **Verified by execution** | 5 drafts at `status='published'` with `reviewed_at` + `published_at` set; `ai_draft_logs` records `ai_generated` and `validated` events |
| 5 | Published articles reached `current_affairs` + public site | ✅ **Verified by execution** | `current_affairs` = 11 rows (5 added by the pipeline); the public Current Affairs page and homepage read this table directly |
| 6 | Automation Dashboard shows run health | ✅ **Verified by inspection** | `/admin/automation` + `/admin/drafts` health strip consume `get_automation_health()` (admin-gated RPC) |
| 7 | SQL replay of an existing article | ✅ **Verified by execution** | Replaying a live draft's real hash/URL through `check_duplicate_draft()` returned `exact_source_hash = 1.0`, `exact_source_url = 1.0`, `similar_title = 1.0` |
| 8 | Exact matches skipped before OpenAI; counters incremented | ✅ **Verified by inspection** | `generate_current_affairs_v2.py`: dedup runs in the survivor loop (line ~488) **before** the AI call; `exact_source_hash` / `exact_source_url` → `action='skip'` → `stats['duplicates'] += 1`. Duplicates cost **zero AI tokens** |
| 9 | No duplicate `source_hash` values | ✅ **Verified by execution** | `select source_hash, count(*) … having count(*) > 1` → **0 rows** |
| 10 | `duplicate_count = 0` is not evidence of failure | ✅ **Explained + corroborated** | See below |

### Per-run detail (from `automation_runs`)

| Started (UTC) | Duration | Success | Collected | Drafted | Duplicates | Rejected | Retries |
|---|---|---|---|---|---|---|---|
| 2026-07-11 09:05:34 | 32.0 s | true | 20 | 5 | 0 | 0 | 0 |
| 2026-07-11 15:53:15 | 71.6 s | true | 20 | 5 | 0 | 0 | 0 |

Dead-letter queue: **0 entries** (no per-item failures across either run).

### Why `duplicate_count = 0` is correct, not a defect

The Times of India top-stories feed rotates its items continuously, so the two
runs (≈6h 48m apart) saw **entirely different headlines**. Corroboration:

    10 drafts → 10 distinct source_hash
              → 10 distinct source_url
              → 10 distinct title

Every collected item was a genuinely new story, so there was nothing to
deduplicate. `duplicate_count = 0` is the **expected** outcome, not a failed
check.

Deduplication itself is independently proven by the item-7 SQL replay: feeding
an existing article's real `source_hash`/`source_url` back through
`check_duplicate_draft()` returns exact matches at similarity 1.0, and the
collector's verdict logic skips on precisely those reasons. The mechanism is
closed-loop (both `source_url` and `source_hash` are persisted on draft insert),
and it is double-guarded — `check_duplicate_draft` additionally fuzzy-matches
against the already-published `current_affairs` table.

## Residual risks

1. **End-to-end dedup counter never exercised live.** The DB comparison layer and
   the collector's skip logic are each proven, but a run producing
   `duplicate_count > 0` has not occurred, because the live feed never repeated
   an item. To close this deterministically would require a fixed/fixture feed
   (an additive `RSS_FEED_URL` override) — **designed, not implemented**; out of
   Phase 3 scope.
2. **`OPENAI_MODEL` empty-string fragility.** GitHub passes an *unset* secret as
   an empty string, and the collector uses
   `os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')`, which returns `''` rather
   than the default. It works today because the secret is configured; deleting
   it would send `model: ""` and 400 every run. A one-line hardening
   (`os.environ.get('OPENAI_MODEL') or 'gpt-4o-mini'`) would make it immune.
3. **Single RSS source.** All content depends on one feed; a TOI outage or
   format change halts the pipeline (it would surface as a failed run + GitHub
   issue, not silent breakage).
4. **Publishing is manual by design.** Drafts require an admin approve/publish;
   nothing reaches the public site unattended. This is a safety feature, but it
   means content flow stops if nobody reviews.
5. **Confidence-scale inconsistency.** `automation_sources.confidence_score` is
   on a 0–100 scale while `ai_drafts.confidence_score` is 0–1. Harmless today;
   would matter if confidence-gated auto-publish is built later.
6. **No pagination on the public Current Affairs page.** All rows are fetched
   client-side; fine at 11 rows, will degrade as the daily cron accumulates
   content.

## Rollback reference

| Change | Commit | Rollback |
|---|---|---|
| Workflow + collector on `main` | `fd497c5` | `git revert fd497c5` |
| `OPENAI_API_KEY` workflow fix | `d094d58` | `git revert d094d58` |

No database migrations were introduced by Phase 3 validation, so **rollback is
code-only**. Published `current_affairs` rows are data, not schema; reverting
code does not remove them. To retract published content, archive/unpublish it
through the admin UI rather than reverting a commit.

## Operational monitoring recommendations

1. **Watch the dead-letter queue.** `automation_dead_letter` should stay at 0.
   Any row is a per-item failure worth reading (`failed_at`, error payload).
2. **Alert on consecutive failed runs.** The workflow already opens a GitHub
   issue on failure; treat two consecutive failures as a page-worthy signal.
3. **Track `records_collected`.** A sudden drop to 0 means the RSS feed changed
   or broke — the earliest indicator of upstream drift.
4. **Watch `duplicate_count` trend upward over time.** As the archive grows,
   overlap with the feed becomes likely; a *persistently* zero counter combined
   with rising near-identical titles would suggest dedup regression.
5. **Review the pending-draft backlog.** Drafts accumulate until an admin acts;
   a growing `status='draft'`/`'validated'` count means review has stalled.
6. **Monitor OpenAI cost/latency.** `ai_processing_time_ms` already varies
   3× between runs (20.5 s vs 60.7 s); sustained growth signals model or
   rate-limit pressure.
7. **Re-check the cron after any default-branch change.** GitHub schedules
   workflows from the default branch only; moving or renaming `main` silently
   stops the scheduler.

## Formal statement

**Phase 3 — Production Automation Validation is complete.**

The pipeline (GitHub Actions → RSS → OpenAI `gpt-4o-mini` → `ai_drafts` →
validation → admin review → `publish_draft` → `current_affairs` → public site)
has been executed end-to-end in production, with every stage evidenced above.
