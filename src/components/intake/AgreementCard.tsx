import { useEffect, useRef, useState } from 'react'
import { Send, ExternalLink, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Engagement-agreement lifecycle card. Shows 4-step dot progress and
// contextual action buttons based on status.

export type AgreementStatus = 'not_sent' | 'sent' | 'viewed' | 'signed'

interface AgreementCardProps {
  status: AgreementStatus
  sentAt?: string | null
  viewedAt?: string | null
  signedAt?: string | null
  signerPhone?: string | null
  onSend?: () => void
  onResend?: () => void
  onView?: () => void
  className?: string
}

const STEPS: { key: AgreementStatus; label: string }[] = [
  { key: 'not_sent', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'viewed', label: 'Viewed' },
  { key: 'signed', label: 'Signed' },
]

function formatTs(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function statusIndex(s: AgreementStatus): number {
  return STEPS.findIndex((x) => x.key === s)
}

export function AgreementCard({
  status,
  sentAt,
  viewedAt,
  signedAt,
  signerPhone,
  onSend,
  onResend,
  onView,
  className,
}: AgreementCardProps) {
  const currentIdx = statusIndex(status)
  const [flashIdx, setFlashIdx] = useState<number | null>(null)
  const prevIdxRef = useRef(currentIdx)

  // Flash a check icon when the status advances forward. Defer the setState
  // into a microtask so the effect body itself stays free of direct updates —
  // the visible result is the same, and lint is happy.
  useEffect(() => {
    if (currentIdx <= prevIdxRef.current) {
      prevIdxRef.current = currentIdx
      return undefined
    }
    const advancedTo = currentIdx
    prevIdxRef.current = currentIdx
    const onTick = window.setTimeout(() => setFlashIdx(advancedTo), 0)
    const offTick = window.setTimeout(() => setFlashIdx(null), 1500)
    return () => {
      window.clearTimeout(onTick)
      window.clearTimeout(offTick)
    }
  }, [currentIdx])

  const tsFor = (key: AgreementStatus): string | null | undefined => {
    if (key === 'sent') return sentAt
    if (key === 'viewed') return viewedAt
    if (key === 'signed') return signedAt
    return null
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Engagement agreement
        </div>
        {signerPhone && (
          <div className="font-mono text-[11px] text-muted-foreground">
            {signerPhone}
          </div>
        )}
      </div>

      {/* Dot progress */}
      <div className="mt-4 flex items-center">
        {STEPS.map((step, i) => {
          const done = i <= currentIdx
          const isCurrent = i === currentIdx
          const flashing = flashIdx === i
          return (
            <div key={step.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full border transition-all',
                    done
                      ? 'border-ring/30 bg-ring/10 text-ring'
                      : 'border-border bg-card text-muted-foreground',
                    isCurrent && 'ring-2 ring-ring/20',
                    flashing && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
                  )}
                >
                  {done ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </div>
                <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {step.label}
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {i === 0 ? '—' : formatTs(tsFor(step.key))}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-1 h-[1px] flex-1 -translate-y-4',
                    i < currentIdx ? 'bg-ring/30' : 'bg-border',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        {status === 'not_sent' && (
          <Button
            size="sm"
            className="h-7 rounded-md bg-ring text-[12px] text-background hover:bg-ring/90"
            onClick={onSend}
          >
            <Send className="mr-1 h-3 w-3" />
            Send agreement
          </Button>
        )}
        {status !== 'not_sent' && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-md border-border bg-card text-[12px] text-foreground hover:bg-ring/10"
              onClick={onResend}
            >
              <Send className="mr-1 h-3 w-3" />
              Resend
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-md border-border bg-card text-[12px] text-foreground hover:bg-ring/10"
              onClick={onView}
            >
              <ExternalLink className="mr-1 h-3 w-3" />
              View agreement
            </Button>
          </>
        )}
        {status === 'signed' && (
          <span className="ml-auto inline-flex h-5 items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-300">
            <Check className="mr-1 h-3 w-3" />
            Signed
          </span>
        )}
      </div>
    </div>
  )
}

export default AgreementCard
