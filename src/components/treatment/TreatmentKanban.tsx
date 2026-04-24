import { useMemo, useState, useCallback } from 'react'
import {
  type Injury,
  type TreatmentEvent,
  type Phase,
  PHASES,
  MODALITY_LABEL,
  STATUS_LABEL,
  OUTCOME_LABEL,
  DECLINE_LABEL,
  BODY_REGION_LABEL,
  phaseForModality,
  statusPillClass,
  severityPillClass,
  outcomeBadgeClass,
  formatShortDate,
  isForwardMove,
} from '@/lib/treatmentUtils'
import { TreatmentEventDrawer } from './TreatmentEventDrawer'

const TOKEN = {
  bg: '#0B0B0A',
  surface: '#141412',
  border: '#26251F',
  text: '#EDECE5',
  muted: '#8A897F',
  accent: '#6B8DFF',
  aiTint: '#1B1930',
}

// ---------- Demo data: Maria Santos ----------

export const DEMO_INJURIES: Injury[] = [
  {
    id: 'inj-cervical',
    caseId: 'case-maria-santos',
    bodyRegion: 'cervical',
    severity: 'severe',
    erAdmitted: true,
    erFacility: 'Kaiser Oakland ER',
    currentPhase: 'imaging',
    nextAction: 'Confirm PT appt',
  },
  {
    id: 'inj-lumbar',
    caseId: 'case-maria-santos',
    bodyRegion: 'lumbar',
    severity: 'severe',
    erAdmitted: true,
    erFacility: 'Kaiser Oakland ER',
    currentPhase: 'imaging',
    nextAction: 'Confirm MRI order by tomorrow',
  },
  {
    id: 'inj-shoulder',
    caseId: 'case-maria-santos',
    bodyRegion: 'shoulder_r',
    severity: 'moderate',
    erAdmitted: true,
    erFacility: 'Kaiser Oakland ER',
    currentPhase: 'conservative',
    nextAction: 'Evaluate at next PT visit',
  },
]

export const DEMO_EVENTS: TreatmentEvent[] = [
  // Cervical
  {
    id: 'evt-c-er',
    injuryId: 'inj-cervical',
    modality: 'er',
    status: 'completed',
    providerName: 'Kaiser Oakland ER',
    scheduledDate: '2026-04-18',
    completedDate: '2026-04-18',
    outcome: 'inconclusive',
    findings: 'Cervical strain, neuro intact. Imaging recommended.',
    autoExtractedFromCall: false,
  },
  {
    id: 'evt-c-pt',
    injuryId: 'inj-cervical',
    modality: 'pt',
    status: 'recommended',
    providerName: 'Bay Area Physical Therapy',
    autoExtractedFromCall: true,
  },
  {
    id: 'evt-c-mri',
    injuryId: 'inj-cervical',
    modality: 'mri',
    status: 'scheduled',
    providerName: 'RadNet Oakland',
    scheduledDate: '2026-04-28',
    autoExtractedFromCall: false,
  },
  // Lumbar
  {
    id: 'evt-l-er',
    injuryId: 'inj-lumbar',
    modality: 'er',
    status: 'completed',
    providerName: 'Kaiser Oakland ER',
    scheduledDate: '2026-04-18',
    completedDate: '2026-04-18',
    outcome: 'inconclusive',
    findings: 'Shooting pain down right leg. L4-L5 herniation suspected.',
    autoExtractedFromCall: false,
  },
  {
    id: 'evt-l-pt',
    injuryId: 'inj-lumbar',
    modality: 'pt',
    status: 'recommended',
    providerName: 'Bay Area Physical Therapy',
    autoExtractedFromCall: true,
  },
  {
    id: 'evt-l-mri',
    injuryId: 'inj-lumbar',
    modality: 'mri',
    status: 'scheduled',
    providerName: 'RadNet Oakland',
    scheduledDate: '2026-04-29',
    outcomeNotes: 'Urgent — L4-L5 suspected',
    autoExtractedFromCall: true,
  },
  // Shoulder
  {
    id: 'evt-s-er',
    injuryId: 'inj-shoulder',
    modality: 'er',
    status: 'completed',
    providerName: 'Kaiser Oakland ER',
    scheduledDate: '2026-04-18',
    completedDate: '2026-04-18',
    outcome: 'no_change',
    findings: 'Contusion, ROM limited. Reassess at follow-up.',
    autoExtractedFromCall: false,
  },
]

// ---------- Props ----------

export interface TreatmentKanbanProps {
  injuries?: Injury[]
  events?: TreatmentEvent[]
  onEventUpdate?: (e: TreatmentEvent) => void
}

// ---------- Component ----------

export function TreatmentKanban({
  injuries: injuriesProp,
  events: eventsProp,
  onEventUpdate,
}: TreatmentKanbanProps) {
  const [injuries] = useState<Injury[]>(injuriesProp ?? DEMO_INJURIES)
  const [events, setEvents] = useState<TreatmentEvent[]>(eventsProp ?? DEMO_EVENTS)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragEventId, setDragEventId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<{
    injuryId: string
    phase: Phase
  } | null>(null)

  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId]
  )
  const selectedInjury = useMemo(
    () =>
      selected ? injuries.find((i) => i.id === selected.injuryId) ?? null : null,
    [injuries, selected]
  )

  const updateEvent = useCallback(
    (id: string, patch: Partial<TreatmentEvent>) => {
      setEvents((prev) => {
        const next = prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
        const updated = next.find((e) => e.id === id)
        if (updated) onEventUpdate?.(updated)
        return next
      })
    },
    [onEventUpdate]
  )

  const handleDrop = (injuryId: string, targetPhase: Phase) => {
    if (!dragEventId) return
    const evt = events.find((e) => e.id === dragEventId)
    if (!evt || evt.injuryId !== injuryId) {
      setDragEventId(null)
      setDragOver(null)
      return
    }
    const currentPhase = phaseForModality(evt.modality)
    if (!isForwardMove(currentPhase, targetPhase)) {
      setDragEventId(null)
      setDragOver(null)
      return
    }
    // Forward move: we don't mutate modality, we stamp the phase by status.
    // Moving forward without a completion record = "scheduled" at minimum.
    updateEvent(dragEventId, {
      status: evt.status === 'recommended' ? 'scheduled' : evt.status,
    })
    setDragEventId(null)
    setDragOver(null)
  }

  return (
    <div
      className="w-full"
      style={{
        background: TOKEN.bg,
        color: TOKEN.text,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13,
      }}
    >
      {/* Column header row */}
      <div
        className="grid gap-3 px-4 pt-4 pb-2 sticky top-0 z-10"
        style={{
          gridTemplateColumns: `220px repeat(${PHASES.length}, minmax(180px, 1fr))`,
          background: TOKEN.bg,
        }}
      >
        <div />
        {PHASES.map((p) => (
          <div
            key={p.key}
            className="uppercase"
            style={{
              color: TOKEN.muted,
              fontSize: 11,
              letterSpacing: '0.08em',
              paddingLeft: 4,
            }}
          >
            {p.label}
          </div>
        ))}
      </div>

      {/* Swimlanes */}
      <div className="px-4 pb-6 space-y-3">
        {injuries.map((injury) => {
          const injuryEvents = events.filter((e) => e.injuryId === injury.id)
          const byPhase: Record<Phase, TreatmentEvent[]> = {
            conservative: [],
            imaging: [],
            pain_mgmt: [],
            surgical: [],
            mmi: [],
          }
          injuryEvents.forEach((e) =>
            byPhase[phaseForModality(e.modality)].push(e)
          )

          return (
            <div
              key={injury.id}
              className="rounded-lg border"
              style={{
                background: TOKEN.surface,
                borderColor: TOKEN.border,
              }}
            >
              {/* Swimlane header */}
              <SwimlaneHeader
                injury={injury}
                counts={{
                  conservative: byPhase.conservative.length,
                  imaging: byPhase.imaging.length,
                  pain_mgmt: byPhase.pain_mgmt.length,
                  surgical: byPhase.surgical.length,
                  mmi: byPhase.mmi.length,
                }}
              />

              {/* Lane body */}
              <div
                className="grid gap-3 px-3 py-3 border-t"
                style={{
                  gridTemplateColumns: `220px repeat(${PHASES.length}, minmax(180px, 1fr))`,
                  borderColor: TOKEN.border,
                }}
              >
                {/* Empty spacer to align with header column */}
                <div />
                {PHASES.map((p) => {
                  const list = byPhase[p.key]
                  const isOver =
                    dragOver?.injuryId === injury.id &&
                    dragOver.phase === p.key
                  return (
                    <div
                      key={p.key}
                      onDragOver={(e) => {
                        if (!dragEventId) return
                        const dragging = events.find(
                          (ev) => ev.id === dragEventId
                        )
                        if (!dragging || dragging.injuryId !== injury.id) return
                        const from = phaseForModality(dragging.modality)
                        if (!isForwardMove(from, p.key)) return
                        e.preventDefault()
                        if (
                          !dragOver ||
                          dragOver.injuryId !== injury.id ||
                          dragOver.phase !== p.key
                        ) {
                          setDragOver({ injuryId: injury.id, phase: p.key })
                        }
                      }}
                      onDragLeave={() => {
                        if (
                          dragOver?.injuryId === injury.id &&
                          dragOver.phase === p.key
                        ) {
                          setDragOver(null)
                        }
                      }}
                      onDrop={() => handleDrop(injury.id, p.key)}
                      className="rounded-md min-h-[112px] p-1.5 transition-colors"
                      style={{
                        background: isOver
                          ? 'rgba(107, 141, 255, 0.06)'
                          : 'transparent',
                        border: isOver
                          ? `1px dashed ${TOKEN.accent}`
                          : '1px dashed transparent',
                      }}
                    >
                      {list.length === 0 ? (
                        <div
                          className="h-full w-full flex items-center justify-center"
                          style={{ color: TOKEN.muted, fontSize: 11 }}
                        >
                          —
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {list.map((e) => (
                            <EventCard
                              key={e.id}
                              event={e}
                              onOpen={() => setSelectedId(e.id)}
                              onDragStart={() => setDragEventId(e.id)}
                              onDragEnd={() => {
                                setDragEventId(null)
                                setDragOver(null)
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <TreatmentEventDrawer
        open={!!selected}
        event={selected}
        injury={selectedInjury}
        onClose={() => setSelectedId(null)}
        onChange={(patch) => selected && updateEvent(selected.id, patch)}
      />
    </div>
  )
}

// ---------- Swimlane header ----------

function SwimlaneHeader({
  injury,
  counts,
}: {
  injury: Injury
  counts: Record<Phase, number>
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="font-semibold truncate" style={{ fontSize: 13 }}>
          {BODY_REGION_LABEL[injury.bodyRegion]}
        </div>
        <span
          className={
            'inline-flex items-center rounded px-2 h-5 border capitalize ' +
            severityPillClass(injury.severity)
          }
          style={{ fontSize: 11 }}
        >
          {injury.severity}
        </span>
        {injury.nextAction && (
          <button
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 h-6 border transition-colors hover:bg-white/[0.02]"
            style={{
              borderColor: 'rgba(107, 141, 255, 0.35)',
              background: 'rgba(107, 141, 255, 0.08)',
              color: TOKEN.accent,
              fontSize: 12,
            }}
            onClick={(e) => e.stopPropagation()}
            title={injury.nextAction}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
            <span className="truncate" style={{ maxWidth: 220 }}>
              Next: {injury.nextAction}
            </span>
          </button>
        )}
      </div>

      {/* Right: per-phase counts */}
      <div className="flex items-center gap-2 shrink-0">
        {PHASES.map((p) => {
          const n = counts[p.key]
          const active = n > 0
          return (
            <div
              key={p.key}
              className="flex items-center justify-center rounded-md border"
              style={{
                width: 22,
                height: 22,
                fontSize: 11,
                fontVariantNumeric: 'tabular-nums',
                borderColor: TOKEN.border,
                color: active ? TOKEN.text : TOKEN.muted,
                background: active ? 'rgba(255,255,255,0.03)' : 'transparent',
              }}
              title={`${p.label}: ${n}`}
            >
              {n}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Event card ----------

function EventCard({
  event,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  event: TreatmentEvent
  onOpen: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const ai = event.autoExtractedFromCall
  const declined = event.status === 'client_declined'
  const date = event.completedDate ?? event.scheduledDate

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', event.id)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className="cursor-pointer rounded-md border flex flex-col justify-between p-2.5 transition-colors hover:bg-white/[0.02]"
      style={{
        height: 96,
        background: ai ? TOKEN.aiTint : TOKEN.surface,
        borderColor: TOKEN.border,
        borderLeft: ai ? `2px solid ${TOKEN.accent}` : `1px solid ${TOKEN.border}`,
        opacity: declined ? 0.55 : 1,
        fontFamily: 'inherit',
      }}
    >
      {/* Top row: modality + status */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="uppercase truncate"
          style={{
            color: TOKEN.muted,
            fontSize: 11,
            letterSpacing: '0.08em',
            textDecoration: declined ? 'line-through' : 'none',
          }}
        >
          {MODALITY_LABEL[event.modality]}
        </div>
        <span
          className={
            'inline-flex items-center rounded px-1.5 h-4 border shrink-0 ' +
            statusPillClass(event.status)
          }
          style={{ fontSize: 10, letterSpacing: '0.02em' }}
        >
          {STATUS_LABEL[event.status]}
        </span>
      </div>

      {/* Middle: provider + date */}
      <div className="min-w-0">
        <div className="truncate" style={{ fontSize: 13 }}>
          {event.providerName || (
            <span style={{ color: TOKEN.muted }}>Provider TBD</span>
          )}
        </div>
        <div
          className="truncate"
          style={{
            color: TOKEN.muted,
            fontSize: 11,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          }}
        >
          {formatShortDate(date) || '—'}
        </div>
      </div>

      {/* Bottom: outcome / decline / pending */}
      <div className="flex items-center justify-between gap-2">
        {declined ? (
          <span
            className="inline-flex items-center rounded px-1.5 h-4 border"
            style={{
              fontSize: 10,
              background: 'rgba(244, 63, 94, 0.08)',
              borderColor: 'rgba(244, 63, 94, 0.2)',
              color: 'rgb(253, 164, 175)',
            }}
          >
            Declined{event.declineReason ? ` · ${DECLINE_LABEL[event.declineReason]}` : ''}
          </span>
        ) : event.outcome ? (
          <span
            className={
              'inline-flex items-center rounded px-1.5 h-4 border ' +
              outcomeBadgeClass(event.outcome)
            }
            style={{ fontSize: 10 }}
          >
            {OUTCOME_LABEL[event.outcome]}
          </span>
        ) : (
          <span style={{ color: TOKEN.muted, fontSize: 11 }}>Pending</span>
        )}

        {ai && (
          <span
            className="inline-flex items-center gap-1"
            style={{ color: TOKEN.accent, fontSize: 10 }}
            title="Auto-extracted from call"
          >
            <span
              className="inline-block w-1 h-1 rounded-full"
              style={{ background: TOKEN.accent }}
            />
            AI
          </span>
        )}
      </div>
    </div>
  )
}
