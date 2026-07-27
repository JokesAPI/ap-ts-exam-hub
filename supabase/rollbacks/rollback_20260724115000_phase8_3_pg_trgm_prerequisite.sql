-- This rollback intentionally does NOT drop pg_trgm.
--
-- Extension removal is asymmetric with respect to the forward migration on
-- purpose: pg_trgm is a shared, database-wide resource, not something this
-- one feature owns exclusively. Other current or future features could
-- reasonably come to depend on it too, and pg_trgm already existed on
-- every environment this project has touched before Phase 8.3 ever ran
-- (confirmed independently on both production and the staging candidate).
-- A rollback that dropped it on the assumption that Phase 8.3 was its only
-- consumer would risk breaking anything else relying on it, with no way
-- for this rollback script to know whether that's actually safe. Rolling
-- back Phase 8.3's own objects (the index and RPC) is handled entirely by
-- rollback_20260724120000_phase8_3c_duplicate_detection.sql; this file's
-- only job is to never remove the shared prerequisite.
do $$
begin
  raise notice 'pg_trgm is intentionally retained because it may be shared by other database features';
end
$$;
