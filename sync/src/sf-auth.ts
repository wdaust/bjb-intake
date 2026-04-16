/**
 * Salesforce OAuth 2.0 authentication.
 * Copied from bjb-optimus-2 — Client Credentials Flow.
 */

interface SfToken {
  accessToken: string
  instanceUrl: string
  issuedAt: number
}

let cachedToken: SfToken | null = null

export async function getToken(): Promise<SfToken> {
  if (cachedToken) return cachedToken

  // Dev fallback: use SF CLI access token directly
  if (process.env.SF_ACCESS_TOKEN && process.env.SF_INSTANCE_URL) {
    cachedToken = {
      accessToken: process.env.SF_ACCESS_TOKEN,
      instanceUrl: process.env.SF_INSTANCE_URL,
      issuedAt: Date.now(),
    }
    console.log('[AUTH] Using SF CLI access token')
    return cachedToken
  }

  const clientId = process.env.SF_CLIENT_ID
  const clientSecret = process.env.SF_CLIENT_SECRET
  const loginUrl = process.env.SF_LOGIN_URL || 'https://login.salesforce.com'

  if (!clientId || !clientSecret) {
    throw new Error('Missing SF_CLIENT_ID/SF_CLIENT_SECRET.')
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SF OAuth failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as {
    access_token: string
    instance_url: string
    issued_at: string
  }

  cachedToken = {
    accessToken: data.access_token,
    instanceUrl: data.instance_url,
    issuedAt: Number(data.issued_at),
  }

  console.log(`[AUTH] Authenticated to ${cachedToken.instanceUrl}`)
  return cachedToken
}

export function clearToken(): void {
  cachedToken = null
}
