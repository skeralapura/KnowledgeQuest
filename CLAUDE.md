# KnowledgeQuest — Claude Code Guide

## Project Overview

K–8 adaptive quiz app (math, with physics/chemistry/earth science planned).

**Stack:** Next.js 14 App Router · Supabase (PostgreSQL) · Claude API (`claude-sonnet-4-5`) · Tailwind CSS · Vercel

---

## Architecture

```
app/
  (auth)/         — login + onboarding — no NavBar
  (app)/          — quest-board + report — NavBar via group layout
  session/[topicId]/  — session screen — own layout, no NavBar
  api/            — all API routes (server-side only)
lib/              — shared server logic: claude.ts, guardrails.ts, mastery.ts, streak.ts, dedup.ts
supabase/
  migrations/     — schema (001), functions (002), RLS (003)
  functions/weekly-digest/  — Deno edge function (excluded from tsconfig)
scripts/          — seed generation scripts
```

---

## Critical Conventions

### 1. Supabase client always needs `as any` cast
The hand-written `lib/database.types.ts` doesn't perfectly match all queries. All `.from()` and `.rpc()` calls go through:
```ts
const db = supabase as any;
```

### 2. Postgres function parameters use `p_` prefix
All three RPC functions require the prefix — without it you get "not found in schema cache":
```ts
// CORRECT
await db.rpc("compute_topic_score", { p_student_id: id, p_topic_id: topicId });
await db.rpc("upsert_question_seen", { p_student_id: id, p_hash: hash, p_was_correct: wasCorrect });
await db.rpc("compute_weekly_report", { p_student_id: id, p_week_start: weekStart });
```

### 3. Design tokens are CSS custom properties, never Tailwind colors
```ts
// CORRECT
style={{ color: "var(--color-accent-violet)", background: "var(--color-bg-surface)" }}

// WRONG — do not use
className="text-violet-500 bg-slate-800"
```
Tailwind is used only for layout utilities (flex, grid, gap, padding, etc.).

### 4. Supabase edge functions excluded from TypeScript
`supabase/functions/` is in `tsconfig.json` `exclude` list. Deno imports (`https://esm.sh/...`) break the Next.js compiler. Do not add it back.

### 5. Server Components cannot have event handlers
Any `onClick`, `onFocus`, `onChange`, etc. must live in a `"use client"` component. Extract to a sub-component rather than adding `"use client"` to a whole page/layout.

### 6. NavBar only renders in the `(app)` route group
`app/(app)/layout.tsx` wraps quest-board and report. Session and auth pages intentionally have no NavBar. Do not add NavBar to `app/layout.tsx` (root).

### 7. `choices` is a separate array field — never parse from question text
For `multiple_choice` format, Claude returns `choices: string[]` as a dedicated JSON field alongside `question`. The `question` field contains only the question stem. Never try to split/parse choices out of question text.

### 8. Session resume via `sessionStorage`
Key: `sq_session_${topicId}`. Stores `{ questionIndex, difficultyOffset, excludedHashes, totalXP, attempts, lastMasteryStatus, sessionId }`. Cleared on session complete or Play Again.

---

## Dev Workflow

```bash
# Local dev
npm run dev                      # localhost:3000

# Fix stale webpack chunk errors (Cannot find module './XXX.js')
rm -rf .next && npm run dev

# Production build check
node_modules/.bin/next build

# Reset test user
# → Supabase dashboard → Authentication → Users → delete row
# (cascades to all student data via ON DELETE CASCADE)

# Run SQL migrations
# → Supabase dashboard → SQL Editor → paste and run
```

---

## Known Gotchas

- **RPC `p_` prefix**: If you see "Could not find the function public.X(param1, param2) in the schema cache" — the call site is missing `p_` on parameter names.
- **`app/page.tsx`** redirects to `/quest-board`; `middleware.ts` then enforces auth. Don't restore the default Next.js template page.
- **Quest board grade filter**: Only grades `>= student.current_grade` are shown. Grades below enrolled grade are hidden (remediation path not yet implemented).
- **`effective_grade` computation**: `Math.round(1 + offset)`, clamped 1–8. `difficulty` is `Math.round(5 + offset)`, clamped 1–10.
- **Topic name in session**: Stored in `sessionStorage` as `sq_topic_name_${topicId}` by the quest board before navigating to the session route.
- **Supabase + Next.js fetch caching**: `createClient` (service role) internally uses `fetch`, which Next.js 14 caches by default. Always pass `global: { fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }) }` to the admin client.
- **Two-client pattern for API routes**: Use `createServerClient` (cookie-based, anon key) only for `auth.getUser()`. Use a separate `createClient` (service role) with `cache: "no-store"` for all data queries. The cookie-based client has unreliable RLS behaviour when used for data queries.
- **Navigate away from session with `window.location.href`**: `router.push()` may serve the quest board from Next.js router cache, preventing the component from remounting and re-fetching fresh scores.
- **`compute_weekly_report` accuracy**: stored as decimal 0–1, not percentage. The UI multiplies by 100 to display. Don't store as percentage in the SQL function.
- **Nested aggregates in Postgres**: `jsonb_agg(jsonb_build_object('x', count(*)))` is invalid. Compute aggregates in a subquery first, then wrap with `jsonb_agg`.
