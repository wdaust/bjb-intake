// Helpers for the Intake Queue: relative time, verdict + tier color tokens,
// SLA countdown formatting, and avatar initials.

export type ValueTier =
  | 'CATASTROPHIC'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'MINIMAL'
  | null

export interface TierStyle {
  badge: string // classes for pill background/border/text
  bar: string // class for the opportunity score bar fill
}

// Tailwind-friendly tokens. Low saturation per design spec.
const TIER_STYLES: Record<Exclude<ValueTier, null>, TierStyle> = {
  CATASTROPHIC: {
    badge: 'bg-red-500/10 text-red-300 border border-red-500/20',
    bar: 'bg-red-400/70',
  },
  HIGH: {
    badge: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
    bar: 'bg-amber-400/70',
  },
  MEDIUM: {
    badge: 'bg-blue-500/10 text-blue-300 border border-blue-500/20',
    bar: 'bg-blue-400/70',
  },
  LOW: {
    badge: 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
    bar: 'bg-slate-400/70',
  },
  MINIMAL: {
    badge: 'bg-[#26251F] text-[#8A897F] border border-[#26251F]',
    bar: 'bg-[#8A897F]/60',
  },
}

export function tierStyle(tier: ValueTier): TierStyle {
  if (!tier) {
    return {
      badge: 'bg-[#1B1A17] text-[#8A897F] border border-[#26251F]',
      bar: 'bg-[#8A897F]/40',
    }
  }
  return TIER_STYLES[tier]
}

// Verdict → tier mapping for the 17 categories. Defaults to LOW if unknown.
const VERDICT_TO_TIER: Record<string, Exclude<ValueTier, null>> = {
  'CATASTROPHIC-LIFE-ALTERING': 'CATASTROPHIC',
  'CATASTROPHIC-FATAL': 'CATASTROPHIC',
  'PURSUE-HARD': 'HIGH',
  'PURSUE-STANDARD': 'HIGH',
  'HIGH-VALUE-COMPLEX': 'HIGH',
  'SOLID-CASE': 'MEDIUM',
  'QUALIFIED-STANDARD': 'MEDIUM',
  'MARGINAL-PURSUE': 'MEDIUM',
  'MARGINAL-MONITOR': 'LOW',
  'LOW-VALUE-PURSUE': 'LOW',
  'REFER-OUT-VALUE': 'LOW',
  'REFER-OUT-JURISDICTION': 'LOW',
  'REFER-OUT-SPECIALTY': 'LOW',
  'REJECT-STATUTE': 'MINIMAL',
  'REJECT-LIABILITY': 'MINIMAL',
  'REJECT-DAMAGES': 'MINIMAL',
  'REJECT-CONFLICT': 'MINIMAL',
}

export function verdictTier(verdict: string | null): ValueTier {
  if (!verdict) return null
  return VERDICT_TO_TIER[verdict] ?? 'LOW'
}

export function verdictStyle(verdict: string | null): TierStyle {
  return tierStyle(verdictTier(verdict))
}

// "2h ago", "just now", "3d ago"
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w ago`
  const mo = Math.floor(d / 30)
  return `${mo}mo ago`
}

// SLA countdown. Returns label + whether it is urgent (<5 min) or passed.
export interface SlaDisplay {
  label: string
  state: 'urgent' | 'ok' | 'passed' | 'none'
}

export function slaDisplay(deadlineIso: string | null): SlaDisplay {
  if (!deadlineIso) return { label: '—', state: 'none' }
  const deadline = new Date(deadlineIso).getTime()
  const now = Date.now()
  const ms = deadline - now
  if (ms <= 0) return { label: 'passed', state: 'passed' }
  const totalSec = Math.floor(ms / 1000)
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  const label = `${mins}:${secs.toString().padStart(2, '0')} left`
  return { label, state: mins < 5 ? 'urgent' : 'ok' }
}

export function initials(name: string | null): string {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('')
}

// Sort: SLA ascending (nulls last), then opportunityScore desc.
export function sortLeads<
  T extends { slaDeadline: string | null; opportunityScore: number | null },
>(leads: T[]): T[] {
  return [...leads].sort((a, b) => {
    const aSla = a.slaDeadline ? new Date(a.slaDeadline).getTime() : Infinity
    const bSla = b.slaDeadline ? new Date(b.slaDeadline).getTime() : Infinity
    if (aSla !== bSla) return aSla - bSla
    const aScore = a.opportunityScore ?? -1
    const bScore = b.opportunityScore ?? -1
    return bScore - aScore
  })
}
