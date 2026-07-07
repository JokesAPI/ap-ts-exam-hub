# AP/TS Exam Hub — Audit & Implementation Report
**Date:** 2026-07-07 · **Scope:** Tasks 1–5 (repo sync, collector, logging, E2E validation)

---

## 1. Audit Report

### Task 1 — Repository drift (CRITICAL, unresolved, requires action on your machine)

GitHub HEAD is `28001e6` (2026-07-05 08:51 IST). Production database migrations run through 2026-07-07 01:49. The following exist in **production or were built in recent sessions but are NOT in GitHub**:

| Component | In GitHub? | Evidence |
|---|---|---|
| Frontend (public pages) | ✅ Yes | `src/pages/public/` (19 pages) |
| Backend (Vercel functions) | ✅ Yes | `api/groq-chat.js`, `api/create-order.js`, `api/api/verify-payment.js` |
| Admin panel (content CRUD) | ✅ Yes | `src/pages/admin/` (8 pages) |
| **Admin draft-review UI** | ❌ **MISSING** | Zero references to `ai_drafts`/`publish_draft`/`approve_draft` in `src/` |
| **Health dashboard UI** | ❌ **MISSING** | `get_automation_health()` exists in DB; nothing in `src/` calls it |
| **Bulk operations UI** | ❌ **MISSING** | `bulk_*` functions exist in DB; nothing in `src/` calls them |
| Automation scripts / collector | ✅ Yes | `scripts/generate_current_affairs_v2.py` (pipeline-integrated) |
| AI pipeline (DB layer) | ⚠️ DB only | All 14 functions + 6 tables live in production; **no SQL files in repo** |
| **Migrations folder** | ❌ **MISSING** | No `supabase/migrations/`; 12 applied migrations exist only in `supabase_migrations.schema_migrations` |
| Version history (DB layer) | ⚠️ DB only | `ai_draft_versions` + trigger in production, not in repo |
| Documentation | ⚠️ Partial | `SETUP.md` exists; no architecture/pipeline docs |
| Configuration | ✅ Yes | `vercel.json`, `vite.config.js`, etc. |
| Rollback SQL | ✅ Local commit | `supabase/rollbacks/` (committed 2026-07-06 in working clone, **not yet pushed**) |
| **Nested folder bug** | ⚠️ | `api/api/verify-payment.js` — double-nested; verify Vercel actually routes it |

**Resolution requires your machine:** I cannot push to GitHub or see your laptop. Actions only you can do — (1) `git push` any local work (especially draft-review UI if it exists locally), (2) apply the two patches from these sessions, (3) commit the 12 migration SQLs into `supabase/migrations/` (I can generate these files from production on request — the exact SQL is already extracted).

**Critical consequence of the drift:** the collector creates drafts, but with no review UI in the repo, drafts are unreviewable except via SQL. The pipeline is headless.

### Task 2 — Collector audit result: already refactored, docstring lied

`generate_current_affairs_v2.py` at HEAD already implements the required flow exactly — it does **not** insert into `current_affairs` anywhere (verified by grep: the string appears only as `content_type` values). It reuses the existing DB pipeline: `check_duplicate_draft()` for dedup (before spending Groq tokens), `ai_drafts` for drafts, `validate_draft()` for quality gating, `ai_draft_logs` for audit, `automation_runs`/`automation_sources`/`automation_dead_letter` for observability. No parallel systems were created; none were needed.

The file's 40-line docstring, however, still described the old direct-insert Phase 2 behavior. That stale docstring caused a false "v2 bypasses the pipeline" finding in the 2026-07-06 audit. Fixed.

### Task 3 — Logging audit: 10 of 12 fields covered, 1 gap, 1 by-design

| Required field | Status |
|---|---|
| start time | ✅ `started_at` |
| finish time | ✅ `finished_at` |
| duration | ✅ derived (`finished_at - started_at`) — deliberately not stored twice |
| source | ✅ `source_name` + `automation_sources` row |
| records fetched | ✅ `records_collected` |
| records accepted | ✅ `records_drafted` |
| duplicates | ✅ `duplicate_count` |
| **rejected** | ⚠️ **GAP** — proposed migration adds `records_rejected`; collector now counts it and writes it if the column exists |
| AI generation status | ✅ `ai_processing_time_ms`, `retry_count`, `success`/`error_message` |
| publish status | ✅ by design at a different layer — publishing happens later via admin review; tracked in `ai_drafts.status`, `ai_draft_logs`, `automation_sources.total_published` (updated by `record_source_outcome()` inside `publish_draft`). Logging a "publish status" at collection time would be architecturally wrong. |
| errors | ✅ `error_message` + `automation_dead_letter` per item |
| retry count | ✅ `retry_count` (Groq retries counted) |

---

## 2. Architecture Diagram

Rendered inline in chat; textual version:

```
TOI RSS ──▶ Collect (20) ──▶ Normalize + source_hash
                                   │
                                   ▼
                     check_duplicate_draft()  [existing, pg_trgm]
                       │ exact hash/url ─▶ skip (duplicate_count++)
                       │ sim ≥ 0.85     ─▶ skip
                       │ 0.60–0.85      ─▶ flag for reviewer
                       ▼
                Groq (grounded, JSON-only, ≤2 retries)
                       ▼
              ai_drafts (status='draft')  +  ai_draft_logs('ai_generated')
                       ▼
                validate_draft()  [existing quality gate]
                 pass ─▶ status='validated'   fail ─▶ review_notes set
                       ▼
        ADMIN REVIEW  approve_draft()/reject_draft()  [identity-checked]
                       ▼
                 publish_draft()  ──▶  current_affairs
                       └─▶ record_source_outcome() → source confidence

  every run ──▶ automation_runs        every item failure ──▶ dead_letter
```

## 3. Files Changed

`scripts/generate_current_affairs_v2.py` — three additive edits, no behavior change to the happy path: (1) docstring rewritten to match reality, (2) `create_draft` return annotation `str` → `tuple`, (3) validation-failure counting added to run stats, written to `records_rejected` with graceful fallback when the column doesn't exist yet.

`supabase/proposed_migrations/automation_runs_records_rejected.sql` — new, **not applied**.

## 4. Database Changes

**None applied.** All database interaction this session was read-only audit (migration history, table counts, one RPC signature smoke test that wrote nothing).

## 5. Migration Changes

One proposed, awaiting your approval: `records_rejected integer default 0` on `automation_runs`. Zero deploy coordination needed — the collector already works with or without it. Say the word and I'll apply it via `apply_migration` so it lands in migration history properly.

## 6. Risks

The dominant risk is the repo drift: a laptop failure loses the draft-review UI, health dashboard, and bulk-ops UI if they exist only locally — and if they don't exist at all, the pipeline has no human interface and drafts will accumulate invisible. Second, the pipeline has processed zero real rows ever (all tables empty), so the first production run is the real integration test; run it once with `--dry-run`, then once with `--count 2`, and review in SQL if the UI isn't deployed. Third, `confidence_score` uses a 0–1 scale in `ai_drafts` but 0–100 in `automation_sources` — not a bug, but a foot-gun for whoever builds the dashboard; document or unify later. Fourth, the collector requires the service-role key at runtime; keep it in environment/secrets only (repo scan confirmed nothing is committed today). Fifth, single RSS source means a TOI feed change halts collection — the `automation_sources` design already anticipates multi-source, which is the right Phase 6 direction.

## 7. Rollback Plan

Code: `git revert` the patch commit (edits are isolated to one script plus one new SQL file). Proposed migration, if applied: `alter table automation_runs drop column if exists records_rejected;` (included in the migration file). Collector output rollback: drafts are inert until an admin publishes, so a bad run is cleaned with `delete from ai_drafts where status='draft' and source_name='Times of India - Top Stories' and created_at > <run start>;` — nothing touches `current_affairs` without human approval. Full pipeline rollback SQL for all 12 migrations already exists in `supabase/rollbacks/`.

## 8. Testing Checklist

Done this session (container + production, read-only):
- [x] `py_compile` passes after edits
- [x] `normalize_headline`: HTML stripping, whitespace collapse, stable 64-char hash
- [x] `validate_and_normalize`: rejects missing fields and invalid answers, coerces bad categories, normalizes ` b ` → `B`
- [x] `format_content`: MCQ block, Telugu block, source line all present
- [x] `check_duplicate` thresholds: ≥0.85 skip / 0.60–0.85 flag / clean ok
- [x] `check_duplicate_draft()` RPC signature verified against production
- [x] Secrets scan of repo: clean
- [x] Rollback object names verified against production (previous session)

Requires your machine (network/keys unavailable here):
- [ ] `python scripts/generate_current_affairs_v2.py --dry-run` — RSS fetch + Groq, zero writes
- [ ] Real run with `--count 2`; then verify: one `automation_runs` row with `success=true` and sane counts; N `ai_drafts` rows in `draft`/`validated`; `ai_draft_logs` has `ai_generated` + `validated` events per draft
- [ ] Re-run immediately: expect `duplicate_count` ≈ previous drafted count, 0 new drafts
- [ ] As admin in the app (or SQL with your JWT): `approve_draft` then `publish_draft` one draft; confirm the `current_affairs` row renders correctly on `/current-affairs` including Telugu block
- [ ] Confirm `automation_sources` row updated (`last_run_at`, `total_drafted`, and `total_published` after publish)

---

## Task 4 — End-to-End Flow Documentation (stage-by-stage status)

**Collector → Draft Creation → Deduplication:** implemented and unit-tested; never run in production (all pipeline tables empty as of this audit). **Admin Review:** DB functions exist, hardened, identity-checked; UI missing from repo — this is the broken link. **Publish:** `publish_draft()` verified in production, feeds source-confidence scoring. **SEO:** weakest stage — the site is a client-rendered SPA with one static `sitemap.xml` and no per-article URLs, so published current affairs are invisible to Google; competitors (GKToday, AffairsCloud) win here on indexed article pages. Recommend Phase 6: per-item routes (`/current-affairs/:slug`) + prerendering or SSR + automated sitemap regeneration on publish. **Search:** client-side filtering only within loaded pages; fine at current scale, will need Postgres full-text (`tsvector` on title+content) as content grows — cheap to add, index-only migration. **Notifications:** the `notifications` table is job notifications (content), not user push. No push/email infra exists. Recommend Phase 6: start with a simple "new content since last visit" badge (zero infra), defer web-push.

## Self-Review (security · maintainability · scalability · performance · duplication)

Security: collector holds the service-role key by necessity (RLS is admin-or-nothing on pipeline tables); acceptable for a server-side scheduled job, never acceptable in frontend/repo — scans clean. Drafts cannot reach students without an identity-checked admin action, which is the right trust boundary. Maintainability: the stale-docstring incident proves docs drift causes real audit errors; docstring now matches behavior. Scalability: dedup-before-AI ordering minimizes token spend; per-item dead-lettering means one bad item can't kill a run. Performance: 20 items/run is trivial; the pg_trgm GIN index already backs similarity checks. Duplication: none introduced — the collector calls existing DB functions rather than reimplementing validation or dedup; the only near-duplication is the script's local `validate_and_normalize` (pre-AI shape check) vs DB `validate_draft` (post-draft content check), which operate at different stages and are both justified.

**Better implementation recommendation (before writing more code):** rather than adding more standalone Python collectors per source, Phase 6 should generalize this script into one collector driven by `automation_sources` rows (URL + type per source) — the table schema was clearly designed for exactly that. Propose doing this when adding source #2, not before; premature generalization from one source is how frameworks go wrong.
