/**
 * Firebase Callable Functions — Neon proxy for bjb-intake.
 *
 * All DB reads/writes that used to happen in the browser now go through
 * authenticated Callable Functions. The client calls them via
 * `httpsCallable(functions, 'name')`; Firebase automatically attaches
 * the user's ID token and the runtime verifies it before invoking the
 * handler.
 *
 * Server-side SQL is the same SQL that lived in `src/data/liveData.ts`.
 * This is a drop-in proxy, not a redesign — row shapes are preserved so
 * the existing client-side mapper (`mapMatterToCase`) keeps working.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import { initializeApp } from 'firebase-admin/app'
import { z } from 'zod'

import { sql, DATABASE_URL } from './db'
import { requireAuth } from './auth'

initializeApp()
setGlobalOptions({ region: 'us-central1', maxInstances: 10 })

// Every function that touches Neon must bind the DATABASE_URL secret.
const runWith = { secrets: [DATABASE_URL] }

// --------------------------------------------------------------------
// Case managers
// --------------------------------------------------------------------

export const listCaseManagers = onCall(runWith, async (request) => {
  requireAuth(request)
  const rows = await sql()`
    SELECT u.sf_id, u.name, tm.role_name,
           COUNT(DISTINCT tm.matter_id) as case_count
    FROM sf_team_members tm
    JOIN sf_users u ON tm.user_id = u.sf_id
    JOIN sf_matters m ON tm.matter_id = m.sf_id AND m.status NOT IN ('Closed', 'Resolved') AND m.pi_status IS NOT NULL
    WHERE tm.role_name IS NOT NULL
      AND u.name IS NOT NULL
      AND (
        tm.role_name ILIKE '%paralegal%'
        OR tm.role_name ILIKE '%case manager%'
        OR tm.role_name ILIKE '%medical%'
        OR tm.role_name ILIKE '%attorney%'
      )
    GROUP BY u.sf_id, u.name, tm.role_name
    ORDER BY u.name
  `
  return { rows }
})

// --------------------------------------------------------------------
// Cases — paginated list
// --------------------------------------------------------------------

const listCasesInput = z.object({
  cmUserId: z.string().max(64).optional(),
  page: z.number().int().min(0).max(1000).default(0),
})

const PAGE_SIZE = 50

export const listCases = onCall(runWith, async (request) => {
  requireAuth(request)
  const { cmUserId, page } = listCasesInput.parse(request.data ?? {})
  const offset = page * PAGE_SIZE
  const s = sql()

  const [countRow] = cmUserId
    ? await s`
        SELECT COUNT(DISTINCT m.sf_id)::int as cnt
        FROM sf_matters m
        INNER JOIN sf_team_members tm ON tm.matter_id = m.sf_id AND tm.user_id = ${cmUserId}
        WHERE m.status NOT IN ('Closed', 'Resolved') AND m.pi_status IS NOT NULL
      `
    : await s`
        SELECT COUNT(*)::int as cnt
        FROM sf_matters
        WHERE status NOT IN ('Closed', 'Resolved') AND pi_status IS NOT NULL
      `

  const matters = cmUserId
    ? await s`
        SELECT
          m.sf_id, m.name as matter_id, m.display_name, m.status, m.case_type,
          m.practice_area, m.matter_stage, m.pi_status, m.matter_state,
          m.open_date, m.close_date, m.complaint_filed_date, m.incident_date,
          m.retention_date, m.statute_of_limitations, m.venue,
          m.client_id, m.principal_attorney_id,
          c.first_name as client_first, c.last_name as client_last,
          c.phone as client_phone, c.email as client_email,
          c.mailing_state as client_state, c.birthdate as client_dob,
          c.mailing_street, c.mailing_city,
          atty.name as attorney_name
        FROM sf_matters m
        -- sf_matters.client_id is a Salesforce Account ID (001-prefix),
        -- NOT a Contact ID. An Account can own multiple Contacts, so a
        -- plain LEFT JOIN would multiply matter rows by contacts-per-
        -- account. The LATERAL picks one contact per matter (the most
        -- recently synced) and keeps the query row-count stable.
        LEFT JOIN LATERAL (
          SELECT * FROM sf_contacts c2
          WHERE c2.account_id = m.client_id
          ORDER BY c2.synced_at DESC NULLS LAST
          LIMIT 1
        ) c ON true
        LEFT JOIN sf_users atty ON m.principal_attorney_id = atty.sf_id
        INNER JOIN sf_team_members tm ON tm.matter_id = m.sf_id AND tm.user_id = ${cmUserId}
        WHERE m.status NOT IN ('Closed', 'Resolved')
          AND m.pi_status IS NOT NULL
        ORDER BY m.open_date DESC NULLS LAST
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `
    : await s`
        SELECT
          m.sf_id, m.name as matter_id, m.display_name, m.status, m.case_type,
          m.practice_area, m.matter_stage, m.pi_status, m.matter_state,
          m.open_date, m.close_date, m.complaint_filed_date, m.incident_date,
          m.retention_date, m.statute_of_limitations, m.venue,
          m.client_id, m.principal_attorney_id,
          c.first_name as client_first, c.last_name as client_last,
          c.phone as client_phone, c.email as client_email,
          c.mailing_state as client_state, c.birthdate as client_dob,
          c.mailing_street, c.mailing_city,
          atty.name as attorney_name
        FROM sf_matters m
        -- sf_matters.client_id is a Salesforce Account ID (001-prefix),
        -- NOT a Contact ID. An Account can own multiple Contacts, so a
        -- plain LEFT JOIN would multiply matter rows by contacts-per-
        -- account. The LATERAL picks one contact per matter (the most
        -- recently synced) and keeps the query row-count stable.
        LEFT JOIN LATERAL (
          SELECT * FROM sf_contacts c2
          WHERE c2.account_id = m.client_id
          ORDER BY c2.synced_at DESC NULLS LAST
          LIMIT 1
        ) c ON true
        LEFT JOIN sf_users atty ON m.principal_attorney_id = atty.sf_id
        WHERE m.status NOT IN ('Closed', 'Resolved')
          AND m.pi_status IS NOT NULL
        ORDER BY m.open_date DESC NULLS LAST
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `

  const related = await loadRelated(matters.map((m) => m.sf_id as string))

  return {
    matters,
    ...related,
    totalCount: (countRow?.cnt as number) ?? 0,
    pageSize: PAGE_SIZE,
  }
})

// --------------------------------------------------------------------
// Single case — direct lookup (no more page-0 scan)
// --------------------------------------------------------------------

const getCaseInput = z.object({ caseId: z.string().min(1).max(64) })

export const getCase = onCall(runWith, async (request) => {
  requireAuth(request)
  const { caseId } = getCaseInput.parse(request.data ?? {})
  const s = sql()

  const matters = await s`
    SELECT
      m.sf_id, m.name as matter_id, m.display_name, m.status, m.case_type,
      m.practice_area, m.matter_stage, m.pi_status, m.matter_state,
      m.open_date, m.close_date, m.complaint_filed_date, m.incident_date,
      m.retention_date, m.statute_of_limitations, m.venue,
      m.client_id, m.principal_attorney_id,
      c.first_name as client_first, c.last_name as client_last,
      c.phone as client_phone, c.email as client_email,
      c.mailing_state as client_state, c.birthdate as client_dob,
      c.mailing_street, c.mailing_city,
      atty.name as attorney_name
    FROM sf_matters m
    -- See listCases for LATERAL rationale — one contact per matter.
    LEFT JOIN LATERAL (
      SELECT * FROM sf_contacts c2
      WHERE c2.account_id = m.client_id
      ORDER BY c2.synced_at DESC NULLS LAST
      LIMIT 1
    ) c ON true
    LEFT JOIN sf_users atty ON m.principal_attorney_id = atty.sf_id
    WHERE m.sf_id = ${caseId}
    LIMIT 1
  `

  if (matters.length === 0) return { matter: null }

  const related = await loadRelated([caseId])
  return { matter: matters[0], ...related }
})

// --------------------------------------------------------------------
// Timeline
// --------------------------------------------------------------------

const getTimelineInput = z.object({ caseId: z.string().min(1).max(64) })

export const getTimeline = onCall(runWith, async (request) => {
  requireAuth(request)
  const { caseId } = getTimelineInput.parse(request.data ?? {})
  const s = sql()

  const [tasks, damages, events] = await Promise.all([
    s`SELECT * FROM sf_tasks WHERE matter_id = ${caseId} ORDER BY activity_date DESC LIMIT 50`,
    s`SELECT * FROM sf_damages WHERE matter_id = ${caseId} ORDER BY service_start_date DESC LIMIT 50`,
    s`SELECT * FROM sf_events WHERE matter_id = ${caseId} ORDER BY start_date DESC LIMIT 50`,
  ])

  return { tasks, damages, events }
})

// --------------------------------------------------------------------
// CM stats
// --------------------------------------------------------------------

const getCmStatsInput = z.object({ cmUserId: z.string().max(64).optional() })

export const getCmStats = onCall(runWith, async (request) => {
  requireAuth(request)
  const { cmUserId } = getCmStatsInput.parse(request.data ?? {})
  const s = sql()

  const [row] = cmUserId
    ? await s`
        SELECT
          COUNT(DISTINCT m.sf_id)::int as total,
          COUNT(DISTINCT CASE WHEN d.last_svc < now() - interval '14 days' THEN m.sf_id END)::int as gap14,
          COUNT(DISTINCT CASE WHEN d.last_svc < now() - interval '30 days' OR d.last_svc IS NULL THEN m.sf_id END)::int as no_recent,
          COUNT(DISTINCT CASE WHEN d.last_svc < now() - interval '30 days' AND t.open_tasks > 2 THEN m.sf_id END)::int as urgent
        FROM sf_matters m
        INNER JOIN sf_team_members tm ON tm.matter_id = m.sf_id AND tm.user_id = ${cmUserId}
        LEFT JOIN (SELECT matter_id, MAX(service_end_date) as last_svc FROM sf_damages GROUP BY matter_id) d ON d.matter_id = m.sf_id
        LEFT JOIN (SELECT matter_id, COUNT(*)::int as open_tasks FROM sf_tasks WHERE is_closed = false GROUP BY matter_id) t ON t.matter_id = m.sf_id
        WHERE m.status NOT IN ('Closed', 'Resolved') AND m.pi_status IS NOT NULL
      `
    : await s`
        SELECT
          COUNT(*)::int as total,
          COUNT(CASE WHEN d.last_svc < now() - interval '14 days' THEN 1 END)::int as gap14,
          COUNT(CASE WHEN d.last_svc < now() - interval '30 days' OR d.last_svc IS NULL THEN 1 END)::int as no_recent,
          COUNT(CASE WHEN d.last_svc < now() - interval '30 days' AND t.open_tasks > 2 THEN 1 END)::int as urgent
        FROM sf_matters m
        LEFT JOIN (SELECT matter_id, MAX(service_end_date) as last_svc FROM sf_damages GROUP BY matter_id) d ON d.matter_id = m.sf_id
        LEFT JOIN (SELECT matter_id, COUNT(*)::int as open_tasks FROM sf_tasks WHERE is_closed = false GROUP BY matter_id) t ON t.matter_id = m.sf_id
        WHERE m.status NOT IN ('Closed', 'Resolved') AND m.pi_status IS NOT NULL
      `

  return {
    totalCases: (row?.total as number) ?? 0,
    urgent: (row?.urgent as number) ?? 0,
    gap14: (row?.gap14 as number) ?? 0,
    noRecentTreatment: (row?.no_recent as number) ?? 0,
  }
})

// --------------------------------------------------------------------
// Search
// --------------------------------------------------------------------

const searchInput = z.object({ query: z.string().min(2).max(100) })

export const searchCases = onCall(runWith, async (request) => {
  requireAuth(request)
  const { query } = searchInput.parse(request.data ?? {})
  const pattern = `%${query}%`
  const s = sql()

  const matters = await s`
    SELECT
      m.sf_id, m.name as matter_id, m.display_name, m.status, m.case_type,
      m.practice_area, m.matter_stage, m.pi_status, m.matter_state,
      m.open_date, m.close_date, m.complaint_filed_date, m.incident_date,
      m.retention_date, m.statute_of_limitations, m.venue,
      m.client_id, m.principal_attorney_id,
      c.first_name as client_first, c.last_name as client_last,
      c.phone as client_phone, c.email as client_email,
      c.mailing_state as client_state, c.birthdate as client_dob,
      c.mailing_street, c.mailing_city,
      atty.name as attorney_name
    FROM sf_matters m
    -- See listCases for LATERAL rationale — one contact per matter.
    LEFT JOIN LATERAL (
      SELECT * FROM sf_contacts c2
      WHERE c2.account_id = m.client_id
      ORDER BY c2.synced_at DESC NULLS LAST
      LIMIT 1
    ) c ON true
    LEFT JOIN sf_users atty ON m.principal_attorney_id = atty.sf_id
    WHERE m.status NOT IN ('Closed', 'Resolved')
      AND m.pi_status IS NOT NULL
      AND (
        m.name ILIKE ${pattern}
        OR m.display_name ILIKE ${pattern}
        OR c.first_name ILIKE ${pattern}
        OR c.last_name ILIKE ${pattern}
        OR (c.first_name || ' ' || c.last_name) ILIKE ${pattern}
      )
    ORDER BY m.open_date DESC NULLS LAST
    LIMIT 50
  `

  if (matters.length === 0) return { matters: [], injuries: [], damages: [], teamMembers: [], tasks: [] }

  const related = await loadRelated(matters.map((m) => m.sf_id as string))
  return { matters, ...related }
})

// --------------------------------------------------------------------
// Manager stats
// --------------------------------------------------------------------

export const getManagerStats = onCall(runWith, async (request) => {
  requireAuth(request)
  const s = sql()

  const [totalRow, gapRows, noApptRow, refRow, weakRow, stagnationList] = await Promise.all([
    s`SELECT COUNT(*)::int as cnt FROM sf_matters WHERE status NOT IN ('Closed', 'Resolved') AND pi_status IS NOT NULL`,
    s`
      SELECT
        COUNT(DISTINCT m.sf_id)::int as total,
        COUNT(DISTINCT CASE WHEN d.last_service < now() - interval '14 days' THEN m.sf_id END)::int as gap_14,
        COUNT(DISTINCT CASE WHEN d.last_service < now() - interval '30 days' THEN m.sf_id END)::int as gap_30
      FROM sf_matters m
      LEFT JOIN (
        SELECT matter_id, MAX(service_end_date) as last_service
        FROM sf_damages
        GROUP BY matter_id
      ) d ON d.matter_id = m.sf_id
      WHERE m.status NOT IN ('Closed', 'Resolved') AND m.pi_status IS NOT NULL
    `,
    s`
      SELECT COUNT(*)::int as cnt
      FROM sf_matters m
      WHERE m.status NOT IN ('Closed', 'Resolved') AND m.pi_status IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM sf_damages d WHERE d.matter_id = m.sf_id
            AND d.service_end_date > now() - interval '30 days'
        )
    `,
    s`
      SELECT COUNT(DISTINCT t.matter_id)::int as cnt
      FROM sf_tasks t
      JOIN sf_matters m ON t.matter_id = m.sf_id
      WHERE m.status NOT IN ('Closed', 'Resolved') AND m.pi_status IS NOT NULL
        AND t.is_closed = false AND t.subject ILIKE '%referral%'
    `,
    s`
      SELECT COUNT(*)::int as cnt
      FROM sf_matters m
      LEFT JOIN (SELECT matter_id, COUNT(*)::int as dmg_count FROM sf_damages GROUP BY matter_id) d ON d.matter_id = m.sf_id
      WHERE m.status NOT IN ('Closed', 'Resolved') AND m.pi_status IS NOT NULL
        AND m.open_date < now() - interval '90 days'
        AND COALESCE(d.dmg_count, 0) < 3
    `,
    s`
      SELECT m.sf_id, m.display_name,
             COALESCE(c.first_name || ' ' || c.last_name, m.display_name) as client_name,
             EXTRACT(DAY FROM now() - d.last_service)::int as gap_days
      FROM sf_matters m
      -- See listCases for LATERAL rationale — one contact per matter.
      LEFT JOIN LATERAL (
        SELECT * FROM sf_contacts c2
        WHERE c2.account_id = m.client_id
        ORDER BY c2.synced_at DESC NULLS LAST
        LIMIT 1
      ) c ON true
      LEFT JOIN (SELECT matter_id, MAX(service_end_date) as last_service FROM sf_damages GROUP BY matter_id) d ON d.matter_id = m.sf_id
      WHERE m.status NOT IN ('Closed', 'Resolved') AND m.pi_status IS NOT NULL
        AND d.last_service < now() - interval '14 days'
      ORDER BY d.last_service ASC NULLS FIRST
      LIMIT 10
    `,
  ])

  return {
    totalRow: totalRow[0] ?? { cnt: 0 },
    gapRow: gapRows[0] ?? { total: 0, gap_14: 0, gap_30: 0 },
    noApptRow: noApptRow[0] ?? { cnt: 0 },
    refRow: refRow[0] ?? { cnt: 0 },
    weakRow: weakRow[0] ?? { cnt: 0 },
    stagnationList,
  }
})

// --------------------------------------------------------------------
// Flow nodes — load + save
// --------------------------------------------------------------------

export const loadFlowNodes = onCall(runWith, async (request) => {
  requireAuth(request)
  const rows = await sql()`SELECT node_data FROM call_flow_nodes ORDER BY node_id`
  return { rows }
})

// Flow-node shape. Kept loose on purpose — the client owns the schema.
// Server-side we only validate size/type-of to prevent abuse.
const callNodeSchema = z.object({
  nodeId: z.string().min(1).max(128),
}).passthrough()

const saveFlowNodesInput = z.object({
  nodes: z.array(callNodeSchema).max(500),
})

export const saveFlowNodes = onCall(runWith, async (request) => {
  requireAuth(request)
  const { nodes } = saveFlowNodesInput.parse(request.data ?? {})

  // Cap payload size (defense-in-depth: zod already limits to 500 nodes,
  // but each can still carry rich content — reject >1 MB total).
  const serialized = nodes.map((n) => JSON.stringify(n))
  const totalBytes = serialized.reduce((sum, s) => sum + s.length, 0)
  if (totalBytes > 1_000_000) {
    throw new HttpsError('invalid-argument', 'Flow payload exceeds 1 MB')
  }

  // Atomic replace — all-or-nothing. Neon's serverless driver exposes
  // `transaction()` for batched statements in a single BEGIN/COMMIT.
  const s = sql()
  const statements = [
    s`DELETE FROM call_flow_nodes`,
    ...nodes.map(
      (node, i) =>
        s`INSERT INTO call_flow_nodes (node_id, node_data, updated_at) VALUES (${node.nodeId}, ${serialized[i]}::jsonb, now())`
    ),
  ]
  await s.transaction(statements)

  return { ok: true }
})

// --------------------------------------------------------------------
// Shared: fetch the four "related" tables for a batch of matter IDs
// --------------------------------------------------------------------

async function loadRelated(matterIds: string[]) {
  if (matterIds.length === 0) {
    return { injuries: [], damages: [], teamMembers: [], tasks: [] }
  }
  const s = sql()
  const [injuries, damages, teamMembers, tasks] = await Promise.all([
    s`SELECT * FROM sf_injuries WHERE matter_id = ANY(${matterIds})`,
    s`SELECT * FROM sf_damages WHERE matter_id = ANY(${matterIds})`,
    s`SELECT tm.*, u.name as user_name FROM sf_team_members tm LEFT JOIN sf_users u ON tm.user_id = u.sf_id WHERE tm.matter_id = ANY(${matterIds})`,
    s`SELECT * FROM sf_tasks WHERE matter_id = ANY(${matterIds}) ORDER BY activity_date DESC`,
  ])
  return { injuries, damages, teamMembers, tasks }
}
