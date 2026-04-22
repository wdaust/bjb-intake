import { neon, types, type NeonQueryFunction } from '@neondatabase/serverless'
import { defineSecret } from 'firebase-functions/params'

// Neon connection string stored as a Firebase secret.
// Set via: firebase functions:secrets:set DATABASE_URL
export const DATABASE_URL = defineSecret('DATABASE_URL')

/**
 * Override date/timestamp parsers so they stay as strings instead of
 * becoming JS `Date` objects.
 *
 * Why: Firebase Callable Functions serialize responses via JSON.stringify.
 * `Date` objects have no enumerable own properties, so they round-trip
 * to the client as `{}` (empty object) — which then parses as `NaN` in
 * `new Date(...)` on the client, producing the "NaNd ago" rendering bug.
 *
 * Keeping dates as raw Postgres strings (`YYYY-MM-DD` for DATE,
 * ISO-like for TIMESTAMPTZ) serializes cleanly and parses cleanly on
 * the client.
 *
 * OIDs:
 *   1082 — DATE
 *   1114 — TIMESTAMP (without timezone)
 *   1184 — TIMESTAMPTZ
 *
 * Run at module load so it applies to every handler's first query.
 */
const DATE_OIDS = [1082, 1114, 1184]
const identity = (v: string) => v
for (const oid of DATE_OIDS) {
  types.setTypeParser(oid, identity)
}

let cached: NeonQueryFunction<false, false> | null = null

/**
 * Lazy-init the Neon SQL tag. Must be called inside a function handler
 * (not at module load) so the secret is bound.
 */
export function sql(): NeonQueryFunction<false, false> {
  if (!cached) {
    const url = DATABASE_URL.value()
    if (!url) {
      throw new Error('DATABASE_URL secret is not configured')
    }
    cached = neon(url)
  }
  return cached
}
