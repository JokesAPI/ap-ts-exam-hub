revoke execute on function publish_draft(uuid, uuid) from public, anon, authenticated;
revoke execute on function approve_draft(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function reject_draft(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function validate_draft(uuid) from public, anon, authenticated;
revoke execute on function check_duplicate_draft(text, text, text, text) from public, anon, authenticated;