-- Rollback for 20260723090000_phase8_1_difficulty_default_null.sql
-- Metadata-only, instant, no data impact either direction.

alter table mock_questions
  alter column difficulty set default 'medium';
