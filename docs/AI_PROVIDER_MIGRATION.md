# AI Provider Migration — Groq → OpenAI

**Date:** 2026-07-10 · **Branch:** v2-development · Base: `e009d48`
**Branding unchanged:** website remains **AP TS Exam Hub**.

## Summary

Migrated the entire AI stack from Groq to OpenAI while preserving every
feature and the frontend contract. No database migrations, no schema changes,
no UI redesign, no new required env vars beyond `OPENAI_API_KEY` /
`OPENAI_MODEL` (already configured in Vercel).

## Audit (what used Groq)

- **Backend:** `api/groq-chat.js` (Vercel serverless — the live path) and
  `supabase/functions/groq-chat/index.js` (dormant Supabase edge fn).
- **Helper:** `src/lib/ai.js` (`callAI`) — provider-neutral; posts to
  `/api/groq-chat`. (The `callGroq`→`callAI` rename + `groq.js`→`ai.js` was
  already in the tree; consolidated here.)
- **Consumers:** `studyPlanner.js`, `aiQuestionGen.js`, `GeniusAI.jsx`,
  `MockTests.jsx`.
- **Python automation:** `scripts/generate_current_affairs_v2.py`.

## Changes

**Backend (`api/groq-chat.js`)** — now calls
`https://api.openai.com/v1/chat/completions` with `process.env.OPENAI_API_KEY`
and `const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'`. Uses
`max_completion_tokens` (newer OpenAI models). **Route path kept as
`/api/groq-chat`** for backward compatibility — the frontend contract
(`{ system, messages }` → `{ reply }`) is unchanged. Error log tag → `ai-chat`.

**Helper (`src/lib/ai.js`)** — `callAI(system, messages)`; unchanged fetch to
`/api/groq-chat`, returns `data.reply`. All four consumers import `callAI`.

**Frontend branding** — "Powered by Groq AI" → "Powered by OpenAI"; the stale
`VITE_GROQ_API_KEY` error hint removed; AdminQuestions copy "with Groq" →
"with AI". No other UI changes.

**Python (`generate_current_affairs_v2.py`)** — `OPENAI_API_KEY`,
`OPENAI_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')`, endpoint →
OpenAI, `call_groq`→`call_ai`, `GROQ_MAX_RETRIES`→`AI_MAX_RETRIES`,
`ai_model` tag → `openai/{model}`. Retry/parse logic unchanged.

**Dormant edge fn** — aligned to OpenAI for consistency (still unused by the
app; documented as dormant).

## Model configuration

`process.env.OPENAI_MODEL || 'gpt-4o-mini'` everywhere (backend, edge fn, Python).
The exact GPT-5.5 API string could not be verified at authoring time; the env
var lets you override without a code change if the identifier differs.

## Security review

- No API key or provider endpoint anywhere in `src/` (verified: 0 refs). Keys
  only in server-side files (`api/`, `scripts/`, `supabase/functions/`).
- No `VITE_*` client key references. No service-role exposure. All AI requests
  are server-side.

## Performance

- No new dependencies. No bundle change (helper swap only; lazy loading of the
  Study Planner preserved — still its own chunk).

## Testing

- `npm run build` passes; all AI features compile.
- Call-path check: Study Planner, Question + Explanation Generator, Genius AI,
  AI Mock Tests all import `callAI` and resolve to the OpenAI backend.
- Response contract `{reply}` preserved on both ends.
- Runtime AI output depends on the live `OPENAI_API_KEY`/`OPENAI_MODEL` in the
  deployed environment (not exercised here; no fabricated output).

## Rollback

Single commit → `git revert`. No DB changes, so rollback is purely code. The
provider/model are env-driven, so a wrong model string can also be corrected
by changing `OPENAI_MODEL` without a redeploy.
