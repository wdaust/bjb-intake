import { useEffect } from 'react'
import {
  type TreatmentEvent,
  type Injury,
  type Outcome,
  type DeclineReason,
  type EventStatus,
  MODALITY_LABEL,
  STATUS_LABEL,
  OUTCOME_LABEL,
  DECLINE_LABEL,
  BODY_REGION_LABEL,
  formatLongDate,
  statusPillClass,
  outcomeBadgeClass,
} from '@/lib/treatmentUtils'

interface Props {
  open: boolean
  event: TreatmentEvent | null
  injury: Injury | null
  onClose: () => void
  onChange: (patch: Partial<TreatmentEvent>) => void
}

const TOKEN = {
  bg: '#0B0B0A',
  surface: '#141412',
  border: '#26251F',
  text: '#EDECE5',
  muted: '#8A897F',
  accent: '#6B8DFF',
  aiTint: '#1B1930',
}

export function TreatmentEventDrawer({
  open,
  event,
  injury,
  onClose,
  onChange,
}: Props) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open || !event || !injury) return null

  const isDeclined = event.status === 'client_declined'

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13 }}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className="absolute right-0 top-0 h-full overflow-y-auto border-l"
        style={{
          width: 480,
          background: TOKEN.surface,
          borderColor: TOKEN.border,
          color: TOKEN.text,
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-5 py-4 border-b sticky top-0"
          style={{ background: TOKEN.surface, borderColor: TOKEN.border }}
        >
          <div>
            <div
              className="uppercase tracking-wider"
              style={{ color: TOKEN.muted, fontSize: 11, letterSpacing: '0.08em' }}
            >
              {MODALITY_LABEL[event.modality]}
            </div>
            <div className="font-semibold mt-0.5" style={{ fontSize: 15 }}>
              {event.providerName || 'Provider TBD'}
            </div>
            <div style={{ color: TOKEN.muted, fontSize: 12 }}>
              {BODY_REGION_LABEL[injury.bodyRegion]}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              style={{ color: TOKEN.muted }}
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {event.autoExtractedFromCall && (
            <div
              className="flex items-center gap-2 rounded-md px-3 py-2 border"
              style={{
                background: TOKEN.aiTint,
                borderColor: 'rgba(107, 141, 255, 0.35)',
                fontSize: 12,
              }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: TOKEN.accent }}
              />
              <span style={{ color: TOKEN.accent }}>Auto-extracted</span>
              <span style={{ color: TOKEN.muted }}>from call transcript</span>
            </div>
          )}

          <Row label="Status">
            <span
              className={
                'inline-flex items-center rounded px-2 h-5 border ' +
                statusPillClass(event.status)
              }
              style={{ fontSize: 11 }}
            >
              {STATUS_LABEL[event.status]}
            </span>
          </Row>

          <Row label="Scheduled">
            <span>{formatLongDate(event.scheduledDate)}</span>
          </Row>

          <Row label="Completed">
            <span>{formatLongDate(event.completedDate)}</span>
          </Row>

          {event.findings && (
            <Row label="Findings">
              <span>{event.findings}</span>
            </Row>
          )}

          {/* Outcome picker */}
          <div>
            <div
              className="uppercase mb-1.5"
              style={{
                color: TOKEN.muted,
                fontSize: 11,
                letterSpacing: '0.06em',
              }}
            >
              Outcome
            </div>
            <div className="flex items-center gap-2">
              <DrawerSelect
                value={event.outcome ?? ''}
                onChange={(v) =>
                  onChange({ outcome: (v || undefined) as Outcome | undefined })
                }
                options={[
                  { v: '', label: '—' },
                  ...(Object.keys(OUTCOME_LABEL) as Outcome[]).map((k) => ({
                    v: k,
                    label: OUTCOME_LABEL[k],
                  })),
                ]}
              />
              {event.outcome && (
                <span
                  className={
                    'inline-flex items-center rounded px-2 h-5 border ' +
                    outcomeBadgeClass(event.outcome)
                  }
                  style={{ fontSize: 11 }}
                >
                  {OUTCOME_LABEL[event.outcome]}
                </span>
              )}
            </div>
          </div>

          {/* Outcome notes */}
          <div>
            <div
              className="uppercase mb-1.5"
              style={{
                color: TOKEN.muted,
                fontSize: 11,
                letterSpacing: '0.06em',
              }}
            >
              Outcome Notes
            </div>
            <textarea
              value={event.outcomeNotes ?? ''}
              onChange={(e) => onChange({ outcomeNotes: e.target.value })}
              rows={3}
              placeholder="Add a note..."
              className="w-full rounded-md px-3 py-2 outline-none resize-none border"
              style={{
                background: TOKEN.bg,
                borderColor: TOKEN.border,
                color: TOKEN.text,
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Decline reason — shown when declined (or to mark) */}
          <div>
            <div
              className="uppercase mb-1.5"
              style={{
                color: TOKEN.muted,
                fontSize: 11,
                letterSpacing: '0.06em',
              }}
            >
              Decline Reason
            </div>
            <DrawerSelect
              value={event.declineReason ?? ''}
              onChange={(v) => {
                const reason = (v || undefined) as DeclineReason | undefined
                const patch: Partial<TreatmentEvent> = { declineReason: reason }
                if (reason && event.status !== 'client_declined') {
                  patch.status = 'client_declined' as EventStatus
                }
                onChange(patch)
              }}
              options={[
                { v: '', label: '—' },
                ...(Object.keys(DECLINE_LABEL) as DeclineReason[]).map((k) => ({
                  v: k,
                  label: DECLINE_LABEL[k],
                })),
              ]}
            />
            {isDeclined && !event.declineReason && (
              <div
                style={{ color: TOKEN.muted, fontSize: 11 }}
                className="mt-1.5"
              >
                Declined — select a reason to categorize.
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div
        className="uppercase shrink-0"
        style={{
          color: TOKEN.muted,
          fontSize: 11,
          letterSpacing: '0.06em',
          width: 96,
          paddingTop: 2,
        }}
      >
        {label}
      </div>
      <div className="flex-1 text-right" style={{ fontSize: 13 }}>
        {children}
      </div>
    </div>
  )
}

function DrawerSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { v: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md px-2.5 py-1.5 outline-none border"
      style={{
        background: TOKEN.bg,
        borderColor: TOKEN.border,
        color: TOKEN.text,
        fontSize: 13,
        minWidth: 160,
      }}
    >
      {options.map((o) => (
        <option key={o.v} value={o.v} style={{ background: TOKEN.surface }}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
