-- ROLLBACK for 20260709160000_phase5_question_metrics_rpc
-- Drops the metrics RPC and restores anon EXECUTE on get_automation_health
-- (its prior state). No data affected.

begin;

drop function if exists public.get_question_metrics();

-- restore prior grant state (anon could execute via PUBLIC; internal admin-gate still applied)
grant execute on function public.get_automation_health() to public;

commit;
