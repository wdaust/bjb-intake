import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  Stethoscope,
  Syringe,
  XCircle,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  DEMO_INJURIES,
  DEMO_EVENTS,
} from '@/components/treatment/TreatmentKanban'
import {
  MODALITY_LABEL,
  STATUS_LABEL,
  type EventStatus,
  type Injury,
  type Modality,
  type TreatmentEvent,
} from '@/lib/treatmentUtils'

// Demo: case → client name mapping. Real version reads from `sf_matters`.
const CASE_CLIENT_MAP: Record<string, { caseId: string; client: string }> = {
  'case-maria-santos': { caseId: 'CASE-MARIA-SANTOS', client: 'Maria Santos' },
}

interface PendingItem {
  event: TreatmentEvent
  injury: Injury
  caseId: string
  clientName: string
}

type Bucket = {
  key: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  match: (e: TreatmentEvent) => boolean
  tone: string
}

const BUCKETS: Bucket[] = [
  {
    key: 'mri_scheduled',
    label: 'MRI · Scheduled',
    description: 'Awaiting completion or read',
    icon: CalendarIcon,
    match: (e) => e.modality === 'mri' && e.status === 'scheduled',
    tone: 'border-sky-700/40 bg-sky-900/10',
  },
  {
    key: 'mri_pending',
    label: 'MRI · Pending order',
    description: 'Recommended, not yet scheduled',
    icon: ClipboardList,
    match: (e) => e.modality === 'mri' && e.status === 'recommended',
    tone: 'border-amber-700/40 bg-amber-900/10',
  },
  {
    key: 'injection',
    label: 'Injections',
    description: 'Scheduled or recommended pain mgmt',
    icon: Syringe,
    match: (e) =>
      (e.modality === 'injection' || e.modality === 'pain_mgmt_consult') &&
      (e.status === 'scheduled' || e.status === 'recommended'),
    tone: 'border-violet-700/40 bg-violet-900/10',
  },
  {
    key: 'surgery',
    label: 'Surgery / Surgical Consult',
    description: 'Scheduled or recommended',
    icon: Stethoscope,
    match: (e) =>
      (e.modality === 'surgery' ||
        e.modality === 'surgery_consult' ||
        e.modality === 'ortho_consult' ||
        e.modality === 'neuro_consult') &&
      (e.status === 'scheduled' || e.status === 'recommended'),
    tone: 'border-emerald-700/40 bg-emerald-900/10',
  },
  {
    key: 'client_declined',
    label: 'Client-declined',
    description: 'Prescribed but client refused',
    icon: XCircle,
    match: (e) => e.status === 'client_declined',
    tone: 'border-red-700/40 bg-red-900/10',
  },
  {
    key: 'no_show',
    label: 'No-show / Cancelled',
    description: 'Needs reschedule outreach',
    icon: AlertTriangle,
    match: (e) => e.status === 'no_show' || e.status === 'cancelled',
    tone: 'border-amber-700/40 bg-amber-900/10',
  },
]

export default function PendingTreatments() {
  const items: PendingItem[] = useMemo(() => {
    const injuriesById = new Map(DEMO_INJURIES.map((i) => [i.id, i]))
    return DEMO_EVENTS.map((e) => {
      const injury = injuriesById.get(e.injuryId)
      if (!injury) return null
      const cm = CASE_CLIENT_MAP[injury.caseId]
      return {
        event: e,
        injury,
        caseId: cm?.caseId ?? injury.caseId,
        clientName: cm?.client ?? injury.caseId,
      }
    }).filter((x): x is PendingItem => x !== null)
  }, [])

  const grouped = useMemo(() => {
    return BUCKETS.map((b) => ({
      bucket: b,
      items: items.filter((i) => b.match(i.event)),
    }))
  }, [items])

  const total = grouped.reduce((sum, g) => sum + g.items.length, 0)

  const [activeKey, setActiveKey] = useState<string>(BUCKETS[0]?.key ?? '')
  const active = grouped.find((g) => g.bucket.key === activeKey) ?? grouped[0]

  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight">
              Pending Treatments
            </h1>
            <p className="text-[12px] text-muted-foreground">
              Cross-case scheduling board — surface anything that needs
              follow-up so a CM can act on it today.
            </p>
          </div>
          <span className="inline-flex h-6 items-center rounded-full border border-border bg-card px-2 text-[11px] text-muted-foreground">
            {total} open items
          </span>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[260px_minmax(0,1fr)] gap-0">
        {/* Bucket sidebar */}
        <aside className="border-r border-border bg-card/40 p-3">
          <ul className="space-y-1">
            {grouped.map(({ bucket, items: list }) => {
              const Icon = bucket.icon
              const isActive = bucket.key === active?.bucket.key
              return (
                <li key={bucket.key}>
                  <button
                    type="button"
                    onClick={() => setActiveKey(bucket.key)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors',
                      isActive
                        ? 'border-ring/40 bg-ring/10 text-foreground'
                        : 'border-transparent text-muted-foreground hover:bg-card hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium">
                        {bucket.label}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {bucket.description}
                      </div>
                    </span>
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded bg-card px-1.5 font-mono text-[10px] text-muted-foreground">
                      {list.length}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Items pane */}
        <section className="flex-1 p-4">
          {active && active.items.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border text-[13px] text-muted-foreground">
              <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" />
              No items in this bucket — everything is scheduled or completed.
            </div>
          ) : (
            <ul className="space-y-2">
              {active?.items.map(({ event, injury, caseId, clientName }) => (
                <PendingCard
                  key={event.id}
                  event={event}
                  injury={injury}
                  caseId={caseId}
                  clientName={clientName}
                  bucketTone={active.bucket.tone}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

interface PendingCardProps {
  event: TreatmentEvent
  injury: Injury
  caseId: string
  clientName: string
  bucketTone: string
}

function PendingCard({
  event,
  injury,
  caseId,
  clientName,
  bucketTone,
}: PendingCardProps) {
  const dateLabel = humanizeDate(event.scheduledDate)
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-md border px-3 py-2.5',
        bucketTone,
      )}
    >
      <Modicon modality={event.modality} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[13px] font-medium text-foreground">
            {clientName}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {caseId}
          </span>
          <span className="text-[11px] text-muted-foreground">
            · {bodyRegionLabel(injury.bodyRegion)}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
          <span className="text-foreground">{event.name ?? MODALITY_LABEL[event.modality]}</span>
          <StatusPill status={event.status} />
          {event.providerName && (
            <span className="text-muted-foreground">· {event.providerName}</span>
          )}
          {dateLabel && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {dateLabel}
            </span>
          )}
        </div>
        {event.outcomeNotes && (
          <div className="mt-0.5 text-[11px] text-amber-300">{event.outcomeNotes}</div>
        )}
      </div>
      <Link
        to={`/case-demo/${caseId}`}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        Open case
        <ExternalLink className="h-3 w-3" />
      </Link>
    </li>
  )
}

function StatusPill({ status }: { status: EventStatus }) {
  const tone = statusTone(status)
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full border px-1.5 text-[10px] font-medium',
        tone,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function statusTone(s: EventStatus): string {
  switch (s) {
    case 'scheduled':
      return 'border-sky-700/40 bg-sky-900/30 text-sky-300'
    case 'recommended':
      return 'border-amber-700/40 bg-amber-900/30 text-amber-300'
    case 'in_progress':
      return 'border-emerald-700/40 bg-emerald-900/30 text-emerald-300'
    case 'completed':
      return 'border-border bg-card text-muted-foreground'
    case 'client_declined':
    case 'provider_declined':
      return 'border-red-700/40 bg-red-900/30 text-red-300'
    case 'no_show':
    case 'cancelled':
      return 'border-amber-700/40 bg-amber-900/30 text-amber-300'
    default:
      return 'border-border bg-card text-muted-foreground'
  }
}

function Modicon({ modality }: { modality: Modality }) {
  const Icon =
    modality === 'mri' || modality === 'xray' || modality === 'ct'
      ? CalendarIcon
      : modality === 'injection' || modality === 'pain_mgmt_consult'
      ? Syringe
      : modality.startsWith('surgery') ||
        modality === 'ortho_consult' ||
        modality === 'neuro_consult'
      ? Stethoscope
      : ClipboardList
  return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
}

function humanizeDate(d: string | undefined): string | null {
  if (!d) return null
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  const today = new Date()
  const diffDays = Math.round(
    (date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  )
  const fmt = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  if (diffDays === 0) return `${fmt} (today)`
  if (diffDays === 1) return `${fmt} (tomorrow)`
  if (diffDays > 0 && diffDays <= 7) return `${fmt} (in ${diffDays}d)`
  if (diffDays < 0 && diffDays >= -7) return `${fmt} (${Math.abs(diffDays)}d ago)`
  return fmt
}

function bodyRegionLabel(r: string): string {
  return r.replace(/_/g, ' ')
}
