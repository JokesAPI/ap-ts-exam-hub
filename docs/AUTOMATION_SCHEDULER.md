# Automation Scheduler — Current Affairs Pipeline

**Decision date:** 2026-07-07 · **Workflow:** `.github/workflows/current-affairs-daily.yml`
**DB migration:** `20260707161420_begin_automation_run_concurrency_guard` (applied)

## Architecture decision

Four options were compared for running the collector every morning:

| Option | Verdict | Reason |
|---|---|---|
| **GitHub Actions Cron** | ✅ **CHOSEN** | Repo already on GitHub; runs the existing Python collector unmodified; encrypted secrets built in; `workflow_dispatch` gives parameterized manual runs; native concurrency groups + timeouts; every execution logged and retained; failure email built in and issue creation costs nothing; ₹0. |
| Vercel Cron | ❌ Rejected | Crons invoke Vercel functions only → the 559-line Python collector would need a JavaScript port, duplicating the entire pipeline ("never duplicate code"). Hobby-plan duration limits also sit close to the pipeline's real runtime. |
| Supabase Scheduled Functions | ❌ Rejected | pg_cron triggers Edge Functions (Deno/TS) → same porting/duplication problem, and this project deliberately migrated away from Edge Functions to Vercel `/api`. |
| External cron service | ❌ Rejected | Needs a new HTTP endpoint wrapping the collector (new code + new attack surface holding the service-role key) plus a third-party dependency. Worse on every axis. |

## What runs, and when

The workflow runs the **existing, unmodified pipeline**:
`RSS → normalize → check_duplicate_draft() → Groq → ai_drafts →
validate_draft() → ai_draft_logs / automation_runs / automation_dead_letter`.
Nothing is published without admin review, exactly as before.

- **Schedule:** daily at 01:00 UTC = **06:30 IST** (GitHub cron may start a
  few minutes late under load — acceptable for morning content).
- **Manual execution:** GitHub → Actions → *Current Affairs Pipeline* →
  **Run workflow** — choose draft `count` and optional `dry_run`. Local
  manual runs (`python scripts/generate_current_affairs_v2.py`) also still
  work and are protected by the same DB guard.

## Requirement → mechanism map

| Requirement | Mechanism | Layer |
|---|---|---|
| Runs every morning | `schedule: cron '0 1 * * *'` | GitHub |
| Manual execution | `workflow_dispatch` with `count` / `dry_run` inputs | GitHub |
| Prevents concurrent runs | `concurrency.group` (workflow level) **plus** `begin_automation_run()` advisory-lock guard (DB level, protects local runs too) | Both |
| Logs every execution | GitHub run logs + one `automation_runs` row per executed run (a lock-skipped invocation logs to GitHub; the in-flight run owns the DB row) | Both |
| Updates automation_runs | Existing `finish_run()` in a `finally` block (unchanged) | Collector |
| Dead-letter support | Existing per-item `automation_dead_letter` insert (unchanged) | Collector |
| Retry support | Groq calls: 2 bounded retries (existing). Whole run: one automatic workflow retry after 90 s | Both |
| Timeout handling | `timeout-minutes: 15` kills a hung job; `begin_automation_run()` sweeps runs unfinished > 30 min to `success=false` (`marked stale…`) so a killed job can never deadlock the pipeline | Both |
| Notifications on failure | GitHub's built-in failure email **plus** an issue titled *"Automation failure: current-affairs pipeline"* (deduplicated: comments on the open one instead of piling up) | GitHub |
| Zero duplicate generation | Existing `check_duplicate_draft()` (hash/url/pg_trgm) **before** AI spend; the concurrency guard removes the only race that could bypass it. Re-runs and retries are idempotent by `source_hash` | DB |
| No schema duplication | One new function on existing tables; no new tables/columns | DB |
| Reuse existing collector | The workflow runs `generate_current_affairs_v2.py` as-is | GitHub |

## `begin_automation_run()` — the concurrency/timeout core

`begin_automation_run(p_source_name, p_connector_type, p_source_url, p_stale_after_minutes=30) → uuid | null`

Inside one transaction: takes `pg_advisory_xact_lock` keyed on the source
(serializes concurrent callers; auto-released, cannot leak), closes any
unfinished run older than the stale window as failed, returns `NULL` if a
live run is still in flight, otherwise inserts the `automation_runs` row,
registers the source in `automation_sources`, and returns the run id. The
collector exits 0 on `NULL` — coordination, not failure.

**Privileges:** `service_role` only; revoked from `public`, `anon`, and
`authenticated`. Run acquisition is not an app-facing operation.

**Production tests (2026-07-07, rolled-back transactions):** fresh acquire →
uuid; second acquire while live → `NULL`; 45-min-old unfinished run → swept
to `success=false` with `marked stale…` message and lock re-acquired;
privilege check → anon ✗, authenticated ✗, service_role ✓.

## One-time setup (repository → Settings → Secrets and variables → Actions)

Add three **Actions secrets** (same values the collector already uses):

| Secret | Value |
|---|---|
| `GROQ_API_KEY` | Groq API key |
| `SUPABASE_URL` | `https://ijqdjlkzcygfjkmciqyy.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-side only — this is exactly the sanctioned home for it) |

Then run the workflow once manually with `dry_run = true` to verify secrets
and RSS reachability from GitHub's runners, then once with `count = 2` and
review the drafts at `/admin/drafts`.

> Note: on repositories with no activity for 60 days, GitHub automatically
> disables scheduled workflows and emails a warning — any commit or a click
> on "Enable workflow" re-enables it. This repo is actively developed, so
> this is a footnote, not a risk.

## Failure playbook

1. **You get an email / a GitHub issue.** Open the linked workflow run; the
   collector's traceback is in the "Run collector" step log.
2. Check the **Automation Health** strip at `/admin/drafts`: last failure,
   unresolved dead-letter count.
3. Item-level failures: `automation_dead_letter` (mark `resolved` after
   handling). Run-level failures: `automation_runs` rows with
   `success = false`.
4. Re-run any time via **Run workflow** — dedup makes re-runs safe.

## Rollback

- **Scheduler:** delete (or disable in the Actions UI) the workflow file —
  zero side effects; the pipeline returns to manual-only.
- **Collector change:** `git revert` the commit — restores the old
  direct-insert `start_run()`.
- **DB function:** `supabase/rollbacks/rollback_20260707161420_begin_automation_run_concurrency_guard.sql`.
  ⚠️ Coupled: the current collector fails without the function; only roll
  back both together (warnings inside the file).
