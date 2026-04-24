/**
 * Call-queue ranking engine for CAOS (Case Action Operating System).
 *
 * Pure TypeScript — zero dependencies, no React, no Date.now() outside the
 * `now` parameter. The UI layer (drag-drop queue, plow-through mode) consumes
 * the ordering and reason chips produced here.
 *
 * Score formula (weighted, all sub-scores 0..100, final score 0..100):
 *   sla_urgency   × 0.35
 *   case_value    × 0.20
 *   contact_stale × 0.15
 *   treatment_gap × 0.15
 *   client_risk   × 0.10
 *   momentum_loss × 0.05
 *
 * Reason chips: each component emits a candidate chip with
 * weight = componentWeight × (subScore / 100). Top 3 by weight are returned.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CaseForRanking {
  id: string
  clientName: string
  caseType: string
  estValue: number | null
  slaDeadline: string | null
  lastContactAt: string | null
  lastTreatmentEventAt: string | null
  redSignals: string[]
  openAction: string | null
  verdict: string | null
}

export interface ReasonChip {
  kind: 'sla' | 'value' | 'stale_contact' | 'treatment_gap' | 'risk' | 'momentum'
  label: string
  weight: number
}

export type PriorityTier = 'critical' | 'high' | 'medium' | 'low'

export interface RankedCase extends CaseForRanking {
  rank: number
  aiScore: number
  reasonChips: ReasonChip[]
  priorityTier: PriorityTier
}

// ---------------------------------------------------------------------------
// Weights (exported so UI agents can label chips consistently)
// ---------------------------------------------------------------------------

export const WEIGHTS = {
  sla: 0.35,
  value: 0.2,
  contact: 0.15,
  treatment: 0.15,
  risk: 0.1,
  momentum: 0.05,
} as const

// ---------------------------------------------------------------------------
// Helpers — exported for UI/test reuse
// ---------------------------------------------------------------------------

const MS_PER_MIN = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MIN
const MS_PER_DAY = 24 * MS_PER_HOUR

/** Integer days between two dates (floor of absolute diff). */
export function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime())
  return Math.floor(ms / MS_PER_DAY)
}

/**
 * Human countdown for "time until X".
 *   < 0           → "breaching now"
 *   < 1 hour      → "42m"
 *   < 24 hours    → "3h 14m"
 *   >= 24 hours   → "2d 4h"
 */
export function humanCountdown(ms: number): string {
  if (ms <= 0) return 'breaching now'
  if (ms < MS_PER_HOUR) {
    const m = Math.max(1, Math.round(ms / MS_PER_MIN))
    return `${m}m`
  }
  if (ms < MS_PER_DAY) {
    const h = Math.floor(ms / MS_PER_HOUR)
    const m = Math.floor((ms - h * MS_PER_HOUR) / MS_PER_MIN)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  const d = Math.floor(ms / MS_PER_DAY)
  const h = Math.floor((ms - d * MS_PER_DAY) / MS_PER_HOUR)
  return h > 0 ? `${d}d ${h}h` : `${d}d`
}

/**
 * Percentile rank of `value` within `sorted` (ascending array).
 * Returns 0..100. Uses "percent at-or-below" semantics, so the max value
 * is always ~100 and the min value is always > 0.
 */
export function percentile(value: number, sorted: number[]): number {
  if (sorted.length === 0) return 50
  let count = 0
  for (const v of sorted) {
    if (v <= value) count++
    else break
  }
  return Math.round((count / sorted.length) * 100)
}

// ---------------------------------------------------------------------------
// Sub-score functions (each 0..100)
// ---------------------------------------------------------------------------

/** 100 if breaching <1h, 80 if <4h, 60 if <24h, 20 if <3d, 0 else. Null → 0. */
export function slaUrgencyScore(slaDeadline: string | null, now: Date): number {
  if (!slaDeadline) return 0
  const ms = new Date(slaDeadline).getTime() - now.getTime()
  if (ms < MS_PER_HOUR) return 100
  if (ms < 4 * MS_PER_HOUR) return 80
  if (ms < MS_PER_DAY) return 60
  if (ms < 3 * MS_PER_DAY) return 20
  return 0
}

/**
 * Case value sub-score. Z-score vs caseload mean, clamped 0..100.
 * Null value → 20 baseline (no penalty for missing data, but not rewarded).
 *
 * Scaling: a z-score of 0 (mean) → 50; +2σ (~top 2.5%) → 100; -2σ → 0.
 */
export function caseValueScore(
  value: number | null,
  mean: number,
  stddev: number,
): number {
  if (value === null) return 20
  if (stddev <= 0) return 50 // all values equal
  const z = (value - mean) / stddev
  const raw = 50 + 25 * z // +2σ → 100, -2σ → 0
  return Math.max(0, Math.min(100, raw))
}

/**
 * Sigmoid-style mapping on days since event.
 * Null lastContactAt → 100 ("never contacted").
 * Piecewise-linear anchors per spec: 0d→0, 3d→40, 7d→70, 14d→90, 30d→100.
 */
export function contactStaleScore(
  lastContactAt: string | null,
  now: Date,
): number {
  if (!lastContactAt) return 100
  const days = daysBetween(new Date(lastContactAt), now)
  return sigmoidDays(days)
}

/** Same sigmoid as contact. Null → 50 baseline. */
export function treatmentGapScore(
  lastTreatmentEventAt: string | null,
  now: Date,
): number {
  if (!lastTreatmentEventAt) return 50
  const days = daysBetween(new Date(lastTreatmentEventAt), now)
  return sigmoidDays(days)
}

function sigmoidDays(days: number): number {
  // Anchor points: (0, 0) (3, 40) (7, 70) (14, 90) (30, 100)
  const anchors: [number, number][] = [
    [0, 0],
    [3, 40],
    [7, 70],
    [14, 90],
    [30, 100],
  ]
  if (days <= 0) return 0
  if (days >= 30) return 100
  for (let i = 0; i < anchors.length - 1; i++) {
    const [d0, s0] = anchors[i]!
    const [d1, s1] = anchors[i + 1]!
    if (days >= d0 && days <= d1) {
      const t = (days - d0) / (d1 - d0)
      return Math.round(s0 + t * (s1 - s0))
    }
  }
  return 100
}

/**
 * client_risk = min(100, redSignals.length * 25).
 * If "SOL <30d" is present, bump the baseline to at least 60 (per spec).
 */
export function clientRiskScore(redSignals: string[]): number {
  const base = Math.min(100, redSignals.length * 25)
  const hasSol = redSignals.some((s) => /SOL\s*<\s*30/i.test(s))
  return hasSol ? Math.max(60, base) : base
}

/** 100 if any red signal starts with "Client hesit" or "Treatment stall". */
export function momentumLossScore(redSignals: string[]): number {
  for (const s of redSignals) {
    const t = s.trim().toLowerCase()
    if (t.startsWith('client hesit') || t.startsWith('treatment stall')) {
      return 100
    }
  }
  return 0
}

// ---------------------------------------------------------------------------
// Chip builders
// ---------------------------------------------------------------------------

function buildSlaChip(
  slaDeadline: string | null,
  subScore: number,
  now: Date,
): ReasonChip | null {
  if (!slaDeadline || subScore === 0) return null
  const ms = new Date(slaDeadline).getTime() - now.getTime()
  const label =
    ms <= 0
      ? 'SLA breaching now'
      : `SLA breaching in ${humanCountdown(ms)}`
  return {
    kind: 'sla',
    label,
    weight: WEIGHTS.sla * (subScore / 100),
  }
}

function buildValueChip(
  estValue: number | null,
  subScore: number,
  sortedValues: number[],
): ReasonChip | null {
  if (estValue === null || sortedValues.length === 0) return null
  const pct = percentile(estValue, sortedValues)
  const topPct = Math.max(1, 100 - pct) // "top X%"
  const dollars = formatDollars(estValue)
  const label = `${dollars} value · top ${topPct}% of caseload`
  return {
    kind: 'value',
    label,
    weight: WEIGHTS.value * (subScore / 100),
  }
}

function buildStaleContactChip(
  lastContactAt: string | null,
  subScore: number,
  now: Date,
): ReasonChip | null {
  if (subScore === 0) return null
  if (!lastContactAt) {
    return {
      kind: 'stale_contact',
      label: 'Never contacted',
      weight: WEIGHTS.contact * (subScore / 100),
    }
  }
  const days = daysBetween(new Date(lastContactAt), now)
  if (days <= 0) return null
  return {
    kind: 'stale_contact',
    label: `${days} days since last contact`,
    weight: WEIGHTS.contact * (subScore / 100),
  }
}

function buildTreatmentGapChip(
  lastTreatmentEventAt: string | null,
  subScore: number,
  now: Date,
): ReasonChip | null {
  if (!lastTreatmentEventAt) {
    // Null → 50 baseline; still surface it as a soft reason.
    return {
      kind: 'treatment_gap',
      label: 'Treatment gap: no activity logged',
      weight: WEIGHTS.treatment * (subScore / 100),
    }
  }
  const days = daysBetween(new Date(lastTreatmentEventAt), now)
  if (days <= 0) return null
  return {
    kind: 'treatment_gap',
    label: `Treatment gap: no activity in ${days} days`,
    weight: WEIGHTS.treatment * (subScore / 100),
  }
}

function buildRiskChip(
  redSignals: string[],
  subScore: number,
): ReasonChip | null {
  if (subScore === 0 || redSignals.length === 0) return null
  // Prefer the sharpest specific signal if available.
  const sol = redSignals.find((s) => /SOL\s*<\s*30/i.test(s))
  const label = sol
    ? 'SOL <30 days'
    : redSignals.length === 1
      ? redSignals[0]!
      : `${redSignals.length} red signals flagged`
  return {
    kind: 'risk',
    label,
    weight: WEIGHTS.risk * (subScore / 100),
  }
}

function buildMomentumChip(
  redSignals: string[],
  subScore: number,
): ReasonChip | null {
  if (subScore === 0) return null
  const signal = redSignals.find((s) => {
    const t = s.trim().toLowerCase()
    return t.startsWith('client hesit') || t.startsWith('treatment stall')
  })
  if (!signal) return null
  return {
    kind: 'momentum',
    label: signal,
    weight: WEIGHTS.momentum * (subScore / 100),
  }
}

function formatDollars(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1000)}K`
  }
  return `$${value}`
}

// ---------------------------------------------------------------------------
// Priority tier
// ---------------------------------------------------------------------------

function tierFor(score: number, slaSubScore: number): PriorityTier {
  if (score >= 75 || slaSubScore >= 80) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function rankCases(
  cases: CaseForRanking[],
  now: Date = new Date(),
): RankedCase[] {
  if (cases.length === 0) return []

  // Pre-compute caseload stats for the value sub-score and percentile.
  const values: number[] = []
  for (const c of cases) {
    if (c.estValue !== null) values.push(c.estValue)
  }
  const sortedValues = [...values].sort((a, b) => a - b)
  const mean =
    values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
  const variance =
    values.length > 0
      ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
      : 0
  const stddev = Math.sqrt(variance)

  // Score each case.
  const scored = cases.map((c) => {
    const sla = slaUrgencyScore(c.slaDeadline, now)
    const value = caseValueScore(c.estValue, mean, stddev)
    const contact = contactStaleScore(c.lastContactAt, now)
    const treatment = treatmentGapScore(c.lastTreatmentEventAt, now)
    const risk = clientRiskScore(c.redSignals)
    const momentum = momentumLossScore(c.redSignals)

    const aiScore = Math.round(
      sla * WEIGHTS.sla +
        value * WEIGHTS.value +
        contact * WEIGHTS.contact +
        treatment * WEIGHTS.treatment +
        risk * WEIGHTS.risk +
        momentum * WEIGHTS.momentum,
    )

    // Candidate chips — nulls filtered out.
    const candidates: ReasonChip[] = []
    const slaChip = buildSlaChip(c.slaDeadline, sla, now)
    if (slaChip) candidates.push(slaChip)
    const valueChip = buildValueChip(c.estValue, value, sortedValues)
    if (valueChip) candidates.push(valueChip)
    const staleChip = buildStaleContactChip(c.lastContactAt, contact, now)
    if (staleChip) candidates.push(staleChip)
    const treatmentChip = buildTreatmentGapChip(
      c.lastTreatmentEventAt,
      treatment,
      now,
    )
    if (treatmentChip) candidates.push(treatmentChip)
    const riskChip = buildRiskChip(c.redSignals, risk)
    if (riskChip) candidates.push(riskChip)
    const momentumChip = buildMomentumChip(c.redSignals, momentum)
    if (momentumChip) candidates.push(momentumChip)

    candidates.sort((a, b) => b.weight - a.weight)
    const reasonChips = candidates.slice(0, 3)

    const priorityTier = tierFor(aiScore, sla)

    return {
      ...c,
      aiScore,
      reasonChips,
      priorityTier,
      // sla kept for tiebreaker; stripped below
      _slaMs: c.slaDeadline
        ? new Date(c.slaDeadline).getTime()
        : Number.POSITIVE_INFINITY,
    }
  })

  // Stable sort: score desc, then soonest SLA, then clientName asc.
  scored.sort((a, b) => {
    if (b.aiScore !== a.aiScore) return b.aiScore - a.aiScore
    if (a._slaMs !== b._slaMs) return a._slaMs - b._slaMs
    return a.clientName.localeCompare(b.clientName)
  })

  return scored.map((s, i) => {
    const { _slaMs: _unused, ...rest } = s
    void _unused
    return { ...rest, rank: i + 1 }
  })
}

// ---------------------------------------------------------------------------
// Demo fixtures — used by UI agents for seeded demo rendering.
// All timestamps are anchored to a fixed "now" so the ranking is deterministic
// regardless of when the demo is run. UI code can pass the same anchor to
// `rankCases(RANKER_DEMO_CASES, RANKER_DEMO_NOW)` for stable output.
// ---------------------------------------------------------------------------

export const RANKER_DEMO_NOW = new Date('2026-04-24T14:00:00Z')

function offsetIso(ms: number): string {
  return new Date(RANKER_DEMO_NOW.getTime() + ms).toISOString()
}

export const RANKER_DEMO_CASES: CaseForRanking[] = [
  // --- 2 critical SLA <1h ---
  {
    id: 'MAT-260001',
    clientName: 'Maria Santos',
    caseType: 'MVA',
    estValue: 95_000,
    slaDeadline: offsetIso(42 * MS_PER_MIN), // 42m out
    lastContactAt: offsetIso(-2 * MS_PER_DAY),
    lastTreatmentEventAt: offsetIso(-5 * MS_PER_DAY),
    redSignals: ['Awaiting MRI authorization'],
    openAction: 'Confirm MRI scheduling',
    verdict: 'PURSUE-HARD',
  },
  {
    id: 'MAT-260002',
    clientName: 'Eamon O’Brien',
    caseType: 'MVA',
    estValue: 70_000,
    slaDeadline: offsetIso(25 * MS_PER_MIN), // 25m out
    lastContactAt: offsetIso(-1 * MS_PER_DAY),
    lastTreatmentEventAt: offsetIso(-8 * MS_PER_DAY),
    redSignals: [],
    openAction: 'Return client voicemail',
    verdict: 'PURSUE-STANDARD',
  },

  // --- 3 stale contact >10d ---
  {
    id: 'MAT-260003',
    clientName: 'Brandon Yu',
    caseType: 'Slip and Fall',
    estValue: 35_000,
    slaDeadline: null,
    lastContactAt: offsetIso(-12 * MS_PER_DAY),
    lastTreatmentEventAt: offsetIso(-14 * MS_PER_DAY),
    redSignals: ['Treatment stalled'],
    openAction: 'Re-engage client',
    verdict: 'SOLID-CASE',
  },
  {
    id: 'MAT-260004',
    clientName: 'Priya Raman',
    caseType: 'Premises',
    estValue: 28_000,
    slaDeadline: null,
    lastContactAt: offsetIso(-18 * MS_PER_DAY),
    lastTreatmentEventAt: offsetIso(-22 * MS_PER_DAY),
    redSignals: [],
    openAction: 'Call to confirm PT progress',
    verdict: 'MARGINAL-PURSUE',
  },
  {
    id: 'MAT-260005',
    clientName: 'Luis Aguilar',
    caseType: 'Dog Bite',
    estValue: 22_000,
    slaDeadline: null,
    lastContactAt: offsetIso(-15 * MS_PER_DAY),
    lastTreatmentEventAt: offsetIso(-9 * MS_PER_DAY),
    redSignals: ['Client hesitation on last call'],
    openAction: 'Warm re-engagement call',
    verdict: 'SOLID-CASE',
  },

  // --- 2 high-value ($200K+) ---
  {
    id: 'MAT-260006',
    clientName: 'Tasha Greenberg',
    caseType: 'Construction',
    estValue: 850_000,
    slaDeadline: offsetIso(2 * MS_PER_DAY), // mild SLA
    lastContactAt: offsetIso(-4 * MS_PER_DAY),
    lastTreatmentEventAt: offsetIso(-6 * MS_PER_DAY),
    redSignals: [],
    openAction: 'Schedule deposition prep',
    verdict: 'PURSUE-HARD',
  },
  {
    id: 'MAT-260007',
    clientName: 'Wendy Kowalski',
    caseType: 'MVA',
    estValue: 240_000,
    slaDeadline: null,
    lastContactAt: offsetIso(-6 * MS_PER_DAY),
    lastTreatmentEventAt: offsetIso(-10 * MS_PER_DAY),
    redSignals: [],
    openAction: 'Confirm orthopedist referral',
    verdict: 'PURSUE-HARD',
  },

  // --- 1 with 4 red signals ---
  {
    id: 'MAT-260008',
    clientName: 'Darnell Whitfield',
    caseType: 'Premises',
    estValue: 55_000,
    slaDeadline: offsetIso(6 * MS_PER_HOUR), // within 24h, not super urgent
    lastContactAt: offsetIso(-11 * MS_PER_DAY),
    lastTreatmentEventAt: offsetIso(-17 * MS_PER_DAY),
    redSignals: [
      'SOL <30 days',
      'Client hesitation on last call',
      'Treatment stalled',
      'Coverage dispute with carrier',
    ],
    openAction: 'Escalate to senior attorney',
    verdict: 'PURSUE-HARD',
  },

  // --- 2 boring low-priority ---
  {
    id: 'MAT-260009',
    clientName: 'Henry Pham',
    caseType: 'MVA',
    estValue: 8_000,
    slaDeadline: null,
    lastContactAt: offsetIso(-1 * MS_PER_DAY),
    lastTreatmentEventAt: offsetIso(-2 * MS_PER_DAY),
    redSignals: [],
    openAction: null,
    verdict: 'REFER-OUT-VALUE',
  },
  {
    id: 'MAT-260010',
    clientName: 'Alicia Fernandez',
    caseType: 'Minor MVA',
    estValue: 6_500,
    slaDeadline: null,
    lastContactAt: offsetIso(-2 * MS_PER_DAY),
    lastTreatmentEventAt: offsetIso(-3 * MS_PER_DAY),
    redSignals: [],
    openAction: 'Routine check-in',
    verdict: 'SOLID-CASE',
  },

  // --- 2 medium (balanced) ---
  {
    id: 'MAT-260011',
    clientName: 'Marcus Lee',
    caseType: 'MVA',
    estValue: 65_000,
    slaDeadline: offsetIso(20 * MS_PER_HOUR), // <24h, score 60
    lastContactAt: offsetIso(-7 * MS_PER_DAY),
    lastTreatmentEventAt: offsetIso(-9 * MS_PER_DAY),
    redSignals: [],
    openAction: 'Schedule PT',
    verdict: 'SOLID-CASE',
  },
  {
    id: 'MAT-260012',
    clientName: 'Sofia Delgado',
    caseType: 'Premises',
    estValue: 48_000,
    slaDeadline: offsetIso(2.5 * MS_PER_DAY), // <3d, score 20
    lastContactAt: offsetIso(-8 * MS_PER_DAY),
    lastTreatmentEventAt: null,
    redSignals: ['Awaiting medical records'],
    openAction: 'Request records from provider',
    verdict: 'PURSUE-STANDARD',
  },
]
