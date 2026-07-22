# Archive

This directory holds historical code that is **not used by production**.
Everything here is kept for history and disaster-recovery reference only.

## What's here

- `legacy-supabase-edge-functions/` — an earlier implementation of the
  payment and AI-chat server-side logic, written as Supabase Edge
  Functions (Deno runtime).
- `dangerous-legacy-sql/` — early schema and seed-data scripts that
  predate the current hardened database. See that folder's own
  `README.md` before doing anything with these files.

## Why these aren't in the active codebase

**`api/*.js` (Vercel serverless functions) is the current, actively
maintained implementation** of order creation, payment verification,
and AI chat. The Edge Function versions in this archive were an
earlier approach to the same features. No Supabase Edge Function is
currently deployed to the production project — confirmed via the
Supabase project's function list at the time this archive was created.

## Rules for anyone touching this directory

- **Archived Supabase Edge Functions must not be deployed** without a
  fresh security review. They predate the payment-security hardening
  that `api/verify-payment.js` and `api/create-order.js` have since
  received, and they have not been kept in sync with it.
- **Archived SQL must never be executed against production**, or
  against any environment that shares data or credentials with
  production. See `dangerous-legacy-sql/README.md` for specifics on
  why each file is dangerous.
- If you believe one of these files should come back into active use,
  that is a deliberate decision requiring its own review — not
  something to do by copying a file out of this directory.

No secrets or credentials are stored in this directory or in any
README within it.
