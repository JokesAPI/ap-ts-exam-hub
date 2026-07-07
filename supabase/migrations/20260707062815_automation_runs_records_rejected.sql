alter table automation_runs
  add column if not exists records_rejected integer default 0;

comment on column automation_runs.records_rejected is
  'Drafts created this run that failed validate_draft() and need admin attention.';
