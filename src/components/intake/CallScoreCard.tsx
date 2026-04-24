import { useState } from 'react'
import { cn } from '@/lib/utils'

// Reusable Claude-scored call quality card. Shows four dimensions as
// horizontal bars with evidence quotes + optional missed-items chips.

export interface ScoreDimension {
  score: number
  evidence_quote: string
  missed_items?: string[]
  issues?: string[]
}

export interface CallScores {
  information_capture: ScoreDimension
  compliance: ScoreDimension
  empathy: ScoreDimension
  call_progression: ScoreDimension
}

interface CallScoreCardProps {
  scores: CallScores
  className?: string
}

type RowKey = keyof CallScores

const ROW_LABELS: Record<RowKey, string> = {
  information_capture: 'Information capture',
  compliance: 'Compliance',
  empathy: 'Empathy',
  call_progression: 'Call progression',
}

const ROW_ORDER: RowKey[] = [
  'information_capture',
  'compliance',
  'empathy',
  'call_progression',
]

// Pale-tint bar colors keyed to score tier.
function tierClasses(score: number): { bar: string; text: string } {
  if (score >= 90) return { bar: 'bg-ring/70', text: 'text-ring' }
  if (score >= 70) return { bar: 'bg-teal-400/70', text: 'text-teal-300' }
  if (score >= 50) return { bar: 'bg-amber-400/70', text: 'text-amber-300' }
  return { bar: 'bg-red-400/70', text: 'text-red-300' }
}

export function CallScoreCard({ scores, className }: CallScoreCardProps) {
  const overall = Math.round(
    ROW_ORDER.reduce((sum, k) => sum + scores[k].score, 0) / ROW_ORDER.length,
  )
  const overallTier = tierClasses(overall)

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Call score
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              'font-mono text-[18px] font-semibold tabular-nums',
              overallTier.text,
            )}
          >
            {overall}
          </span>
          <span className="text-[11px] text-muted-foreground">/ 100</span>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {ROW_ORDER.map((key) => (
          <ScoreRow key={key} label={ROW_LABELS[key]} dim={scores[key]} />
        ))}
      </div>
    </div>
  )
}

function ScoreRow({ label, dim }: { label: string; dim: ScoreDimension }) {
  const [open, setOpen] = useState(false)
  const tier = tierClasses(dim.score)
  const chips = [...(dim.missed_items ?? []), ...(dim.issues ?? [])]

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              'font-mono text-[12px] font-semibold tabular-nums',
              tier.text,
            )}
          >
            {dim.score}
          </span>
        </div>
      </div>

      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border">
        <div
          className={cn('h-full rounded-full transition-all', tier.bar)}
          style={{ width: `${Math.max(2, Math.min(100, dim.score))}%` }}
        />
      </div>

      <blockquote className="mt-2 border-l-2 border-ring/40 pl-3 text-[12px] italic text-muted-foreground">
        &ldquo;{dim.evidence_quote}&rdquo;
      </blockquote>

      {chips.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {chips.map((chip, i) => (
            <span
              key={`${chip}-${i}`}
              className="inline-flex h-5 items-center rounded-full border border-border bg-card px-2 text-[11px] text-muted-foreground"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? 'Hide reasoning' : 'Why this score?'}
      </button>

      {open && (
        <div className="mt-1.5 rounded-md border border-border bg-ring/10 p-2.5 text-[12px] text-foreground">
          Score reflects how fully the rep hit this rubric dimension. Deductions
          apply for missed required fields, skipped disclosures, or tone
          mismatches. See rubric v8 for full weighting.
        </div>
      )}
    </div>
  )
}

export default CallScoreCard
