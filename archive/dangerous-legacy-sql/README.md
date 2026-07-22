# Dangerous legacy SQL — do not run

Both files in this folder are kept for historical reference only. They
are **not compatible with the current production schema** and running
either one against production (or any environment sharing production
data or credentials) will cause real damage.

## `questions-data.sql`

- Opens with an **unguarded `DELETE FROM mock_questions;`** — this
  deletes every row in the question bank before inserting its own
  ~200 hardcoded questions.
- The `INSERT` statements reference `test_id` values (e.g.
  `'ap-history'`, `'tspsc-gs-1'`) as free-standing strings. This
  predates the foreign-key relationship between `mock_questions` and
  `mock_tests` added in Phase 6.5A.3. Running this file today would
  first destroy all current question data, then most likely fail
  partway through on foreign-key violations, leaving the table in a
  worse state than before the file ran.
- It predates the current Question Bank architecture entirely (admin
  UI, AI draft publishing pipeline, per-test structure).

## `supabase-schema-v2.sql`

- Contains `alter table ... disable row level security` for
  `profiles`, `subscriptions`, `mock_questions`, `mock_results`,
  `bookmarks`, `contact_messages`, and `test_registrations`.
- Contains `grant all on ... to anon, authenticated` for every one of
  those tables, plus all sequences in the `public` schema.
- Running this against production would remove every RLS policy this
  project has hardened over multiple phases and give anonymous
  internet users full read/write access to other users' profiles,
  subscription/payment records, and quiz results.
- It is a snapshot of an early schema design and does not reflect any
  of the tables, constraints, or security policies added since.

## If you think you need to run one of these

Don't, without all of the following:

1. Explicit CTO / security-owner approval, obtained before touching
   either file.
2. A disposable environment with no connection to production data or
   production credentials.
3. A full read of the file's contents against the *current* schema —
   not this README's summary — since the current schema has moved on
   from what these files assume.

No secrets or credentials are stored in this file or elsewhere in this
directory.
