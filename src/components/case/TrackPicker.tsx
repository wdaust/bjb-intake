import { useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  TRACK_REASONS,
  trackChipClass,
  trackLabel,
  writeTrackOverride,
  clearTrackOverride,
  type CaseTrack,
  type CaseTrackInfo,
} from '@/lib/caseTrack'

interface TrackPickerProps {
  caseId: string
  userKey: string
  current: CaseTrackInfo
  onChange?: (info: CaseTrackInfo) => void
  /** Called when picker should close (after confirm or revert). */
  onClose?: () => void
}

const TRACK_OPTIONS: Exclude<CaseTrack, 'unset'>[] = [
  'rfd',
  'litigation',
  'cut',
  'transfer',
]

/**
 * In-popover UI for changing a case's advancement track. Forces the user to
 * pick a codified reason — free text intentionally not allowed so reports
 * can aggregate cleanly.
 */
export function TrackPicker({
  caseId,
  userKey,
  current,
  onChange,
  onClose,
}: TrackPickerProps) {
  const [picked, setPicked] = useState<Exclude<CaseTrack, 'unset'>>(
    current.track === 'unset' ? 'rfd' : (current.track as Exclude<CaseTrack, 'unset'>),
  )
  const [reason, setReason] = useState<string>(
    current.isManualOverride ? current.reason : '',
  )

  const reasons = TRACK_REASONS[picked]

  function confirm() {
    if (!reason) return
    writeTrackOverride(userKey, caseId, {
      track: picked,
      reason,
      setAt: new Date().toISOString(),
      setBy: userKey,
    })
    onChange?.({ track: picked, progress: current.progress, reason, isManualOverride: true })
    onClose?.()
  }

  function revert() {
    clearTrackOverride(userKey, caseId)
    onChange?.({ ...current, isManualOverride: false })
    onClose?.()
  }

  return (
    <div className="w-72 space-y-3 p-1">
      <div>
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Advancement Track
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {TRACK_OPTIONS.map((t) => {
            const active = picked === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setPicked(t)
                  setReason('')
                }}
                className={cn(
                  'inline-flex h-8 items-center justify-center gap-1 rounded-md border px-2 text-[12px] font-medium transition-colors',
                  active ? trackChipClass(t) : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {trackLabel(t)}
                {active && <Check className="h-3 w-3" />}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Reason
        </div>
        <div className="space-y-1">
          {reasons.map((r) => {
            const active = reason === r
            return (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[12px] transition-colors',
                  active
                    ? 'border-ring/40 bg-ring/10 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="flex-1">{r}</span>
                {active && <Check className="h-3 w-3 text-ring" />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        {current.isManualOverride ? (
          <button
            type="button"
            onClick={revert}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> Revert to AI
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!reason}
            className={cn(
              'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
              reason
                ? 'border-ring/40 bg-ring/15 text-ring hover:bg-ring/25'
                : 'border-border bg-card text-muted-foreground opacity-60',
            )}
          >
            Set track
          </button>
        </div>
      </div>
    </div>
  )
}
