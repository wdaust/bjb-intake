import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { defineSecret } from 'firebase-functions/params'

// Neon connection string stored as a Firebase secret.
// Set via: firebase functions:secrets:set DATABASE_URL
export const DATABASE_URL = defineSecret('DATABASE_URL')

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
