-- ============================================================================
-- ROLLBACK for 20260709022206_phase3_question_bank_foundation
--
-- WARNING (data loss): dropping these columns permanently deletes any values
-- stored in them (exam_id links, topic/subtopic, tags, status, provenance,
-- metadata, etc.). The 75 original rows and their base columns (question,
-- options, answer, explanation, subject, difficulty) are preserved.
--
-- Order matters: drop the trigger + function and the new RLS policy before
-- dropping columns; restore the previous select policy so authenticated reads
-- keep working; revert the ai_drafts content_type check to its pre-Phase-3 set
-- (this will FAIL if any ai_drafts row already has content_type='questions' —
-- delete/repoint those first).
-- ============================================================================

begin;

-- restore previous ai_drafts content_type set (pre-questions)
alter table public.ai_drafts drop constraint if exists ai_drafts_content_type_check;
alter table public.ai_drafts add constraint ai_drafts_content_type_check
  check (content_type in ('current_affairs','notifications','exams','previous_papers'));

-- restore the previous select policy
drop policy if exists "mock_questions_select_published" on public.mock_questions;
create policy "mock_questions_select_auth"
  on public.mock_questions for select to authenticated
  using (true);

drop trigger if exists trg_mock_questions_updated_at on public.mock_questions;
drop function if exists public.mock_questions_touch_updated_at();

drop index if exists public.idx_mock_questions_status;
drop index if exists public.idx_mock_questions_exam_id;
drop index if exists public.idx_mock_questions_subject;
drop index if exists public.idx_mock_questions_topic;
drop index if exists public.idx_mock_questions_difficulty;
drop index if exists public.idx_mock_questions_tags;

alter table public.mock_questions drop constraint if exists mock_questions_status_check;
alter table public.mock_questions drop constraint if exists mock_questions_difficulty_check;

alter table public.mock_questions
  drop column if exists exam_id,
  drop column if exists topic,
  drop column if exists subtopic,
  drop column if exists language,
  drop column if exists source,
  drop column if exists source_year,
  drop column if exists tags,
  drop column if exists status,
  drop column if exists created_by,
  drop column if exists reviewed_by,
  drop column if exists ai_generated,
  drop column if exists human_verified,
  drop column if exists published_at,
  drop column if exists updated_at,
  drop column if exists metadata;

commit;
