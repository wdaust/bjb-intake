---
description: CAOS project context — the BJB personal-injury law firm's case-advancement operating system. Use this skill whenever working on the CAOS codebase (bjb-intake repo) — for tech stack, file layout, design system, API patterns, Drizzle schema conventions, and deployment procedures. Invoke on any CAOS task before exploring the codebase.
---

# CAOS Project Context

## Who this is for

BJB (Brandon J. Broderick Law) — personal-injury firm. CAOS = "Case Advancement Operating System." Replaces / supplements Litify for the case-manager day-to-day.

## Architecture one-pager

```
 Browser (React 19 + Vite + Tailwind + shadcn/ui)
    │
    ├── Firebase Auth (email/password, single tenant)
    └── Firebase Callable Functions (us-central1)
          │
          ├── Neon Postgres (source of truth for CAOS-owned data)
          └── Salesforce/Litify (source of truth for legacy matter data)
                │
                └── sync/ worker (Node) — Litify → Neon mirror
```

**Client never talks to Neon directly.** Browser → Callable Function → Neon. Postgres creds live as Firebase Secret (`DATABASE_URL`), never in the client bundle.

## File layout

- `src/` — React app
  - `src/pages/` — route components (Caseload, CaseSnapshot, Timeline, FlowBuilder, GuidedCall, ManagerDashboard, Login, PostCallSummary, IntakeQueue, …)
  - `src/components/` — shared; `ui/` is shadcn primitives (Button, Card, Dialog, Sheet, Table, etc.)
  - `src/lib/` — helpers, Firebase init, API client, utils
  - `src/db/schema.ts` — Drizzle schema (type-only from browser via `import type`)
  - `src/data/liveData.ts` — API wrapper that calls Firebase Functions
  - `src/types/` — shared TS types
- `functions/` — Firebase Callable Functions
  - `functions/src/index.ts` — entry, function registry
  - `functions/src/db.ts` — Neon client with type parsers (date fields return strings, not Date objects — critical for Callable serialization)
  - `functions/src/auth.ts` — `requireAuth` middleware
  - `functions/src/scoring/` — AI scoring rubrics (intakeRubric.ts, cmCallRubric.ts)
- `sync/` — Litify → Neon sync worker (runs on demand via `npm run sync`)
- `scripts/` — one-off scripts (seed, rotate, check-data)
- `demo/` — demo assets (audio, generate scripts) for the Monday demo
- `drizzle/` — generated migrations

## Tech stack

- **Frontend:** React 19, Vite 8, TypeScript (strict + noUncheckedIndexedAccess), Tailwind CSS, shadcn/ui (Base UI primitives underneath), Geist fonts currently — migrating to **Inter Variable**
- **Backend:** Firebase Functions v2 (Node 20), `@neondatabase/serverless` driver, zod validation on every callable input
- **DB:** Neon Postgres; Drizzle ORM (schema = source of truth); `drizzle-kit generate` for migrations
- **Auth:** Firebase Auth
- **Hosting:** Firebase Hosting (`bjb-intake.web.app`)
- **Litify sync:** standalone Node worker, reads Salesforce API, writes to `sf_*` tables in Neon

## Design system (2026)

Per design research agent, dark-mode primary (user preference; research recommends light):

```
bg:       #0B0B0A   warm near-black
surface:  #141412
border:   #26251F
text:     #EDECE5
muted:    #8A897F
accent:   #6B8DFF
ai-tint:  #1B1930   subtle lavender bg for AI-generated cells
success:  #16A34A (with pale-tint bg)
warning:  #D97706
danger:   #DC2626
```

**Fonts:** Inter Variable (primary), JetBrains Mono (IDs, timestamps, amounts).
**Body size:** 13px (tight density, Linear/Attio style).
**Radius:** 6px default (`rounded-md`), 8px for cards, 4px for inputs/buttons.
**Elevation:** border-first, no shadows on cards. One shadow for popovers only.

**Anti-patterns to avoid:**
- No gradients, no glassmorphism, no circular gauges, no sparkle emoji for AI.
- No full-saturation status colors. Use `bg-{color}/10 text-{color}-300 border-{color}/20`.
- No real-time tickers (destroy focus); 5-min refresh is plenty.
- No firm-wide public leaderboards.

**Three Linear patterns to adopt:**
1. Cmd+K command palette as primary nav.
2. Hover-reveal row actions.
3. Inline pill-click status editing.

## API patterns

### Adding a new Callable Function

1. In `functions/src/index.ts`, export a new callable:

```ts
import { onCall } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { sql, DATABASE_URL } from './db'
import { requireAuth } from './auth'

const runWith = { secrets: [DATABASE_URL] }
const inputSchema = z.object({ ...: z.string() })

export const myFunction = onCall(runWith, async (request) => {
  requireAuth(request)
  const input = inputSchema.parse(request.data ?? {})
  const s = sql()
  const rows = await s`SELECT ... WHERE x = ${input.x}`
  return { rows }
})
```

2. From the client, call via `src/lib/api.ts`:

```ts
const fnMyFunction = callable<InputType, OutputType>('myFunction')
const res = await fnMyFunction({ x: 'foo' })
```

3. Deploy with `firebase deploy --only functions:myFunction --project bjb-intake` (specific function) or `firebase deploy --only functions --force` (all).

### Drizzle schema convention

- Column names are snake_case in DB, camelCase in Drizzle.
- `.$inferSelect` gives you the TypeScript row type.
- Client imports types from `@/db/schema` via `import type` only — never runtime import, or Drizzle ships to browser.
- Raw-SQL path consumes `SfMatterRow`-style snake_case interfaces defined in `src/db/schema.ts`.

### Dates: critical gotcha

`@neondatabase/serverless` returns DATE/TIMESTAMP columns as JS `Date` objects. Firebase Callable JSON serialization flattens Dates to `{}`, breaking the client. Fix lives in `functions/src/db.ts`:

```ts
import { types } from '@neondatabase/serverless'
types.setTypeParser(1082, (v: string) => v)  // DATE
types.setTypeParser(1114, (v: string) => v)  // TIMESTAMP
types.setTypeParser(1184, (v: string) => v)  // TIMESTAMPTZ
```

Always preserve this. Otherwise dates in payloads serialize as `{}` and the client produces NaN displays.

### Litify join convention

`sf_matters.client_id` is a Salesforce **Account Id** (001...), not a Contact Id (003...). Canonical join: `sf_matters.client_id = sf_contacts.account_id`. One Account can have many Contacts, so use LATERAL to pick one per matter:

```sql
LEFT JOIN LATERAL (
  SELECT * FROM sf_contacts c2
  WHERE c2.account_id = m.client_id
  ORDER BY c2.synced_at DESC NULLS LAST
  LIMIT 1
) c ON true
```

## Deployment runbook (abbreviated — see DEPLOY.md)

1. Set Firebase secrets: `firebase functions:secrets:set DATABASE_URL` (etc.)
2. Build + deploy: `cd functions && npm run build && cd .. && firebase deploy --only functions,firestore:rules`
3. Client: `npm run build && firebase deploy --only hosting`

Firebase project: `bjb-intake`. Hosting URL: `bjb-intake.web.app`. Blaze plan required (Functions).

## Gotchas

- **Cloud Run `allUsers` invoker** must be granted to Callable Functions (v2 gen) so the Firebase client can call them. Grant via `gcloud run services add-iam-policy-binding {fn-name} --member=allUsers --role=roles/run.invoker --region=us-central1`.
- **Drizzle schema changes** require `drizzle-kit generate` + apply migration. Don't hand-edit Neon tables.
- **Building on the worktree vs main repo:** main repo is at `/Users/daustmac/Documents/bjb-intake`. Worktrees under `.claude/worktrees/` are stale; always build against the main path.

## Key conventions

- **`import type`** for type-only imports so runtime isn't bundled
- **`@/foo` imports** map to `src/foo` via `tsconfig.app.json` `paths`
- **Auth first** in every Callable — `requireAuth(request)` before any work
- **Zod parse** every Callable input
- **Secrets only via `defineSecret`** — never env vars on the browser

## Existing skills in this repo

- `.claude/skills/caos-project/` — this skill
- `.claude/skills/intake-qualification/` — v8 qualification rubric + scoring guidance
- `.claude/commands/codebase-review.md` — multi-agent review slash command
