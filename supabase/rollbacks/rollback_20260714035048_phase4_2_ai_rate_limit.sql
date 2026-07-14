-- ROLLBACK for 20260714035048_phase4_2_ai_rate_limit
-- Drops the rate-limit table and function. No other tables affected.
-- After this, api/groq-chat.js's rate-limit call will fail; the API code
-- must be reverted together with this rollback (see the accompanying
-- application-code rollback command).

begin;

drop function if exists public.check_and_increment_ai_rate_limit(uuid, integer);
drop table if exists public.ai_rate_limits;

commit;
