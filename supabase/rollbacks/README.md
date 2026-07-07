# Rollback SQL — AP/TS Exam Hub

One rollback file per applied migration, named `rollback_<version>_<name>.sql`.
To roll back, run files in **reverse chronological order** (highest version first),
stopping at the migration you want to keep.

## Rollback policy (important)

1. **Security-hardening migrations never get automatic reversal.**
   Rolling back a security fix reintroduces the vulnerability it closed.
   For those files, the functional state is preserved and the dangerous
   reversal SQL is included but **commented out**, marked `-- DANGER`.
   Uncomment only with a deliberate, documented decision.

2. **Data migrations (backfills, admin flag) are noted where irreversible.**
   Deleting backfilled profile rows would break auth-linked data; those
   rollbacks are no-ops with explanation.

3. Every file is idempotent (`if exists` guards) and wrapped in a transaction
   where the statements allow it.

## Verified against production

Each rollback was written from the exact SQL stored in
`supabase_migrations.schema_migrations` on project `ijqdjlkzcygfjkmciqyy`
(fetched 2026-07-07), not from memory.

## After rolling back

Also delete the corresponding row from `supabase_migrations.schema_migrations`
so migration history matches reality:

```sql
delete from supabase_migrations.schema_migrations where version = '<version>';
```
