// Types + helpers for the Treatment Progression Kanban.
// Pure presentational utilities — no backend calls.

export type Phase =
  | 'conservative'
  | 'imaging'
  | 'pain_mgmt'
  | 'surgical'
  | 'mmi'

export type Modality =
  | 'er'
  | 'pt'
  | 'chiro'
  | 'massage'
  | 'mri'
  | 'xray'
  | 'ct'
  | 'injection'
  | 'pain_mgmt_consult'
  | 'surgery_consult'
  | 'surgery'
  | 'ortho_consult'
  | 'neuro_consult'
  | 'other'

export type EventStatus =
  | 'recommended'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'client_declined'
  | 'provider_declined'
  | 'no_show'
  | 'cancelled'

export type Outcome =
  | 'improved'
  | 'no_change'
  | 'worsened'
  | 'inconclusive'
  | 'pending_read'

export type DeclineReason =
  | 'cost'
  | 'fear'
  | 'transport'
  | 'work'
  | 'no_benefit'
  | 'other'

export type BodyRegion =
  | 'cervical'
  | 'thoracic'
  | 'lumbar'
  | 'shoulder_l'
  | 'shoulder_r'
  | 'knee_l'
  | 'knee_r'
  | 'hip_l'
  | 'hip_r'
  | 'tbi'
  | 'wrist_l'
  | 'wrist_r'
  | 'other'

export type Severity = 'minor' | 'moderate' | 'severe' | 'catastrophic'

export interface Injury {
  id: string
  caseId: string
  bodyRegion: BodyRegion
  severity: Severity
  erAdmitted: boolean
  erFacility?: string
  currentPhase: Phase
  nextAction?: string
}

export interface TreatmentEvent {
  id: string
  injuryId: string
  modality: Modality
  status: EventStatus
  providerName?: string
  scheduledDate?: string
  completedDate?: string
  outcome?: Outcome
  outcomeNotes?: string
  findings?: string
  declineReason?: DeclineReason
  autoExtractedFromCall: boolean
}

// ---------- Phase ordering ----------

export const PHASES: { key: Phase; label: string }[] = [
  { key: 'conservative', label: 'Conservative' },
  { key: 'imaging', label: 'Imaging' },
  { key: 'pain_mgmt', label: 'Pain Mgmt' },
  { key: 'surgical', label: 'Surgical' },
  { key: 'mmi', label: 'MMI' },
]

const PHASE_INDEX: Record<Phase, number> = {
  conservative: 0,
  imaging: 1,
  pain_mgmt: 2,
  surgical: 3,
  mmi: 4,
}

export function isForwardMove(from: Phase, to: Phase): boolean {
  return PHASE_INDEX[to] > PHASE_INDEX[from]
}

// ---------- Mapping ----------

const MODALITY_TO_PHASE: Record<Modality, Phase> = {
  er: 'conservative',
  pt: 'conservative',
  chiro: 'conservative',
  massage: 'conservative',
  mri: 'imaging',
  xray: 'imaging',
  ct: 'imaging',
  injection: 'pain_mgmt',
  pain_mgmt_consult: 'pain_mgmt',
  surgery_consult: 'surgical',
  surgery: 'surgical',
  ortho_consult: 'surgical',
  neuro_consult: 'surgical',
  other: 'conservative',
}

export function phaseForModality(m: Modality): Phase {
  return MODALITY_TO_PHASE[m]
}

// ---------- Labels ----------

export const MODALITY_LABEL: Record<Modality, string> = {
  er: 'ER',
  pt: 'PT',
  chiro: 'Chiro',
  massage: 'Massage',
  mri: 'MRI',
  xray: 'X-Ray',
  ct: 'CT',
  injection: 'Injection',
  pain_mgmt_consult: 'Pain Mgmt Consult',
  surgery_consult: 'Surgery Consult',
  surgery: 'Surgery',
  ortho_consult: 'Ortho Consult',
  neuro_consult: 'Neuro Consult',
  other: 'Other',
}

export const STATUS_LABEL: Record<EventStatus, string> = {
  recommended: 'Recommended',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  client_declined: 'Client Declined',
  provider_declined: 'Provider Declined',
  no_show: 'No Show',
  cancelled: 'Cancelled',
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  improved: 'Improved',
  no_change: 'No Change',
  worsened: 'Worsened',
  inconclusive: 'Inconclusive',
  pending_read: 'Pending Read',
}

export const DECLINE_LABEL: Record<DeclineReason, string> = {
  cost: 'Cost',
  fear: 'Fear',
  transport: 'Transport',
  work: 'Work',
  no_benefit: 'No Benefit',
  other: 'Other',
}

export const BODY_REGION_LABEL: Record<BodyRegion, string> = {
  cervical: 'Cervical Spine',
  thoracic: 'Thoracic Spine',
  lumbar: 'Lumbar Spine',
  shoulder_l: 'Left Shoulder',
  shoulder_r: 'Right Shoulder',
  knee_l: 'Left Knee',
  knee_r: 'Right Knee',
  hip_l: 'Left Hip',
  hip_r: 'Right Hip',
  tbi: 'TBI',
  wrist_l: 'Left Wrist',
  wrist_r: 'Right Wrist',
  other: 'Other',
}

// ---------- Badge classes (pale tints, never saturated) ----------

export function statusPillClass(s: EventStatus): string {
  switch (s) {
    case 'completed':
      return 'bg-emerald-400/10 text-emerald-300/90 border-emerald-400/15'
    case 'scheduled':
      return 'bg-sky-400/10 text-sky-300/90 border-sky-400/15'
    case 'in_progress':
      return 'bg-indigo-400/10 text-indigo-300/90 border-indigo-400/15'
    case 'recommended':
      return 'bg-amber-400/10 text-amber-300/90 border-amber-400/15'
    case 'client_declined':
    case 'provider_declined':
      return 'bg-rose-400/10 text-rose-300/90 border-rose-400/15'
    case 'no_show':
    case 'cancelled':
      return 'bg-zinc-400/10 text-zinc-300/80 border-zinc-400/15'
  }
}

export function severityPillClass(s: Severity): string {
  switch (s) {
    case 'minor':
      return 'bg-emerald-400/10 text-emerald-300/90 border-emerald-400/15'
    case 'moderate':
      return 'bg-amber-400/10 text-amber-300/90 border-amber-400/15'
    case 'severe':
      return 'bg-orange-400/10 text-orange-300/90 border-orange-400/15'
    case 'catastrophic':
      return 'bg-rose-400/10 text-rose-300/90 border-rose-400/15'
  }
}

export function outcomeBadgeClass(o: Outcome): string {
  switch (o) {
    case 'improved':
      return 'bg-emerald-400/10 text-emerald-300/90 border-emerald-400/15'
    case 'worsened':
      return 'bg-rose-400/10 text-rose-300/90 border-rose-400/15'
    case 'no_change':
      return 'bg-zinc-400/10 text-zinc-300/80 border-zinc-400/15'
    case 'inconclusive':
    case 'pending_read':
      return 'bg-sky-400/10 text-sky-300/90 border-sky-400/15'
  }
}

// ---------- Date formatting ----------

export function formatShortDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
}

export function formatLongDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
