begin;

create index if not exists idx_mock_results_user_id on mock_results(user_id);
create index if not exists idx_bookmarks_user_id on bookmarks(user_id);
create index if not exists idx_subscriptions_user_id on subscriptions(user_id);
create index if not exists idx_payments_user_id on payments(user_id);
create index if not exists idx_mock_questions_test_id on mock_questions(test_id);

commit;