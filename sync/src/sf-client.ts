/**
 * Salesforce SOQL query client with pagination and retry.
 * Copied from bjb-optimus-2.
 */

import { getToken, clearToken } from './sf-auth.js'

const API_VERSION = 'v62.0'
const MAX_RETRIES = 3
const RETRYABLE_CODES = new Set([429, 500, 502, 503])

interface QueryResponse<T> {
  totalSize: number
  done: boolean
  records: T[]
  nextRecordsUrl?: string
}

async function sfFetch<T>(path: string, attempt = 1): Promise<T> {
  const token = await getToken()
  const url = path.startsWith('http') ? path : `${token.instanceUrl}${path}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  })

  if (res.status === 401 && attempt === 1) {
    clearToken()
    return sfFetch<T>(path, 2)
  }

  if (RETRYABLE_CODES.has(res.status) && attempt <= MAX_RETRIES) {
    const delay = Math.pow(4, attempt - 1) * 1000
    console.warn(`[SF] ${res.status} on ${path}, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`)
    await sleep(delay)
    return sfFetch<T>(path, attempt + 1)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SF API ${res.status}: ${text.slice(0, 500)}`)
  }

  return res.json() as Promise<T>
}

export async function queryAll<T extends { Id: string }>(soql: string): Promise<T[]> {
  const allRecords: T[] = []
  const encodedSoql = encodeURIComponent(soql)
  let response = await sfFetch<QueryResponse<T>>(
    `/services/data/${API_VERSION}/query?q=${encodedSoql}`,
  )

  allRecords.push(...response.records)

  while (!response.done && response.nextRecordsUrl) {
    response = await sfFetch<QueryResponse<T>>(response.nextRecordsUrl)
    allRecords.push(...response.records)
  }

  return allRecords
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
