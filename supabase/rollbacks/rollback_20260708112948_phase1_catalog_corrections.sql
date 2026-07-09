-- ============================================================================
-- ROLLBACK for 20260708112948_phase1_catalog_corrections
--
-- Restores the pre-correction state exactly:
--   • re-inserts the two deleted APPSC Group-2 duplicates with their
--     ORIGINAL UUIDs, content, and timestamps (captured before deletion)
--   • returns the appsc-group-2 slug + seeded metadata to 9c41ad4a and
--     strips the canonical metadata from fa4bfb17
--   • reverts "Services" titles and TG naming/slugs
--   • removes SSC MTS and SBI Clerk
--   • revokes the selected_exam_id UPDATE grant (NOTE: this re-breaks
--     saving exam selection — the pre-correction state was broken)
--   • drops the slug-immutability trigger
--   • drops the previous_papers columns (NOTE: /previous-papers page
--     returns to its broken order-by-year 400 state)
-- ============================================================================

begin;

drop trigger if exists trg_exams_protect_slug on public.exams;
drop function if exists public.exams_protect_slug();

revoke update (selected_exam_id) on public.profiles from authenticated;

delete from public.exams where slug in ('ssc-mts', 'sbi-clerk');

-- revert TG naming and slugs
update public.exams set
  slug = 'ts-dsc', exam_name = 'TS DSC', title = 'TS DSC', organization = 'TG DSE'
where slug = 'tg-dsc';

update public.exams set
  slug = 'ts-police-si', exam_name = 'TS Police SI', title = 'TS Police SI',
  organization = 'TSLPRB'
where slug = 'tg-police-si';

update public.exams set
  slug = 'ts-police-constable', exam_name = 'TS Police Constable',
  title = 'TS Police Constable', organization = 'TSLPRB'
where slug = 'tg-police-constable';

update public.exams set organization = 'APSLPRB'
where slug in ('ap-police-si', 'ap-police-constable');

-- revert "Services" titles
update public.exams set title = 'APPSC Group-1' where slug = 'appsc-group-1';
update public.exams set title = 'APPSC Group-3' where slug = 'appsc-group-3';
update public.exams set title = 'TSPSC Group-1' where slug = 'tspsc-group-1';
update public.exams set title = 'TSPSC Group-2' where slug = 'tspsc-group-2';
update public.exams set title = 'TSPSC Group-3' where slug = 'tspsc-group-3';

-- return fa4bfb17 to its pre-correction state and free the slug
update public.exams set
  slug = null, exam_name = 'APPSC Group 2', title = 'APPSC Group 2',
  organization = null, category = null, state = null,
  display_order = 100
where id = 'fa4bfb17-3769-416d-b5d3-ad71f3e27a72';

-- restore the deleted duplicates with original data (captured 2026-07-08)
insert into public.exams
  (id, exam_name, title, eligibility, age_limit, syllabus, selection_process,
   official_website, created_at, updated_at, slug, organization, category,
   state, status, is_active, display_order)
values
  ('9c41ad4a-a9d1-4915-8fba-52c0446487da', 'APPSC Group-2', 'APPSC Group-2',
   null, null, null, null, null,
   '2026-07-08 06:14:09.397426+00', '2026-07-08 06:14:09.397426+00',
   'appsc-group-2', 'APPSC', 'state-psc', 'AP', 'Upcoming', true, 11),
  ('6f0a3c94-0260-4b87-b7a8-24db9f18ee96', 'APPSC Group 2', 'APPSC Group 2',
   'Any Degree', '18-42 Years', 'General Studies', 'General Studies',
   'https://psc.ap.gov.in',
   '2026-06-16 10:38:58.834996+00', '2026-06-16 10:38:58.834996+00',
   null, null, null, null, 'Upcoming', true, 100)
on conflict (id) do nothing;

-- drop the previous_papers reconciliation columns (data loss: year/subject/
-- description values entered after the correction are discarded)
alter table public.previous_papers
  drop column if exists organization,
  drop column if exists year,
  drop column if exists subject,
  drop column if exists description;

commit;
