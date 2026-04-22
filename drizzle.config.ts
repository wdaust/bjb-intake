import { defineConfig } from 'drizzle-kit'

/**
 * Drizzle Kit config.
 *
 * `tablesFilter` locks drizzle-kit to tables we actually model, so
 * `drizzle-kit push` can never drop or truncate a table it doesn't know
 * about (e.g. a view or a manually-created table). Expand this list as
 * the schema grows.
 *
 * Run `drizzle-kit generate` to emit a new migration SQL file into
 * `./drizzle/` after editing `src/db/schema.ts`. DO NOT use `push` in
 * production — it applies schema diffs without a migration file.
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  tablesFilter: [
    'sf_matters',
    'sf_contacts',
    'sf_users',
    'sf_team_members',
    'sf_injuries',
    'sf_damages',
    'sf_tasks',
    'sf_events',
    'sf_stage_activities',
    'sf_intakes',
    'call_flow_nodes',
  ],
})
