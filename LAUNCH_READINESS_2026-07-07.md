# AP/TS Exam Hub — Launch Readiness Report
**Date:** 2026-07-07 · **Scope:** repo sync, pipeline validation, logging, SEO, QA

---

## 1. Repository synchronization

**Migrations: DONE (in working tree).** `supabase/migrations/` now contains all 13 applied migrations, extracted from `supabase_migrations.schema_migrations` and **verified byte-for-byte** — every file's md5 matches the checksum computed inside production Postgres:

| File | md5 (matches production) |
|---|---|
| 20260705112215_rls_content_tables_and_column_grants.sql | e9c1b6b5… |
| 20260705112757_fix_signup_trigger_and_backfill_profiles.sql | c3e3e203… |
| 20260705112901_set_initial_admin_account.sql | 4e85a714… |
| 20260705162129_phase3_missing_indexes.sql | 34bba2a3… |
| 20260705162807_phase4_ai_drafts_core_schema.sql | 323d1e32… |
| 20260705162849_phase4_publish_approve_reject_functions.sql | 0e193aad… |
| 20260706010333_emergency_lockdown_predating_draft_functions.sql | 3d2f7cba… |
| 20260706063018_security_fix_admin_identity_check.sql | 5698ca8e… |
| 20260706111242_security_fix_admin_identity_check_reapply.sql | 5698ca8e… (identical twin, by design) |
| 20260706111807_hotfix_profiles_rls_recursion.sql | 45b11f7a… |
| 20260707012421_storage_security_previous_papers.sql | 574b5db5… |
| 20260707014946_phase5_automation_hardening.sql | 4d89ea5a… |
| 20260707062815_automation_runs_records_rejected.sql | applied today, see §3 |

**Push and tag: YOUR MACHINE ONLY.** I have no GitHub credentials. After applying this session's patch:

```bash
git am session-2026-07-07-launch-prep.patch   # or git apply
# plus: commit any local-only work (draft review UI, health dashboard, bulk ops UI)
git push origin main
git tag -a v1.0.0-launch-prep -m "Repo synchronized with production DB; pipeline validated; payment route fixed"
git push origin v1.0.0-launch-prep
```

Tag AFTER pushing local-only work, so the tag actually captures a synchronized state. The draft-review / health-dashboard / bulk-ops UIs remain absent from GitHub — if they don't exist locally either, that is the top post-launch build item (the pipeline is headless without them; see Risks).

## 2. Automation pipeline validation — evidence

**Stage: Collect.** Not executable from this environment: TOI blocks Anthropic's fetcher (site-level block — no bearing on your server, where the feed was previously verified live) and the sandbox network allows only package registries. Remains on your checklist: `python scripts/generate_current_affairs_v2.py --dry-run`, then `--count 2`.

**Stage: Normalize.** Unit-tested previous session (HTML stripping, whitespace collapse, stable sha256 source_hash) — tests re-passed after this session's edits (build + py_compile clean).

**Stage: ai_drafts insertion.** Evidence: test draft `ce1b455b…` inserted with full pipeline fields (source_hash, source_type='rss', collected_at, confidence 0.75, status='draft'). Accepted by all constraints.

**Stage: Quality validation.** Evidence, both paths:
- Short content → `validate_draft()` returned `["content_too_short"]`, status stayed `draft`, `validation_failed` logged. ✔ gate rejects
- Content fixed → returned `[]`, status became `validated`, `validated` logged. ✔ gate passes
- Audit trail for the draft: `[validation_failed, validated]` — complete lifecycle recorded.

**Stage: Duplicate detection.** Evidence, both mechanisms:
- Exact: `check_duplicate_draft(..., 'zztest_hash_e2e_0707')` → `exact_source_hash` match even with a completely different title. ✔
- Fuzzy: near-identical title (one word changed), no hash/url → similarity `0.76`, which the collector's thresholds classify as "flag for reviewer" (0.60–0.85 band). ✔

**Stage: Review workflow (security boundary).** Evidence: `approve_draft()` called with a real admin's UUID but no authenticated JWT → rejected with `Not permitted: p_admin_id must match the authenticated caller.` The identity-spoofing fix holds even against a superuser SQL context. ✔ The positive path (real admin approving in the UI) requires the missing review UI or a JWT-bearing session — on your checklist.

**Stage: Version history.** Evidence (bonus): editing the draft's content fired `trg_save_draft_version` — 1 version row captured automatically. ✔

**Cleanup:** test draft deleted; residual drafts/logs/versions all 0. Production is exactly as found, plus the one approved schema change below.

## 3. Automation logging

`records_rejected integer default 0` applied to `automation_runs` as migration `20260707062815` (verified in `information_schema`). The collector was already forward-compatible from last session: it counts validation failures and writes the column, with a fallback retry that omits it — so old collector builds keep working too. Backward and forward compatible in both directions.

## 4. SEO — audit and recommendation

**Audit findings (crawlability of current affairs):**
- One route for all articles: `/current-affairs` renders a client-side list. **No article has a URL.** Google cannot rank what it cannot link.
- `sitemap.xml` is static with exactly **one entry** (the homepage).
- Site-level meta/OG in `index.html` is decent (bilingual description, og:title/description) but there's no `og:image` and no structured data.
- Good news: `react-helmet-async` is already installed and in use (`CurrentAffairs.jsx` sets a static title), so per-page metadata needs no new dependency.

**Recommended approach (additive, no rewrite — builds on existing stack):**
1. **Detail route**: add `/current-affairs/:id/:slug` + a `CurrentAffairsDetail.jsx` that fetches one row via the existing anon Supabase client (public read is already allowed by RLS). Slug generated from the title, `:id` authoritative, canonical tag on the slugged URL. One new route line in `App.jsx`, one new page component.
2. **Per-article metadata** via the Helmet you already have: title = article title + site name; description = first ~155 chars of the English summary; OG tags; JSON-LD `NewsArticle` (headline, datePublished, inLanguage, publisher). The MCQ block can additionally emit `Quiz`/`Question` structured data later — competitors don't do this; it's a differentiator.
3. **Dynamic sitemap**: a Vercel function `api/sitemap.js` that queries `current_affairs` (plus static routes) through PostgREST with the anon key and returns XML; add a `vercel.json` rewrite from `/sitemap.xml`. Identical architecture to your existing `api/` functions — always fresh, zero manual work, on-brand with the automation mandate.
4. **Honest limitation + upgrade path**: Googlebot renders JavaScript, so client-side Helmet gets you indexed; WhatsApp/Telegram link previews do *not* execute JS, and those are the sharing channels your students actually use. The phase-after upgrade is prerendering (e.g., prerender the detail routes at build/refresh time or move the detail page to a Vercel function that injects meta server-side). Recommend shipping 1–3 now and scheduling prerendering next — do not block launch on SSR.

Per your instruction this is a recommendation only; nothing implemented.

## 5. QA — production readiness issues

| # | Severity | Issue | Impact | Fix |
|---|---|---|---|---|
| 1 | **P0 — was live** | `api/api/verify-payment.js` double-nested; frontend calls `/api/verify-payment` → 404 | **Students pay and never get their subscription activated.** Revenue + trust damage on every Razorpay success | **FIXED this session** (`git mv` to `api/verify-payment.js`; build green; no references to old path). Deploy ASAP; also reconcile any past paid-but-not-activated users in `payments` vs `subscriptions` |
| 2 | **P0** | Draft-review, health-dashboard, bulk-ops UIs absent from GitHub | Pipeline is headless: drafts pile up invisible; laptop loss destroys unpushed work | Push local code if it exists; if not, building the review UI is the first post-sync task |
| 3 | P1 | Current affairs invisible to search engines (no URLs, 1-entry sitemap) | Losing the single biggest organic-traffic channel to GKToday/AffairsCloud | §4 recommendation, items 1–3 |
| 4 | P1 | Full pipeline never exercised with real Groq output end-to-end | First production run is the real integration test | Dry run → `--count 2` → verify per §2 checklist |
| 5 | P2 | Main JS bundle 619KB (Vite warning) | Slow first load on budget Android phones — your core audience | Route-level `React.lazy` code-splitting; post-launch |
| 6 | P2 | `confidence_score` 0–1 in `ai_drafts` vs 0–100 in `automation_sources` | Dashboard foot-gun | Document now; unify in a later migration |
| 7 | P3 | Two migrations are identical twins (063018/111242) | History noise only | Documented in migration filename; no action |

## 6. Files changed (this session)

`supabase/migrations/` — 13 new files (12 checksum-verified extractions + 1 for today's applied migration). `api/verify-payment.js` — moved from `api/api/` (P0 payment fix). `supabase/proposed_migrations/` — removed (proposal graduated to applied). `LAUNCH_READINESS_2026-07-07.md` — this report.

## 7. Database changes

One: `automation_runs.records_rejected integer default 0` (migration `20260707062815`, pre-approved in your task list, verified applied). The E2E test wrote and fully deleted one draft; net data change zero.

## 8. Risks

Highest: deploying without the payment fix — every successful Razorpay payment currently fails activation, and each day adds manual reconciliation work; check `payments` rows lacking matching `subscriptions` for affected users. Second: launching content automation with no review UI means either publishing via SQL (error-prone) or drafts rotting unreviewed; the pipeline's safety design assumes a human in the loop, so give the human a screen. Third: single content source (TOI) plus an unexercised Groq path means day-one collection could fail quietly — the `automation_runs` row with `success=false` and `error_message` is your tripwire; check it after the first scheduled run. Fourth: repo/production drift recurs unless migrations become repo-first going forward — from now on, every schema change should land as a file in `supabase/migrations/` in the same commit as the code that uses it.

## 9. Rollback plan

Payment fix: `git revert` restores the nested path (there is no scenario where you want that). `records_rejected`: `alter table automation_runs drop column if exists records_rejected;` plus delete version `20260707062815` from `schema_migrations`; the collector's fallback makes this deploy-safe in either direction. Migration files in the repo: inert documents until run — deleting them touches nothing in production. Full pipeline rollback for all prior migrations remains in `supabase/rollbacks/`.

## 10. Launch gate — go/no-go checklist

Blockers before public launch: deploy the payment fix and confirm one real (or test-mode) Razorpay flow activates a subscription; push repo + tag; run collector dry-run then `--count 2` and verify §2 stages on real data; review and publish one draft as an authenticated admin and see it render on `/current-affairs` with the Telugu block intact. Strongly recommended in launch week: SEO items 1–3. Everything else is post-launch.
