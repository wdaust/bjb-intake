/**
 * Live data layer — reads from Neon (synced from Litify).
 * Returns FullCaseView objects compatible with the rest of the app.
 * Falls back to mockData if queries fail.
 */

import { neon } from '@neondatabase/serverless'
import type { FullCaseView, Client, Case, TreatmentRecord, Provider, OperationalData, CaseStage, ProviderStatus, TimelineEvent, CallNode } from '@/types'
import { calculateScores } from './scoringEngine'
import { getAllCases as getMockCases, getTimeline as getMockTimeline } from './mockData'

const sql = neon(import.meta.env.VITE_DATABASE_URL)

const caseCache: Record<string, { cases: FullCaseView[]; totalCount: number; time: number }> = {}
const CACHE_TTL = 60_000 // 1 minute

function daysSinceDate(d?: string | null): number {
  if (!d) return 999
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24))
}

function mapStage(matterStage?: string | null, piStatus?: string | null): CaseStage {
  if (!matterStage) return 'active_treatment'
  const s = matterStage.toLowerCase()
  if (s.includes('accounts opening') || s.includes('pending review')) return 'early_case'
  if (s.includes('file review') || s.includes('case checkpoint')) return 'active_treatment'
  if (s.includes('package out')) return 'mid_treatment'
  if (s.includes('discovery') || s.includes('deps')) return 'late_treatment'
  if (s.includes('settlement') || s.includes('settled')) return 'demand_prep'
  if (piStatus === 'Litigation') return 'litigation'
  return 'active_treatment'
}

// Fetch available case managers / paralegals for the CM selector
export async function getCaseManagers(): Promise<{ id: string; name: string; role: string; caseCount: number }[]> {
  try {
    const rows = await sql`
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
    return rows.map((r: Record<string, unknown>) => ({
      id: r.sf_id as string,
      name: r.name as string,
      role: r.role_name as string,
      caseCount: Number(r.case_count),
    }))
  } catch {
    return []
  }
}

const PAGE_SIZE = 50

type RowMap = Record<string, Record<string, unknown>[]>

function mapMatterToCase(
  m: Record<string, unknown>,
  injuryMap: RowMap, damageMap: RowMap, teamMap: RowMap, taskMap: RowMap
): FullCaseView {
  const mid = m.sf_id as string
  const mInjuries = injuryMap[mid] || []
  const mDamages = damageMap[mid] || []
  const mTeam = teamMap[mid] || []
  const mTasks = taskMap[mid] || []

  const cm = mTeam.find((t: Record<string, unknown>) =>
    ((t.role_name as string) || '').toLowerCase().includes('paralegal') ||
    ((t.role_name as string) || '').toLowerCase().includes('case manager')
  )
  const mml = mTeam.find((t: Record<string, unknown>) =>
    ((t.role_name as string) || '').toLowerCase().includes('medical')
  )

  const serviceDates = mDamages
    .map((d: Record<string, unknown>) => d.service_end_date as string | null)
    .filter(Boolean)
    .sort()
  const lastTreatmentDate = serviceDates.length > 0 ? serviceDates[serviceDates.length - 1] : null
  const firstTreatmentDate = mDamages
    .map((d: Record<string, unknown>) => d.service_start_date as string | null)
    .filter(Boolean)
    .sort()[0] || null

  const closedTasks = mTasks.filter((t: Record<string, unknown>) => t.is_closed)
  const lastContactDate = closedTasks.length > 0
    ? (closedTasks[0].completed_date || closedTasks[0].activity_date) as string | null
    : null
  const openTaskCount = mTasks.filter((t: Record<string, unknown>) => !t.is_closed).length

  const providerNames: string[] = [...new Set(
    mDamages
      .map((d: Record<string, unknown>) => d.provider_name as string | null)
      .filter((n): n is string => !!n)
  )]

  const treatmentGapDays = lastTreatmentDate ? daysSinceDate(lastTreatmentDate) : 999
  const noContactDays = lastContactDate ? daysSinceDate(lastContactDate) : 999

  let clientName = `${m.client_first || ''} ${m.client_last || ''}`.trim()
  let preferredName = m.client_first as string | undefined
  if (!clientName) {
    const dn = (m.display_name as string) || ''
    const asoMatch = dn.match(/a\/s\/o\s+(.+?)(?:\s+vs\b|$)/i)
    if (asoMatch) {
      clientName = asoMatch[1].trim()
    } else {
      clientName = dn.split(/\s*(?:--|[|])\s*/)[0].trim() || dn
    }
    preferredName = clientName.split(' ')[0] || undefined
  }

  const client: Client = {
    id: m.client_id as string || mid,
    fullName: clientName || 'Unknown',
    preferredName,
    phone: (m.client_phone as string) || '—',
    email: (m.client_email as string) || undefined,
    preferredContactMethod: 'phone',
    primaryLanguage: 'English',
    interpreterNeeded: false,
    state: (m.client_state as string) || (m.matter_state as string) || 'NJ',
    dateOfBirth: (m.client_dob as string) || '1980-01-01',
    address: m.mailing_street ? `${m.mailing_street}, ${m.mailing_city || ''}` : undefined,
  }

  const caseData: Case = {
    id: mid,
    clientId: m.client_id as string || mid,
    matterId: (m.matter_id as string) || mid,
    caseType: 'Personal Injury',
    accidentType: 'Motor Vehicle Accident',
    dateOfIncident: (m.incident_date as string) || (m.open_date as string) || '2025-01-01',
    venue: (m.venue as string) || undefined,
    attorneyAssigned: (m.attorney_name as string) || 'Unassigned',
    caseManagerAssigned: (cm?.user_name as string) || 'Unassigned',
    medicalManagementLead: (mml?.user_name as string) || undefined,
    retentionDate: (m.retention_date as string) || (m.open_date as string) || '2025-01-01',
    currentStage: mapStage(m.matter_stage as string, m.pi_status as string),
    currentSubstage: (m.matter_stage as string) || undefined,
    statuteOfLimitationsDate: (m.statute_of_limitations as string) || '2028-01-01',
  }

  const bodyParts = mInjuries.map((i: Record<string, unknown>) => (i.body_part as string) || 'Unknown')
  const knownInjuries = mInjuries
    .map((i: Record<string, unknown>) => (i.diagnosis as string) || (i.body_part as string) || 'Injury')
    .filter(Boolean)

  const treatment: TreatmentRecord = {
    id: `treat-${mid}`, caseId: mid,
    bodyPartsComplained: bodyParts, knownInjuries,
    symptomSummary: mInjuries.length > 0 ? `${mInjuries.length} injury/injuries reported. ${bodyParts.join(', ')}.` : 'No injuries on file.',
    treatmentStartDate: firstTreatmentDate || undefined,
    lastTreatmentDate: lastTreatmentDate || undefined,
    nextAppointmentDate: undefined,
    totalVisits: mDamages.length, missedAppointments: 0,
    diagnosticsOrdered: [], diagnosticsCompleted: [],
    surgeryRecommendationStatus: 'none', injectionRecommendationStatus: 'none',
    erVisitHistory: false, pcpInvolvement: false,
    ptChiroStatus: providerNames.some(n => /chiro|pt|physical/i.test(n)) ? 'active' as ProviderStatus : 'not_referred' as ProviderStatus,
    orthoStatus: providerNames.some(n => /ortho/i.test(n)) ? 'active' as ProviderStatus : 'not_referred' as ProviderStatus,
    painManagementStatus: providerNames.some(n => /pain/i.test(n)) ? 'active' as ProviderStatus : 'not_referred' as ProviderStatus,
    neurologyStatus: providerNames.some(n => /neuro/i.test(n)) ? 'active' as ProviderStatus : 'not_referred' as ProviderStatus,
    specialistStatus: 'not_referred', dischargeStatus: 'none',
    plateauIndicator: mInjuries.some((i: Record<string, unknown>) => (i.current_status as string) === 'Maximum Medical Improvement'),
  }

  const providers: Provider[] = providerNames.map((name, i) => ({
    id: `prov-${mid}-${i}`, caseId: mid, name, type: 'other' as const, status: 'active' as ProviderStatus,
    lastVisitDate: lastTreatmentDate || undefined,
  }))

  const operational: OperationalData = {
    caseId: mid,
    lastContactDate: lastContactDate || undefined,
    lastSuccessfulContactDate: lastContactDate || undefined,
    lastCallOutcome: closedTasks.length > 0 ? (closedTasks[0].subject as string) || undefined : undefined,
    outstandingTasks: openTaskCount, staleTasks: 0,
    noContactDays: Math.min(noContactDays, 999),
    treatmentGapDays: Math.min(treatmentGapDays, 999),
    unresolvedReferralDays: 0, currentRiskFlags: [], priorEscalations: [],
  }

  if (treatmentGapDays > 14) operational.currentRiskFlags.push('treatment_gap')
  if (noContactDays > 21) operational.currentRiskFlags.push('no_contact')
  if (!treatment.nextAppointmentDate) operational.currentRiskFlags.push('no_next_appointment')
  if (mDamages.length < 3 && daysSinceDate(caseData.dateOfIncident) > 90) operational.currentRiskFlags.push('weak_treatment')

  const fullCase: FullCaseView = {
    client, caseData, treatment, providers, referrals: [], operational,
    scores: { treatmentContinuityScore: 0, symptomPersistenceScore: 0, barrierSeverityScore: 0, providerProgressionScore: 0, clientEngagementScore: 0, complianceScore: 0, demandTrajectoryScore: 0, urgencyScore: 0, caseWeaknessScore: 0, directionConfidenceScore: 0 },
  }
  fullCase.scores = calculateScores(fullCase)
  return fullCase
}

// Fetch paginated matters with joined client/attorney data
async function fetchCasesFromNeon(cmUserId?: string, page = 0): Promise<{ cases: FullCaseView[]; totalCount: number }> {
  try {
    const offset = page * PAGE_SIZE

    // Get total count
    const [countRow] = cmUserId
      ? await sql`
          SELECT COUNT(DISTINCT m.sf_id)::int as cnt
          FROM sf_matters m
          INNER JOIN sf_team_members tm ON tm.matter_id = m.sf_id AND tm.user_id = ${cmUserId}
          WHERE m.status NOT IN ('Closed', 'Resolved') AND m.pi_status IS NOT NULL
        `
      : await sql`
          SELECT COUNT(*)::int as cnt
          FROM sf_matters
          WHERE status NOT IN ('Closed', 'Resolved') AND pi_status IS NOT NULL
        `
    const totalCount = (countRow as Record<string, unknown>).cnt as number

    // Get page of matters
    const matters = cmUserId
      ? await sql`
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
          LEFT JOIN sf_contacts c ON m.client_id = c.account_id
          LEFT JOIN sf_users atty ON m.principal_attorney_id = atty.sf_id
          INNER JOIN sf_team_members tm ON tm.matter_id = m.sf_id AND tm.user_id = ${cmUserId}
          WHERE m.status NOT IN ('Closed', 'Resolved')
            AND m.pi_status IS NOT NULL
          ORDER BY m.open_date DESC NULLS LAST
          LIMIT ${PAGE_SIZE} OFFSET ${offset}
        `
      : await sql`
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
          LEFT JOIN sf_contacts c ON m.client_id = c.account_id
          LEFT JOIN sf_users atty ON m.principal_attorney_id = atty.sf_id
          WHERE m.status NOT IN ('Closed', 'Resolved')
            AND m.pi_status IS NOT NULL
          ORDER BY m.open_date DESC NULLS LAST
          LIMIT ${PAGE_SIZE} OFFSET ${offset}
        `

    if (matters.length === 0 && page === 0) return { cases: getMockCases(), totalCount: getMockCases().length }

    const matterIds = matters.map((m: Record<string, unknown>) => m.sf_id as string)

    // Batch fetch related data
    const [injuries, damages, teamMembers, tasks] = await Promise.all([
      sql`SELECT * FROM sf_injuries WHERE matter_id = ANY(${matterIds})`,
      sql`SELECT * FROM sf_damages WHERE matter_id = ANY(${matterIds})`,
      sql`SELECT tm.*, u.name as user_name FROM sf_team_members tm LEFT JOIN sf_users u ON tm.user_id = u.sf_id WHERE tm.matter_id = ANY(${matterIds})`,
      sql`SELECT * FROM sf_tasks WHERE matter_id = ANY(${matterIds}) ORDER BY activity_date DESC`,
    ])

    // Index related data by matter_id
    const injuryMap = groupBy(injuries, 'matter_id')
    const damageMap = groupBy(damages, 'matter_id')
    const teamMap = groupBy(teamMembers, 'matter_id')
    const taskMap = groupBy(tasks, 'matter_id')

    const mappedCases = matters.map((m: Record<string, unknown>) => mapMatterToCase(m, injuryMap, damageMap, teamMap, taskMap))

    return { cases: mappedCases, totalCount }
  } catch (err) {
    console.error('[liveData] Failed to fetch from Neon, falling back to mock:', err)
    const mock = getMockCases()
    return { cases: mock, totalCount: mock.length }
  }
}

function groupBy(arr: Record<string, unknown>[], key: string): Record<string, Record<string, unknown>[]> {
  const map: Record<string, Record<string, unknown>[]> = {}
  for (const item of arr) {
    const k = item[key] as string
    if (!k) continue
    if (!map[k]) map[k] = []
    map[k].push(item)
  }
  return map
}

// ============================================================
// Public API — same interface as mockData.ts
// ============================================================

export async function getAllCasesLive(cmUserId?: string, page = 0): Promise<{ cases: FullCaseView[]; totalCount: number; pageSize: number }> {
  const cacheKey = `${cmUserId || '__all__'}_p${page}`
  const cached = caseCache[cacheKey]
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return { cases: cached.cases, totalCount: cached.totalCount, pageSize: PAGE_SIZE }
  }
  const result = await fetchCasesFromNeon(cmUserId, page)
  caseCache[cacheKey] = { cases: result.cases, totalCount: result.totalCount, time: Date.now() }
  return { cases: result.cases, totalCount: result.totalCount, pageSize: PAGE_SIZE }
}

export async function getCaseByIdLive(caseId: string): Promise<FullCaseView | undefined> {
  // Check cache first across all pages
  for (const entry of Object.values(caseCache)) {
    const found = entry.cases.find(c => c.caseData.id === caseId)
    if (found) return found
  }
  // If not cached, fetch a single page filtered to this case
  const result = await fetchCasesFromNeon(undefined, 0)
  const found = result.cases.find(c => c.caseData.id === caseId)
  if (found) return found
  // Fallback to mock
  return getMockCases().find(c => c.caseData.id === caseId)
}

export async function getTimelineLive(caseId: string): Promise<TimelineEvent[]> {
  try {
    // Build timeline from tasks and damages
    const [tasks, damages, events] = await Promise.all([
      sql`SELECT * FROM sf_tasks WHERE matter_id = ${caseId} ORDER BY activity_date DESC LIMIT 50`,
      sql`SELECT * FROM sf_damages WHERE matter_id = ${caseId} ORDER BY service_start_date DESC LIMIT 50`,
      sql`SELECT * FROM sf_events WHERE matter_id = ${caseId} ORDER BY start_date DESC LIMIT 50`,
    ])

    const timeline: TimelineEvent[] = []

    for (const t of tasks) {
      timeline.push({
        date: (t.activity_date as string) || (t.completed_date as string) || '',
        type: t.is_closed ? 'contact' : 'milestone',
        title: (t.subject as string) || 'Task',
        description: (t.description as string)?.slice(0, 200) || undefined,
      })
    }

    for (const d of damages) {
      if (d.service_start_date) {
        timeline.push({
          date: d.service_start_date as string,
          type: 'appointment',
          title: `${(d.type as string) || 'Treatment'} — ${(d.provider_name as string) || 'Provider'}`,
          providerName: (d.provider_name as string) || undefined,
        })
      }
    }

    for (const e of events) {
      timeline.push({
        date: (e.start_date as string) || '',
        type: 'appointment',
        title: (e.subject as string) || 'Event',
        description: (e.description as string)?.slice(0, 200) || undefined,
      })
    }

    // Sort newest first
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    if (timeline.length === 0) return getMockTimeline(caseId)
    return timeline
  } catch {
    return getMockTimeline(caseId)
  }
}

// ============================================================
// CM-specific stats (all cases, not paginated)
// ============================================================

export interface CmStats {
  totalCases: number
  urgent: number
  gap14: number
  noRecentTreatment: number
}

export async function getCmStats(cmUserId?: string): Promise<CmStats> {
  try {
    if (cmUserId) {
      const [row] = await sql`
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
      return {
        totalCases: (row as Record<string, unknown>).total as number,
        urgent: (row as Record<string, unknown>).urgent as number,
        gap14: (row as Record<string, unknown>).gap14 as number,
        noRecentTreatment: (row as Record<string, unknown>).no_recent as number,
      }
    }
    const [row] = await sql`
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
      totalCases: (row as Record<string, unknown>).total as number,
      urgent: (row as Record<string, unknown>).urgent as number,
      gap14: (row as Record<string, unknown>).gap14 as number,
      noRecentTreatment: (row as Record<string, unknown>).no_recent as number,
    }
  } catch (err) {
    console.error('[liveData] getCmStats failed:', err)
    return { totalCases: 0, urgent: 0, gap14: 0, noRecentTreatment: 0 }
  }
}

// ============================================================
// Search across ALL cases (server-side)
// ============================================================

export async function searchCases(query: string): Promise<FullCaseView[]> {
  if (!query || query.length < 2) return []
  const searchPattern = `%${query}%`
  try {
    const matters = await sql`
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
      LEFT JOIN sf_contacts c ON m.client_id = c.account_id
      LEFT JOIN sf_users atty ON m.principal_attorney_id = atty.sf_id
      WHERE m.status NOT IN ('Closed', 'Resolved')
        AND m.pi_status IS NOT NULL
        AND (
          m.name ILIKE ${searchPattern}
          OR m.display_name ILIKE ${searchPattern}
          OR c.first_name ILIKE ${searchPattern}
          OR c.last_name ILIKE ${searchPattern}
          OR (c.first_name || ' ' || c.last_name) ILIKE ${searchPattern}
        )
      ORDER BY m.open_date DESC NULLS LAST
      LIMIT 50
    `
    if (matters.length === 0) return []

    const matterIds = matters.map((m: Record<string, unknown>) => m.sf_id as string)
    const [injuries, damages, teamMembers, tasks] = await Promise.all([
      sql`SELECT * FROM sf_injuries WHERE matter_id = ANY(${matterIds})`,
      sql`SELECT * FROM sf_damages WHERE matter_id = ANY(${matterIds})`,
      sql`SELECT tm.*, u.name as user_name FROM sf_team_members tm LEFT JOIN sf_users u ON tm.user_id = u.sf_id WHERE tm.matter_id = ANY(${matterIds})`,
      sql`SELECT * FROM sf_tasks WHERE matter_id = ANY(${matterIds}) ORDER BY activity_date DESC`,
    ])
    const injuryMap = groupBy(injuries, 'matter_id')
    const damageMap = groupBy(damages, 'matter_id')
    const teamMap = groupBy(teamMembers, 'matter_id')
    const taskMap = groupBy(tasks, 'matter_id')

    return matters.map((m: Record<string, unknown>) => mapMatterToCase(m, injuryMap, damageMap, teamMap, taskMap))
  } catch (err) {
    console.error('[liveData] Search failed:', err)
    return []
  }
}

// ============================================================
// Manager Dashboard — Aggregate Stats (all cases, not paginated)
// ============================================================

export interface ManagerStats {
  totalCases: number
  withNextAppt: number
  stagnating: number  // treatment gap > 14d
  highRisk: number    // urgency >= 70 (approximated)
  avgUrgency: number
  // Queue counts
  noAppointmentCount: number
  treatmentGapCount: number
  unresolvedReferralCount: number
  weakCaseCount: number
  // Top cases for each queue (limited)
  stagnationCases: { sf_id: string; display_name: string; client_name: string; gap_days: number }[]
  noApptCases: { sf_id: string; display_name: string; client_name: string }[]
}

export async function getManagerStats(): Promise<ManagerStats> {
  try {
    // Run all aggregate queries in parallel
    const [
      totalRow,
      gapRows,
      noApptRow,
      refRow,
      weakRow,
      stagnationList,
    ] = await Promise.all([
      // Total open PI cases
      sql`SELECT COUNT(*)::int as cnt FROM sf_matters WHERE status NOT IN ('Closed', 'Resolved') AND pi_status IS NOT NULL`,
      // Treatment gap stats from damages
      sql`
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
      // No next appointment (we don't track next appt in SF, so count matters with no recent damage)
      sql`
        SELECT COUNT(*)::int as cnt
        FROM sf_matters m
        WHERE m.status NOT IN ('Closed', 'Resolved') AND m.pi_status IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM sf_damages d WHERE d.matter_id = m.sf_id
              AND d.service_end_date > now() - interval '30 days'
          )
      `,
      // Unresolved referrals (matters with pending/failed referral-like signals — approximate from open tasks)
      sql`
        SELECT COUNT(DISTINCT t.matter_id)::int as cnt
        FROM sf_tasks t
        JOIN sf_matters m ON t.matter_id = m.sf_id
        WHERE m.status NOT IN ('Closed', 'Resolved') AND m.pi_status IS NOT NULL
          AND t.is_closed = false AND t.subject ILIKE '%referral%'
      `,
      // Weak cases (less than 3 damage records, open > 90 days)
      sql`
        SELECT COUNT(*)::int as cnt
        FROM sf_matters m
        LEFT JOIN (SELECT matter_id, COUNT(*)::int as dmg_count FROM sf_damages GROUP BY matter_id) d ON d.matter_id = m.sf_id
        WHERE m.status NOT IN ('Closed', 'Resolved') AND m.pi_status IS NOT NULL
          AND m.open_date < now() - interval '90 days'
          AND COALESCE(d.dmg_count, 0) < 3
      `,
      // Top stagnating cases for drill-down
      sql`
        SELECT m.sf_id, m.display_name,
               COALESCE(c.first_name || ' ' || c.last_name, m.display_name) as client_name,
               EXTRACT(DAY FROM now() - d.last_service)::int as gap_days
        FROM sf_matters m
        LEFT JOIN sf_contacts c ON m.client_id = c.account_id
        LEFT JOIN (SELECT matter_id, MAX(service_end_date) as last_service FROM sf_damages GROUP BY matter_id) d ON d.matter_id = m.sf_id
        WHERE m.status NOT IN ('Closed', 'Resolved') AND m.pi_status IS NOT NULL
          AND d.last_service < now() - interval '14 days'
        ORDER BY d.last_service ASC NULLS FIRST
        LIMIT 10
      `,
    ])

    const total = (totalRow[0] as Record<string, unknown>).cnt as number
    const gap14 = (gapRows[0] as Record<string, unknown>).gap_14 as number
    const gap30 = (gapRows[0] as Record<string, unknown>).gap_30 as number

    return {
      totalCases: total,
      withNextAppt: total - ((noApptRow[0] as Record<string, unknown>).cnt as number),
      stagnating: gap14,
      highRisk: gap30,
      avgUrgency: total > 0 ? Math.round((gap14 / total) * 100) : 0,
      noAppointmentCount: (noApptRow[0] as Record<string, unknown>).cnt as number,
      treatmentGapCount: gap14,
      unresolvedReferralCount: (refRow[0] as Record<string, unknown>).cnt as number,
      weakCaseCount: (weakRow[0] as Record<string, unknown>).cnt as number,
      stagnationCases: stagnationList.map((r: Record<string, unknown>) => ({
        sf_id: r.sf_id as string,
        display_name: r.display_name as string,
        client_name: r.client_name as string,
        gap_days: r.gap_days as number,
      })),
      noApptCases: [],
    }
  } catch (err) {
    console.error('[liveData] Manager stats failed:', err)
    return {
      totalCases: 0, withNextAppt: 0, stagnating: 0, highRisk: 0, avgUrgency: 0,
      noAppointmentCount: 0, treatmentGapCount: 0, unresolvedReferralCount: 0, weakCaseCount: 0,
      stagnationCases: [], noApptCases: [],
    }
  }
}

// ============================================================
// Flow Builder Persistence
// ============================================================

export async function loadFlowNodes(): Promise<CallNode[] | null> {
  try {
    const rows = await sql`SELECT node_data FROM call_flow_nodes ORDER BY node_id`
    if (rows.length === 0) return null // no saved flow — use defaults
    return rows.map((r: Record<string, unknown>) => r.node_data as CallNode)
  } catch (err) {
    console.error('[liveData] Failed to load flow nodes:', err)
    return null
  }
}

export async function saveFlowNodes(nodes: CallNode[]): Promise<boolean> {
  try {
    // Delete all existing and re-insert (simple full-replace)
    await sql`DELETE FROM call_flow_nodes`
    for (const node of nodes) {
      await sql`INSERT INTO call_flow_nodes (node_id, node_data, updated_at) VALUES (${node.nodeId}, ${JSON.stringify(node)}, now())`
    }
    return true
  } catch (err) {
    console.error('[liveData] Failed to save flow nodes:', err)
    return false
  }
}
