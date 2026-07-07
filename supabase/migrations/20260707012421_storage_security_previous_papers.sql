update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['application/pdf']
where id = 'previous-papers';

drop policy if exists "Allow public upload previous papers" on storage.objects;

create policy "previous_papers_admin_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'previous-papers'
  and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

create policy "previous_papers_admin_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'previous-papers'
  and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
)
with check (
  bucket_id = 'previous-papers'
  and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

create policy "previous_papers_admin_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'previous-papers'
  and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);