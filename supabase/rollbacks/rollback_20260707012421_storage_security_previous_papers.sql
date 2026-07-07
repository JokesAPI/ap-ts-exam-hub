-- ROLLBACK for 20260707012421_storage_security_previous_papers
-- SECURITY-GATED ROLLBACK.
-- The forward migration removed the "Allow public upload previous papers"
-- policy (anyone on the internet could upload files) and restricted the
-- bucket to 20MB PDFs with admin-only write.
--
-- Functional rollback below removes the admin policies and bucket limits.
-- Recreating the PUBLIC upload policy is intentionally commented out —
-- uncommenting it reopens an unauthenticated file-upload hole.

begin;

drop policy if exists "previous_papers_admin_insert" on storage.objects;
drop policy if exists "previous_papers_admin_update" on storage.objects;
drop policy if exists "previous_papers_admin_delete" on storage.objects;

-- Remove bucket restrictions (previous values were unset)
update storage.buckets
set file_size_limit = null,
    allowed_mime_types = null
where id = 'previous-papers';

-- DANGER: original insecure policy. Do NOT uncomment unless you fully
-- accept that any anonymous visitor can upload arbitrary files.
-- create policy "Allow public upload previous papers"
-- on storage.objects for insert
-- to anon, authenticated
-- with check (bucket_id = 'previous-papers');

commit;
