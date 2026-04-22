---
description: Multi-agent review of the entire codebase across security, bugs, types, performance, data integrity, and quality. Aggregates findings into a prioritized P0/P1/P2 report.
---

# /codebase-review

Run a multi-agent static review of the **whole codebase** (not just the current diff). Spawn 6 specialist agents in parallel, each with its own context, then merge their findings into a single prioritized report.

This is the local counterpart to Anthropic's built-in `/ultrareview` (which only covers branch diffs). Use this for full-app audits, pre-launch checks, or periodic health sweeps.

## Execution plan

Launch the 6 agents below in a **single message with 6 parallel `Agent` tool calls** (do not run sequentially). All use `subagent_type: "general-purpose"` unless a more specific agent fits. Each agent:

- Gets a narrow focus area (below)
- Is told to read files directly (Glob / Grep / Read) — no web browsing
- Returns findings as a ranked list with **file:line** references and a proposed fix
- Is told to cap response at ~400 words and skip preamble

### Agent 1 — Security
Focus: exposed secrets, XSS / innerHTML, auth & session logic, Firebase/Firestore rules, missing input validation, unsafe redirects, CSRF on any API endpoints, dependency CVEs (check `package.json`), `.env` handling, PII logging.

### Agent 2 — Bugs & logic
Focus: null/undefined dereferences, missing error handling (unawaited promises, unhandled catches), race conditions in async flows, off-by-one, stale closures in React hooks, wrong dependency arrays in `useEffect`/`useMemo`/`useCallback`, incorrect optimistic updates.

### Agent 3 — Type safety
Focus: `any` / `unknown` abuse, unsafe type assertions (`as Foo`), `@ts-ignore` / `@ts-expect-error`, loose function signatures, missing discriminated unions where they'd help, Drizzle schema vs. TS type drift, `tsconfig` strictness gaps.

### Agent 4 — Performance
Focus: unnecessary re-renders, missing `memo` / `useMemo` / `useCallback` where profiler-obvious, N+1 queries (Drizzle, Firestore), large bundle imports (barrel files, non-tree-shakeable imports), synchronous heavy work on render, image/asset size, missing pagination or virtualization on lists.

### Agent 5 — Data integrity
Focus: Drizzle schema ↔ Firestore sync correctness (see `sync/` folder), migration safety, transactional boundaries, denormalized data drift, required-vs-optional mismatches between DB schema and app types, seed script realism (`scripts/seed.ts`), data validation at app ingress points.

### Agent 6 — Code quality
Focus: duplication, dead code, unused exports, overly large components (>300 lines), God objects, inconsistent naming, deep prop drilling that should be context, leaky abstractions, React anti-patterns (e.g. keys from index, state in refs), unclear domain boundaries.

## After agents return

Synthesize into a **single prioritized report**:

- **P0 — ship-blockers** (data loss, auth bypass, crash loops, leaked secrets)
- **P1 — should fix soon** (correctness bugs, perf cliffs, type unsafety in hot paths)
- **P2 — nice to have** (quality, duplication, minor perf)

For each finding:
- Title (one line)
- `path/to/file.ts:LINE` reference
- 1–2 sentences: what's wrong, why it matters
- Proposed fix (code snippet if small, else approach)

**Deduplicate** overlapping findings across agents. When two agents flag the same issue from different angles, merge them and keep the stronger explanation.

End with a **summary table**: count by priority, count by area, 3 highest-leverage fixes.

## Scope notes

- Review the whole `src/` tree, plus `sync/`, `scripts/`, `drizzle.config.ts`, `firebase.json`, Firestore rules if present.
- Skip `node_modules/`, `dist/`, `public/`, lock files.
- No git operations. No code changes. Report only.
