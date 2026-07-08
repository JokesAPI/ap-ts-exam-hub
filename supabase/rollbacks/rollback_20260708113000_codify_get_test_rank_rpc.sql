-- ============================================================================
-- ROLLBACK for 20260708113000_codify_get_test_rank_rpc
--
-- Drops the rank-prediction RPC. The frontend degrades gracefully
-- (MockTestEngine logs the RPC error and shows "Rank unavailable right now"
-- in the rank card) — no crash, but the feature disappears.
--
-- NOTE: this function pre-dated the migration in production. Rolling back
-- removes it entirely, which is a stronger action than reverting the
-- migration's own effect (which was a no-op re-apply). Only run this if you
-- intend to remove rank prediction from the product.
-- ============================================================================

begin;

drop function if exists public.get_test_rank(text, numeric);

commit;
