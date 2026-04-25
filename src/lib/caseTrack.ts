/**
 * Case advancement track — answers "where is this case heading?"
 *
 * Per the CHAOS notes, every case ultimately flows to one of four outcomes:
 *   - RFD (Ready for Demand) — target for 90-95%; demand prep → package out
 *   - Litigation — high policy / multi-defendant / severe injury
 *   - Cut — disqualified
 *   - Transfer — refer to another firm
 *
 * Until the user explicitly sets the track on a case, we derive it from
 * existing signals (verdict, redSignals, caseType). Manual override comes
 * later via a CAOS-owned `case_tracks` table.
 */

import type { CaseForRanking } from './callQueueRanker'
import type { FullCaseView } from '@/types'

export type CaseTrack = 'rfd' | 'litigation' | 'cut' | 'transfer' | 'unset'

export interface CaseTrackInfo {
  track: CaseTrack
  /** 0-100 — how far along the path to package-out. */
  progress: number
  /** One-line rationale for why we picked this track. */
  reason: string
  /** True when the user has manually set the track (vs. derived). */
  isManualOverride?: boolean
}

/**
 * Codified reason taxonomies per track. Mirrors the qualification-decision-tree
 * intent in the user's CHAOS notes — a tight, definitive list rather than free
 * text — so reporting can aggregate and so CMs make consistent calls.
 */
export const TRACK_REASONS: Record<Exclude<CaseTrack, 'unset'>, string[]> = {
  rfd: [
    'Standard MVA path',
    'Treatment near MMI',
    'Demand-ready',
    'Soft-tissue resolved',
    'Imaging complete, no surgery',
  ],
  litigation: [
    'Policy limits exceeded',
    'Multi-defendant exposure',
    'Severe / catastrophic injury',
    'High-value premises (building-owner stack)',
    'Disputed liability',
    'Bad-faith carrier conduct',
  ],
  cut: [
    'Statute of limitations lapsed',
    'Insufficient damages',
    'Prior representation',
    'Client uncooperative / lost contact',
    'Liability cannot be established',
    'Pre-existing condition only',
  ],
  transfer: [
    'Outside our jurisdiction',
    'Practice-area mismatch',
    'Conflict of interest',
    'Better fit at partner firm',
    'Volume / capacity referral',
  ],
}

// ---------------------------------------------------------------------------
// Manual track overrides (localStorage-backed for demo)
// ---------------------------------------------------------------------------

export interface TrackOverride {
  track: CaseTrack
  reason: string
  setAt: string // ISO
  setBy: string // user id or 'demo'
}

const OVERRIDE_KEY_PREFIX = 'caos:cases:trackOverrides:'

export function readTrackOverrides(userKey: string): Record<string, TrackOverride> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(OVERRIDE_KEY_PREFIX + userKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, TrackOverride>
    }
    return {}
  } catch {
    return {}
  }
}

export function writeTrackOverride(
  userKey: string,
  caseId: string,
  override: TrackOverride,
): void {
  if (typeof window === 'undefined') return
  const all = readTrackOverrides(userKey)
  all[caseId] = override
  try {
    window.localStorage.setItem(OVERRIDE_KEY_PREFIX + userKey, JSON.stringify(all))
    // Notify other components in the same tab.
    window.dispatchEvent(new CustomEvent('caos:track-override', { detail: { caseId } }))
  } catch {
    /* ignore */
  }
}

export function clearTrackOverride(userKey: string, caseId: string): void {
  if (typeof window === 'undefined') return
  const all = readTrackOverrides(userKey)
  delete all[caseId]
  try {
    window.localStorage.setItem(OVERRIDE_KEY_PREFIX + userKey, JSON.stringify(all))
    window.dispatchEvent(new CustomEvent('caos:track-override', { detail: { caseId } }))
  } catch {
    /* ignore */
  }
}

const TRACK_LABELS: Record<CaseTrack, string> = {
  rfd: 'RFD',
  litigation: 'Litigation',
  cut: 'Cut',
  transfer: 'Transfer',
  unset: 'Unset',
}

export function trackLabel(t: CaseTrack): string {
  return TRACK_LABELS[t]
}

/**
 * Tailwind color classes per track. Tuned for the dark theme.
 * Returned as a single string for `cn()` consumption.
 */
export function trackChipClass(t: CaseTrack): string {
  switch (t) {
    case 'rfd':
      return 'border-emerald-700/40 bg-emerald-900/20 text-emerald-300'
    case 'litigation':
      return 'border-violet-700/40 bg-violet-900/20 text-violet-300'
    case 'cut':
      return 'border-red-700/40 bg-red-900/20 text-red-300'
    case 'transfer':
      return 'border-amber-700/40 bg-amber-900/20 text-amber-300'
    case 'unset':
    default:
      return 'border-border bg-card text-muted-foreground'
  }
}

const LITIGATION_SIGNAL_RE =
  /policy limit|multi[- ]defendant|severe|catastrophic|building owner|premises|huge/i

/**
 * Resolve the track for a case: manual override (if any) wins, otherwise
 * derive from signals. Pass the user key to read overrides; omit for the
 * pure derived value.
 */
export function resolveCaseTrack(
  c: CaseForRanking,
  userKey?: string,
): CaseTrackInfo {
  if (userKey) {
    const overrides = readTrackOverrides(userKey)
    const ov = overrides[c.id]
    if (ov) {
      return {
        track: ov.track,
        progress: estimateProgress(c, ov.track),
        reason: ov.reason,
        isManualOverride: true,
      }
    }
  }
  return deriveCaseTrack(c)
}

/**
 * Derive a track from a case for ranking. This is a stand-in for the
 * eventual user-set value; once `case_tracks` is wired, that overrides this.
 */
export function deriveCaseTrack(c: CaseForRanking): CaseTrackInfo {
  const verdict = (c.verdict ?? '').toUpperCase()

  if (verdict.includes('CUT')) {
    return { track: 'cut', progress: 0, reason: 'Verdict: Cut' }
  }
  if (verdict.includes('REFER') || verdict.includes('TRANSFER')) {
    return { track: 'transfer', progress: 0, reason: 'Verdict: Refer out' }
  }

  const litigationSignal = c.redSignals.find((s) => LITIGATION_SIGNAL_RE.test(s))
  if (litigationSignal) {
    return {
      track: 'litigation',
      progress: estimateProgress(c, 'litigation'),
      reason: `Signal: ${litigationSignal}`,
    }
  }

  const highValue = (c.estValue ?? 0) >= 250_000
  if (highValue && verdict.includes('PURSUE-HARD')) {
    return {
      track: 'litigation',
      progress: estimateProgress(c, 'litigation'),
      reason: 'High value + pursue-hard',
    }
  }

  // Default: RFD
  return {
    track: 'rfd',
    progress: estimateProgress(c, 'rfd'),
    reason: 'On RFD path',
  }
}

/**
 * Derive track directly from a `FullCaseView` (Caseload / Case snapshot).
 * Uses operational indicators when present (`demandReadinessIndicator`,
 * `litigationReviewIndicator`, etc.) — these are stronger signals than what
 * we get from the queue's `CaseForRanking` shape, so this path is more
 * accurate.
 */
export function deriveTrackFromCaseView(cv: FullCaseView): CaseTrackInfo {
  const op = cv.operational
  const stage = cv.caseData.currentStage

  if (op.cutReviewIndicator === 'yes') {
    return {
      track: 'cut',
      progress: 0,
      reason: cv.caseData.cutRiskNote || 'Flagged for cut review',
    }
  }
  if (op.transferReviewIndicator === 'yes') {
    return {
      track: 'transfer',
      progress: 0,
      reason: cv.caseData.transferRiskNote || 'Flagged for transfer review',
    }
  }
  if (op.litigationReviewIndicator === 'yes' || stage === 'litigation') {
    return {
      track: 'litigation',
      progress: progressFromStage(stage, 'litigation'),
      reason: stage === 'litigation' ? 'In litigation stage' : 'Flagged for litigation review',
    }
  }

  return {
    track: 'rfd',
    progress: progressFromStage(stage, 'rfd'),
    reason:
      op.demandReadinessIndicator === 'yes'
        ? 'Demand-ready'
        : `On RFD path (${stage.replace(/_/g, ' ')})`,
  }
}

/**
 * Resolve a track for a `FullCaseView`, preferring a manual override when
 * one exists for this case. The override key is the `caseData.id`, matching
 * how the queue page persists overrides.
 */
export function resolveTrackForCaseView(
  cv: FullCaseView,
  userKey?: string,
): CaseTrackInfo {
  if (userKey) {
    const overrides = readTrackOverrides(userKey)
    const ov = overrides[cv.caseData.id]
    if (ov) {
      return {
        track: ov.track,
        progress: progressFromStage(cv.caseData.currentStage, ov.track),
        reason: ov.reason,
        isManualOverride: true,
      }
    }
  }
  return deriveTrackFromCaseView(cv)
}

const STAGE_PROGRESS: Record<string, number> = {
  early_case: 15,
  active_treatment: 35,
  mid_treatment: 55,
  late_treatment: 70,
  demand_prep: 85,
  litigation: 60,
  resolved: 100,
}

function progressFromStage(stage: string, track: CaseTrack): number {
  let p = STAGE_PROGRESS[stage] ?? 25
  if (track === 'litigation') p = Math.max(60, p)
  if (track === 'cut' || track === 'transfer') p = 0
  return Math.max(0, Math.min(100, p))
}

/**
 * Rough progress estimate based on signals available today. This will be
 * replaced by a real computation once treatment phase lives on cases.
 */
function estimateProgress(c: CaseForRanking, track: CaseTrack): number {
  // Base from value tier — bigger cases are usually further along.
  let p = 25
  if ((c.estValue ?? 0) >= 100_000) p += 20
  if ((c.estValue ?? 0) >= 250_000) p += 15

  // Penalty for stale contact (case stalled)
  if (c.lastContactAt) {
    const days =
      (Date.now() - new Date(c.lastContactAt).getTime()) / (24 * 60 * 60 * 1000)
    if (days > 14) p -= 10
    if (days > 30) p -= 10
  }

  // Bonus if recent treatment progress
  if (c.lastTreatmentEventAt) {
    const days =
      (Date.now() - new Date(c.lastTreatmentEventAt).getTime()) /
      (24 * 60 * 60 * 1000)
    if (days < 7) p += 10
  }

  if (track === 'litigation') p += 10 // litigation cases tend to be deeper

  return Math.max(5, Math.min(95, Math.round(p)))
}
