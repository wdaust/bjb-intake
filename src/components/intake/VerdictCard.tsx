import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { verdictStyle } from '@/lib/intakeUtils'
import type { ValueTier } from '@/lib/intakeUtils'

// Verdict card — Claude's full recommendation for a scored intake lead.
// Shows verdict pill, value tier, opportunity score, confidence, narrative,
// reasoning bullets, green/red signals, and expandable fact accordions.

export type ReasoningTag = 'DECISION' | 'FIT' | 'SIGNAL' | 'RISK' | 'ACTION'

export interface ReasoningBullet {
  tag: ReasoningTag
  text: string
}

export interface VerdictCardProps {
  verdict: string
  valueTier: ValueTier
  opportunityScore: number
  confidence: string // '87% · High'
  estValueRange: string
  reasoningBullets: ReasoningBullet[] // exactly 5
  narrative: string
  greenSignals: string[]
  redSignals: string[]
  keyLiabilityFacts: string[]
  keyDamagesFacts: string[]
  weaknessesRisks: string[]
  recommendedNextAction: string
  className?: string
}

const TAG_TINTS: Record<ReasoningTag, string> = {
  DECISION: 'bg-[#6B8DFF]/10 text-[#6B8DFF] border-[#6B8DFF]/20',
  FIT: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  SIGNAL: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
  RISK: 'bg-red-500/10 text-red-300 border-red-500/20',
  ACTION: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
}

export function VerdictCard({
  verdict,
  valueTier,
  opportunityScore,
  confidence,
  estValueRange,
  reasoningBullets,
  narrative,
  greenSignals,
  redSignals,
  keyLiabilityFacts,
  keyDamagesFacts,
  weaknessesRisks,
  recommendedNextAction,
  className,
}: VerdictCardProps) {
  const vStyle = verdictStyle(verdict)

  return (
    <div
      className={cn(
        'rounded-lg border border-[#26251F] bg-[#141412] p-4',
        className,
      )}
    >
      {/* Header — verdict pill + score stats */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex h-7 items-center rounded-md px-3 text-[12px] font-semibold tracking-wide',
              vStyle.badge,
            )}
          >
            {verdict}
          </span>
          {valueTier && (
            <span className="inline-flex h-7 items-center rounded-md border border-[#26251F] bg-[#1B1A17] px-2 text-[11px] font-medium text-[#8A897F]">
              {valueTier}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-4">
          <Stat label="Opportunity" value={String(opportunityScore)} mono />
          <Stat label="Est. value" value={estValueRange} mono />
          <Stat label="Confidence" value={confidence} />
        </div>
      </div>

      {/* Narrative */}
      <p className="mt-3 text-[12px] leading-[1.55] text-[#EDECE5]">
        {narrative}
      </p>

      {/* Reasoning bullets */}
      <div className="mt-3 space-y-1.5">
        {reasoningBullets.map((b, i) => (
          <div key={i} className="flex gap-2">
            <span
              className={cn(
                'inline-flex h-5 shrink-0 items-center rounded-full border px-1.5 text-[10px] font-semibold tracking-wide',
                TAG_TINTS[b.tag],
              )}
            >
              {b.tag}
            </span>
            <span className="text-[12px] leading-[1.55] text-[#EDECE5]">
              {b.text}
            </span>
          </div>
        ))}
      </div>

      {/* Green / red signals */}
      {(greenSignals.length > 0 || redSignals.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1">
          {greenSignals.map((s, i) => (
            <span
              key={`g-${i}`}
              className="inline-flex h-5 items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 text-[11px] text-emerald-300"
            >
              + {s}
            </span>
          ))}
          {redSignals.map((s, i) => (
            <span
              key={`r-${i}`}
              className="inline-flex h-5 items-center rounded-full border border-red-500/20 bg-red-500/10 px-2 text-[11px] text-red-300"
            >
              − {s}
            </span>
          ))}
        </div>
      )}

      {/* Fact accordions */}
      <div className="mt-3 space-y-1 border-t border-[#26251F] pt-3">
        <FactAccordion title="Key liability facts" items={keyLiabilityFacts} />
        <FactAccordion title="Key damages facts" items={keyDamagesFacts} />
        <FactAccordion title="Weaknesses / risks" items={weaknessesRisks} />
      </div>

      {/* Recommended next action */}
      <div className="mt-3 rounded-md border border-[#6B8DFF]/20 bg-[#1B1930] px-3 py-2">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[#6B8DFF]">
          Recommended next action
        </div>
        <div className="mt-1 text-[12px] leading-[1.5] text-[#EDECE5]">
          {recommendedNextAction}
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[#8A897F]">
        {label}
      </span>
      <span
        className={cn(
          'text-[13px] font-semibold text-[#EDECE5]',
          mono && 'font-mono tabular-nums',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function FactAccordion({ title, items }: { title: string; items: string[] }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-1 text-left text-[12px] font-medium text-[#EDECE5] transition-colors hover:text-[#6B8DFF]"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-[#8A897F] transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <ul className="mt-1 space-y-1 pb-1.5 pl-3">
          {items.map((it, i) => (
            <li
              key={i}
              className="relative text-[12px] leading-[1.5] text-[#EDECE5] before:absolute before:-left-3 before:top-[0.45em] before:h-1 before:w-1 before:rounded-full before:bg-[#8A897F]"
            >
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default VerdictCard
