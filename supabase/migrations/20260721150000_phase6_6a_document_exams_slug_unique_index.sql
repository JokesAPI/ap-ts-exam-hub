-- ============================================================================
-- Phase 6.6A — Repository integrity: document exams_slug_key
--
-- Root cause: production has carried a unique index on exams.slug --
--   CREATE UNIQUE INDEX exams_slug_key ON public.exams USING btree (slug)
--     WHERE (slug IS NOT NULL)
-- -- that exists in no migration file, no supabase_migrations.schema_migrations
-- row, and no other place in this repository. Confirmed via:
--   - pg_indexes: the index is live, definition captured above verbatim
--   - supabase_migrations.schema_migrations: all 32 tracked entries checked,
--     none reference "slug" in their name
--   - repository-wide grep (including legacy questions-data.sql and
--     supabase-schema-v2.sql): zero references to "exams_slug_key" anywhere
--
-- This migration does not change production. It exists solely so the
-- repository's migration history matches what is already live -- closing the
-- governance drift, not the (already-closed, out-of-band) data-integrity gap.
--
-- CREATE UNIQUE INDEX IF NOT EXISTS is idempotent and a no-op when the index
-- already exists with this exact name: Postgres does not compare or rebuild
-- the existing index's definition, it only checks whether an index with this
-- name is already present in the schema. No table rewrite (an existing btree
-- index is left untouched), no data touched, no function/trigger/RLS/policy
-- change of any kind.
-- ============================================================================

create unique index if not exists exams_slug_key
  on public.exams (slug)
  where (slug is not null);
