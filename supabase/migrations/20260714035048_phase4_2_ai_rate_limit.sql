-- ============================================================================
-- Phase 4.2 — AI rate limiting (Option A)
--
-- Minimal, additive schema: one table + one atomic RPC. Enforces
-- "max 20 requests per hour per authenticated user" for /api/groq-chat.
--
-- Why a table (not in-memory): Vercel serverless functions are stateless
-- across cold starts and concurrent instances, so any in-memory counter
-- would not reliably enforce the limit. This table + a single atomic
-- INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING is race-safe across any
-- number of concurrent invocations.
--
-- Called ONLY from the backend (api/groq-chat.js) using the service-role
-- client that already exists there — no new environment variable required.
-- ============================================================================

begin;

create table if not exists public.ai_rate_limits (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  window_start  timestamptz not null,   -- start of the current hour bucket (UTC)
  request_count integer not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, window_start)
);

-- Only recent windows are ever queried; keeps the table small even without a
-- cleanup job (old rows are cheap to leave — one row per user per hour).
create index if not exists idx_ai_rate_limits_window on public.ai_rate_limits(window_start);

alter table public.ai_rate_limits enable row level security;
-- No policies for anon/authenticated: this table is written ONLY via the
-- SECURITY DEFINER function below, called by the server with the
-- service-role key (which bypasses RLS). Deny-by-default otherwise.

revoke all on public.ai_rate_limits from anon, authenticated;

-- ── Atomic check-and-increment ───────────────────────────────────────────────
create or replace function public.check_and_increment_ai_rate_limit(
  p_user_id       uuid,
  p_max_per_hour  integer default 20
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window  timestamptz := date_trunc('hour', now());
  v_count   integer;
begin
  -- Single atomic statement: safe under concurrent requests from the same
  -- user hitting different serverless instances at the same time.
  insert into public.ai_rate_limits (user_id, window_start, request_count, updated_at)
  values (p_user_id, v_window, 1, now())
  on conflict (user_id, window_start)
  do update set request_count = ai_rate_limits.request_count + 1,
                updated_at    = now()
  returning request_count into v_count;

  if v_count > p_max_per_hour then
    return jsonb_build_object(
      'allowed', false,
      'limit', p_max_per_hour,
      'remaining', 0,
      'retry_after_seconds', greatest(0, extract(epoch from (v_window + interval '1 hour' - now()))::int)
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'limit', p_max_per_hour,
    'remaining', p_max_per_hour - v_count,
    'retry_after_seconds', 0
  );
end;
$$;

-- Only the server (service_role) may call this — it takes an arbitrary
-- p_user_id, so an authenticated user calling it directly could inspect or
-- influence another user's bucket. Deny by default; do not grant to anon/authenticated.
revoke all on function public.check_and_increment_ai_rate_limit(uuid, integer) from public, anon, authenticated;
grant execute on function public.check_and_increment_ai_rate_limit(uuid, integer) to service_role;

commit;
