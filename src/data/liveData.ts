/**
 * Live data layer — reads via authenticated Firebase Callable Functions
 * (see `functions/src/index.ts`), which in turn query Neon on the server.
 *
 * The browser no longer holds DB credentials. This file preserves the
 * same public API it had in the direct-SQL version, so the rest of the
 * app is unchanged.
 *
 * Falls back to mockData if the callable fails (e.g. no network).
 */

import type {
  FullCaseView,
  Client,
  Case,
  TreatmentRecord,
  Provider,
  OperationalData,
  CaseStage,
  ProviderStatus,
  TimelineEvent,
  CallNode,
} from '@/types'
// Type-only import — erased at compile time so no Drizzle runtime ships
// to the browser. The single source of truth is src/db/schema.ts.
import type {
  SfMatterRow,
  SfInjuryRow,
  SfDamageRow,
  SfTaskRow,
  SfEventRow,
  SfTeamMemberRow,
  CallFlowNodeRow,
} from '@/db/schema'
import { calculateScores } from './scoringEngine'
import { getAllCases as getMockCases, getTimeline as getMockTimeline } from './mockData'
import { callable } from '@/lib/api'

// ---------- Callable bindings ----------

type CaseBundle = {
  matters: SfMatterRow[]
  injuries: SfInjuryRow[]
  damages: SfDamageRow[]
  teamMembers: SfTeamMemberRow[]
  tasks: SfTaskRow[]
  totalCount?: number
  pageSize?: number
}

interface CaseManagerRow {
  sf_id: string
  name: string
  role_name: string
  case_count: number | string
}

interface StagnationRow {
  sf_id: string
  display_name: string
  client_name: string
  gap_days: number
}

const fnListCaseManagers = callable<Record<string, never>, { rows: CaseManagerRow[] }>('listCaseManagers')
const fnListCases = callable<{ cmUserId?: string; page?: number }, CaseBundle>('listCases')
const fnGetCase = callable<
  { caseId: string },
  {
    matter: SfMatterRow | null
    injuries?: SfInjuryRow[]
    damages?: SfDamageRow[]
    teamMembers?: SfTeamMemberRow[]
    tasks?: SfTaskRow[]
  }
>('getCase')
const fnGetTimeline = callable<
  { caseId: string },
  { tasks: SfTaskRow[]; damages: SfDamageRow[]; events: SfEventRow[] }
>('getTimeline')
const fnGetCmStats = callable<{ cmUserId?: string }, CmStats>('getCmStats')
const fnSearchCases = callable<{ query: string }, CaseBundle>('searchCases')
const fnGetManagerStats = callable<
  Record<string, never>,
  {
    totalRow: { cnt: number }
    gapRow: { total: number; gap_14: number; gap_30: number }
    noApptRow: { cnt: number }
    refRow: { cnt: number }
    weakRow: { cnt: number }
    stagnationList: StagnationRow[]
  }
>('getManagerStats')
const fnLoadFlowNodes = callable<Record<string, never>, { rows: CallFlowNodeRow[] }>('loadFlowNodes')
const fnSaveFlowNodes = callable<{ nodes: CallNode[] }, { ok: boolean }>('saveFlowNodes')

// ---------- Helpers ----------

const caseCache: Record<string, { cases: FullCaseView[]; totalCount: number; time: number }> = {}
const CACHE_TTL = 60_000

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

type HasMatterId = { matter_id?: string | null }

function groupBy<T extends HasMatterId>(arr: T[], key: 'matter_id'): Record<string, T[]> {
  const map: Record<string, T[]> = {}
  for (const item of arr) {
    const k = item[key]
    if (!k) continue
    if (!map[k]) map[k] = []
    map[k].push(item)
  }
  return map
}

function mapMatterToCase(
  m: SfMatterRow,
  injuryMap: Record<string, SfInjuryRow[]>,
  damageMap: Record<string, SfDamageRow[]>,
  teamMap: Record<string, SfTeamMemberRow[]>,
  taskMap: Record<string, SfTaskRow[]>
): FullCaseView {
  const mid = m.sf_id
  const mInjuries = injuryMap[mid] || []
  const mDamages = damageMap[mid] || []
  const mTeam = teamMap[mid] || []
  const mTasks = taskMap[mid] || []

  const cm = mTeam.find(
    (t) =>
      (t.role_name || '').toLowerCase().includes('paralegal') ||
      (t.role_name || '').toLowerCase().includes('case manager')
  )
  const mml = mTeam.find((t) => (t.role_name || '').toLowerCase().includes('medical'))

  const serviceDates = mDamages
    .map((d) => d.service_end_date)
    .filter((d): d is string => !!d)
    .sort()
  const lastTreatmentDate = serviceDates.length > 0 ? serviceDates[serviceDates.length - 1] : null
  const firstTreatmentDate =
    mDamages
      .map((d) => d.service_start_date)
      .filter((d): d is string => !!d)
      .sort()[0] || null

  const closedTasks = mTasks.filter((t) => t.is_closed)
  const firstClosedTask = closedTasks[0]
  const lastContactDate = firstClosedTask
    ? firstClosedTask.completed_date || firstClosedTask.activity_date
    : null
  const openTaskCount = mTasks.filter((t) => !t.is_closed).length

  const providerNames: string[] = [
    ...new Set(mDamages.map((d) => d.provider_name).filter((n): n is string => !!n)),
  ]

  const treatmentGapDays = lastTreatmentDate ? daysSinceDate(lastTreatmentDate) : 999
  const noContactDays = lastContactDate ? daysSinceDate(lastContactDate) : 999

  let clientName = `${m.client_first || ''} ${m.client_last || ''}`.trim()
  let preferredName = m.client_first || undefined
  if (!clientName) {
    const dn = m.display_name || ''
    const asoMatch = dn.match(/a\/s\/o\s+(.+?)(?:\s+vs\b|$)/i)
    if (asoMatch && asoMatch[1]) {
      clientName = asoMatch[1].trim()
    } else {
      clientName = (dn.split(/\s*(?:--|[|])\s*/)[0] || '').trim() || dn
    }
    preferredName = clientName.split(' ')[0] || undefined
  }

  const client: Client = {
    id: m.client_id || mid,
    fullName: clientName || 'Unknown',
    preferredName,
    phone: m.client_phone || '—',
    email: m.client_email || undefined,
    preferredContactMethod: 'phone',
    primaryLanguage: 'English',
    interpreterNeeded: false,
    state: m.client_state || m.matter_state || 'NJ',
    dateOfBirth: m.client_dob || '1980-01-01',
    address: m.mailing_street ? `${m.mailing_street}, ${m.mailing_city || ''}` : undefined,
  }

  const caseData: Case = {
    id: mid,
    clientId: m.client_id || mid,
    matterId: m.matter_id || mid,
    caseType: 'Personal Injury',
    accidentType: 'Motor Vehicle Accident',
    dateOfIncident: m.incident_date || m.open_date || '2025-01-01',
    venue: m.venue || undefined,
    attorneyAssigned: m.attorney_name || 'Unassigned',
    caseManagerAssigned: cm?.user_name || 'Unassigned',
    medicalManagementLead: mml?.user_name || undefined,
    retentionDate: m.retention_date || m.open_date || '2025-01-01',
    currentStage: mapStage(m.matter_stage, m.pi_status),
    currentSubstage: m.matter_stage || undefined,
    statuteOfLimitationsDate: m.statute_of_limitations || '2028-01-01',
  }

  const bodyParts = mInjuries.map((i) => i.body_part || 'Unknown')
  const knownInjuries = mInjuries
    .map((i) => i.diagnosis || i.body_part || 'Injury')
    .filter((v): v is string => !!v)

  const treatment: TreatmentRecord = {
    id: `treat-${mid}`,
    caseId: mid,
    bodyPartsComplained: bodyParts,
    knownInjuries,
    symptomSummary:
      mInjuries.length > 0
        ? `${mInjuries.length} injury/injuries reported. ${bodyParts.join(', ')}.`
        : 'No injuries on file.',
    treatmentStartDate: firstTreatmentDate || undefined,
    lastTreatmentDate: lastTreatmentDate || undefined,
    nextAppointmentDate: undefined,
    totalVisits: mDamages.length,
    missedAppointments: 0,
    diagnosticsOrdered: [],
    diagnosticsCompleted: [],
    surgeryRecommendationStatus: 'none',
    injectionRecommendationStatus: 'none',
    erVisitHistory: false,
    pcpInvolvement: false,
    ptChiroStatus: providerNames.some((n) => /chiro|physical therap/i.test(n))
      ? ('active' as ProviderStatus)
      : ('not_referred' as ProviderStatus),
    orthoStatus: providerNames.some((n) => /ortho/i.test(n))
      ? ('active' as ProviderStatus)
      : ('not_referred' as ProviderStatus),
    painManagementStatus: providerNames.some((n) => /pain/i.test(n))
      ? ('active' as ProviderStatus)
      : ('not_referred' as ProviderStatus),
    neurologyStatus: providerNames.some((n) => /neuro/i.test(n))
      ? ('active' as ProviderStatus)
      : ('not_referred' as ProviderStatus),
    specialistStatus: 'not_referred',
    dischargeStatus: 'none',
    plateauIndicator: mInjuries.some((i) => i.current_status === 'Maximum Medical Improvement'),
  }

  const providers: Provider[] = providerNames.map((name, i) => ({
    id: `prov-${mid}-${i}`,
    caseId: mid,
    name,
    type: 'other' as const,
    status: 'active' as ProviderStatus,
    lastVisitDate: lastTreatmentDate || undefined,
  }))

  const operational: OperationalData = {
    caseId: mid,
    lastContactDate: lastContactDate || undefined,
    lastSuccessfulContactDate: lastContactDate || undefined,
    lastCallOutcome: firstClosedTask?.subject || undefined,
    outstandingTasks: openTaskCount,
    staleTasks: 0,
    noContactDays: Math.min(noContactDays, 999),
    treatmentGapDays: Math.min(treatmentGapDays, 999),
    unresolvedReferralDays: 0,
    currentRiskFlags: [],
    priorEscalations: [],
  }

  if (treatmentGapDays > 14) operational.currentRiskFlags.push('treatment_gap')
  if (noContactDays > 21) operational.currentRiskFlags.push('no_contact')
  if (!treatment.nextAppointmentDate) operational.currentRiskFlags.push('no_next_appointment')
  if (mDamages.length < 3 && daysSinceDate(caseData.dateOfIncident) > 90)
    operational.currentRiskFlags.push('weak_treatment')

  const fullCase: FullCaseView = {
    client,
    caseData,
    treatment,
    providers,
    referrals: [],
    operational,
    scores: {
      treatmentContinuityScore: 0,
      symptomPersistenceScore: 0,
      barrierSeverityScore: 0,
      providerProgressionScore: 0,
      clientEngagementScore: 0,
      complianceScore: 0,
      demandTrajectoryScore: 0,
      urgencyScore: 0,
      caseWeaknessScore: 0,
      directionConfidenceScore: 0,
    },
  }
  fullCase.scores = calculateScores(fullCase)
  return fullCase
}

// ============================================================
// Public API — unchanged signatures from the direct-SQL version
// ============================================================

export async function getCaseManagers(): Promise<
  { id: string; name: string; role: string; caseCount: number }[]
> {
  try {
    const { rows } = await fnListCaseManagers({})
    return rows.map((r) => ({
      id: r.sf_id,
      name: r.name,
      role: r.role_name,
      caseCount: Number(r.case_count),
    }))
  } catch {
    return []
  }
}

const PAGE_SIZE = 50

export async function getAllCasesLive(
  cmUserId?: string,
  page = 0
): Promise<{ cases: FullCaseView[]; totalCount: number; pageSize: number }> {
  const cacheKey = `${cmUserId || '__all__'}_p${page}`
  const cached = caseCache[cacheKey]
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return { cases: cached.cases, totalCount: cached.totalCount, pageSize: PAGE_SIZE }
  }
  try {
    const bundle = await fnListCases({ cmUserId, page })
    if (bundle.matters.length === 0 && page === 0) {
      const mock = getMockCases()
      return { cases: mock, totalCount: mock.length, pageSize: PAGE_SIZE }
    }
    const cases = mapBundle(bundle)
    const totalCount = bundle.totalCount ?? cases.length
    caseCache[cacheKey] = { cases, totalCount, time: Date.now() }
    return { cases, totalCount, pageSize: PAGE_SIZE }
  } catch (err) {
    console.error('[liveData] listCases failed, falling back to mock:', err)
    const mock = getMockCases()
    return { cases: mock, totalCount: mock.length, pageSize: PAGE_SIZE }
  }
}

export async function getCaseByIdLive(caseId: string): Promise<FullCaseView | undefined> {
  if (!caseId) return undefined

  // Cache hit across any loaded page
  for (const entry of Object.values(caseCache)) {
    const found = entry.cases.find((c) => c.caseData.id === caseId)
    if (found) return found
  }

  try {
    const res = await fnGetCase({ caseId })
    if (!res.matter) return getMockCases().find((c) => c.caseData.id === caseId)
    const mapped = mapBundle({
      matters: [res.matter],
      injuries: res.injuries ?? [],
      damages: res.damages ?? [],
      teamMembers: res.teamMembers ?? [],
      tasks: res.tasks ?? [],
    })
    return mapped[0]
  } catch (err) {
    console.error('[liveData] getCase failed:', err)
    return getMockCases().find((c) => c.caseData.id === caseId)
  }
}

export async function getTimelineLive(caseId: string): Promise<TimelineEvent[]> {
  if (!caseId) return []
  try {
    const { tasks, damages, events } = await fnGetTimeline({ caseId })
    const timeline: TimelineEvent[] = []

    for (const t of tasks) {
      timeline.push({
        date: t.activity_date || t.completed_date || '',
        type: t.is_closed ? 'contact' : 'milestone',
        title: t.subject || 'Task',
        description: t.description?.slice(0, 200) || undefined,
      })
    }

    for (const d of damages) {
      if (d.service_start_date) {
        timeline.push({
          date: d.service_start_date,
          type: 'appointment',
          title: `${d.type || 'Treatment'} — ${d.provider_name || 'Provider'}`,
          providerName: d.provider_name || undefined,
        })
      }
    }

    for (const e of events) {
      if (!e.start_date) continue
      timeline.push({
        date: e.start_date,
        type: 'appointment',
        title: e.subject || 'Event',
        description: e.description?.slice(0, 200) || undefined,
      })
    }

    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    if (timeline.length === 0) return getMockTimeline(caseId)
    return timeline
  } catch {
    return getMockTimeline(caseId)
  }
}

export interface CmStats {
  totalCases: number
  urgent: number
  gap14: number
  noRecentTreatment: number
}

export async function getCmStats(cmUserId?: string): Promise<CmStats> {
  try {
    return await fnGetCmStats({ cmUserId })
  } catch (err) {
    console.error('[liveData] getCmStats failed:', err)
    return { totalCases: 0, urgent: 0, gap14: 0, noRecentTreatment: 0 }
  }
}

export async function searchCases(query: string): Promise<FullCaseView[]> {
  if (!query || query.length < 2) return []
  try {
    const bundle = await fnSearchCases({ query })
    if (bundle.matters.length === 0) return []
    return mapBundle(bundle)
  } catch (err) {
    console.error('[liveData] search failed:', err)
    return []
  }
}

export interface ManagerStats {
  totalCases: number
  withNextAppt: number
  stagnating: number
  highRisk: number
  avgUrgency: number
  noAppointmentCount: number
  treatmentGapCount: number
  unresolvedReferralCount: number
  weakCaseCount: number
  stagnationCases: { sf_id: string; display_name: string; client_name: string; gap_days: number }[]
  noApptCases: { sf_id: string; display_name: string; client_name: string }[]
}

export async function getManagerStats(): Promise<ManagerStats> {
  try {
    const res = await fnGetManagerStats({})
    const total = res.totalRow.cnt ?? 0
    const gap14 = res.gapRow.gap_14 ?? 0
    const gap30 = res.gapRow.gap_30 ?? 0
    const noAppt = res.noApptRow.cnt ?? 0
    return {
      totalCases: total,
      withNextAppt: total - noAppt,
      stagnating: gap14,
      highRisk: gap30,
      // NB: this is gap-14 rate, not avg urgency. Kept name for call-site
      // compatibility; see P1 findings for rename.
      avgUrgency: total > 0 ? Math.round((gap14 / total) * 100) : 0,
      noAppointmentCount: noAppt,
      treatmentGapCount: gap14,
      unresolvedReferralCount: res.refRow.cnt ?? 0,
      weakCaseCount: res.weakRow.cnt ?? 0,
      stagnationCases: res.stagnationList.map((r) => ({
        sf_id: r.sf_id,
        display_name: r.display_name,
        client_name: r.client_name,
        gap_days: r.gap_days,
      })),
      noApptCases: [],
    }
  } catch (err) {
    console.error('[liveData] Manager stats failed:', err)
    return {
      totalCases: 0,
      withNextAppt: 0,
      stagnating: 0,
      highRisk: 0,
      avgUrgency: 0,
      noAppointmentCount: 0,
      treatmentGapCount: 0,
      unresolvedReferralCount: 0,
      weakCaseCount: 0,
      stagnationCases: [],
      noApptCases: [],
    }
  }
}

// ============================================================
// Flow Builder
// ============================================================

export async function loadFlowNodes(): Promise<CallNode[] | null> {
  try {
    const { rows } = await fnLoadFlowNodes({})
    if (rows.length === 0) return null
    // node_data is typed `unknown` in the DB schema since its shape is
    // owned by the app layer. See P1 findings for adding Zod validation
    // at this boundary.
    return rows.map((r) => r.node_data as CallNode)
  } catch (err) {
    console.error('[liveData] Failed to load flow nodes:', err)
    return null
  }
}

export async function saveFlowNodes(nodes: CallNode[]): Promise<boolean> {
  try {
    const { ok } = await fnSaveFlowNodes({ nodes })
    return ok
  } catch (err) {
    console.error('[liveData] Failed to save flow nodes:', err)
    return false
  }
}

// ---------- Shared mapper ----------

function mapBundle(b: CaseBundle): FullCaseView[] {
  const injuryMap = groupBy(b.injuries, 'matter_id')
  const damageMap = groupBy(b.damages, 'matter_id')
  const teamMap = groupBy(b.teamMembers, 'matter_id')
  const taskMap = groupBy(b.tasks, 'matter_id')
  return b.matters.map((m) => mapMatterToCase(m, injuryMap, damageMap, teamMap, taskMap))
}
