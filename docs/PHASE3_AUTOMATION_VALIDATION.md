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
