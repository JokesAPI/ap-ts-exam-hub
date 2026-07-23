// Phase 8.1 -- single source of truth for Subject -> default Mock Test
// (test_id) routing. Read by src/lib/questionImport.js ONLY, which
// AdminQuestions.jsx's bulkImport() calls.
//
// Do not duplicate these values in README tables, CSV examples, the
// QuestionBank repository, or any other JS file. If a mapping needs to
// change, change it here -- nothing else should hardcode a subject-to-test
// relationship.
//
// Keys are the exact canonical Subject strings used throughout the
// QuestionBank content standard (case-sensitive; resolveImportTestId()
// trims whitespace but does not fold case, so a typo'd subject fails
// loudly instead of silently near-matching the wrong entry).
//
// Only subjects with a real, existing `mock_tests.test_id` row are listed.
// The remaining canonical subjects (Indian History, TS History, Indian
// Geography, TS Geography, Arithmetic, Reasoning, English, Computer
// Awareness, Environment, General Knowledge) intentionally have no entry
// yet -- their `mock_tests` catalog rows have not been created (deferred,
// per Phase 8.1 scope). Importing a batch for one of those subjects today
// will correctly fail with "unknown subject" until its entry is added here
// AND a matching catalog row exists.
export const SUBJECT_TEST_MAP = {
  'Indian Polity': 'indian-polity',
  'Indian Economy': 'indian-economy',
  'General Science': 'general-science',
  'AP History': 'ap-history',
  'AP Geography': 'ap-geography',
  // Current Affairs is a deliberate exception, not a slugified guess --
  // exactly why this is an explicit lookup table and not a formula.
  'Current Affairs': 'current-affairs-apts',
}
