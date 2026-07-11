-- ============================================================================
-- Phase 4.0 / PR-1 — Access tiers for the question bank
--
-- Introduces the three-tier business model WITHOUT changing any existing
-- question content:
--
--   'public'   → anonymous visitors  (free sample tests, daily quiz)  → SEO + funnel
--   'free'     → authenticated users (full free bank)                 → drives signup
--   'premium'  → paying subscribers  (premium tests/questions)        → drives revenue
--
-- Two objects:
--   mock_tests            — the test catalog (replaces the hardcoded TEST_TITLES /
--                           mockTests[] JS arrays). Tier lives here because a test
--                           is the SKU we sell. Catalog is readable by everyone so
--                           anonymous users can SEE premium tests (upsell) but not
--                           their questions.
--   mock_questions.access_tier — per-question enforcement, so RLS protects content
--                           even if a test_id is guessed.
--
-- Additive only. No existing column altered, no row deleted.
-- ============================================================================

begin;

-- ── 1. Tier on questions ────────────────────────────────────────────────────
alter table public.mock_questions
  add column if not exists access_tier text not null default 'free';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mock_questions_access_tier_check') then
    alter table public.mock_questions
      add constraint mock_questions_access_tier_check
      check (access_tier in ('public','free','premium'));
  end if;
end $$;

-- ── 2. Test catalog (the SKU) ───────────────────────────────────────────────
create table if not exists public.mock_tests (
  test_id       text primary key,                       -- matches mock_questions.test_id
  title         text not null,
  description   text,
  access_tier   text not null default 'free'
                  check (access_tier in ('public','free','premium')),
  exam_id       uuid references public.exams(id) on delete set null,
  subject       text,
  is_active     boolean not null default true,
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_mock_tests_active on public.mock_tests(is_active, display_order);
-- hot path: engine fetches published questions for one test at the caller's tier
create index if not exists idx_mock_questions_test_status_tier
  on public.mock_questions(test_id, status, access_tier);

-- ── 3. RLS ──────────────────────────────────────────────────────────────────
alter table public.mock_tests enable row level security;

-- Catalog is visible to everyone (including anon): premium tests must be SEEN
-- to be sold. Content protection happens on mock_questions, not here.
drop policy if exists mock_tests_select_public on public.mock_tests;
create policy mock_tests_select_public on public.mock_tests
  for select to anon, authenticated
  using (is_active = true);

drop policy if exists mock_tests_write_admin on public.mock_tests;
create policy mock_tests_write_admin on public.mock_tests
  for all to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- Questions: replace the old untiered read policy with tier-aware ones.
drop policy if exists mock_questions_select_published on public.mock_questions;

-- Anonymous: ONLY public-tier questions.
drop policy if exists mock_questions_select_anon on public.mock_questions;
create policy mock_questions_select_anon on public.mock_questions
  for select to anon
  using (status = 'published' and access_tier = 'public');

-- Authenticated: public + free. Premium only for an ACTIVE subscriber
-- (is_pro alone is not trusted — the expiry is checked too).
drop policy if exists mock_questions_select_authenticated on public.mock_questions;
create policy mock_questions_select_authenticated on public.mock_questions
  for select to authenticated
  using (
    status = 'published'
    and (
      access_tier in ('public','free')
      or (
        access_tier = 'premium'
        and exists (
          select 1 from profiles p
          where p.id = auth.uid()
            and p.is_pro = true
            and (p.pro_expires_at is null or p.pro_expires_at > now())
        )
      )
    )
  );

-- (mock_questions_write_admin is unchanged and still governs all writes.)

-- ── 4. Grants — RLS cannot be evaluated without them ────────────────────────
grant select on public.mock_questions to anon;
grant select on public.mock_tests    to anon, authenticated;
grant insert, update, delete on public.mock_tests to authenticated;  -- gated by RLS

commit;
