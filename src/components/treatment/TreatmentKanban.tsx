import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable as useDndKitDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Check,
  Clock,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import {
  type Injury,
  type TreatmentEvent,
  type Phase,
  type EventStatus,
  type Modality,
  PHASES,
  MODALITY_LABEL,
  BODY_REGION_LABEL,
  severityPillClass,
  phaseForModality,
} from '@/lib/treatmentUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

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

// ---------- Constants ----------

const COMMON_EVENTS = [
  'MRI Lumbar',
  'MRI Cervical',
  'PT Eval',
  'PT Session',
  'Pain Mgmt Consult',
  'Orthopedic Consult',
  'Neurology Consult',
  'Discogram',
  'Epidural Steroid Injection',
  'Facet Joint Injection',
  'Trigger Point Injection',
  'EMG/NCS',
  'Surgical Consult',
  'MMI Evaluation',
  'Chiropractic',
  'Massage Therapy',
  'Acupuncture',
] as const

// ---------- AI suggestions ----------

type InjuryHint = 'lumbar' | 'cervical'

type AiSuggestion = {
  name: string
  provider?: string
  metadata: string
  stageHint: Phase
  injuryHint?: InjuryHint
  confidence: number
  modality: Modality
}

const AI_SUGGESTIONS: AiSuggestion[] = [
  {
    name: 'MRI Lumbar',
    provider: 'Open MRI Hollywood',
    metadata:
      'Last used for 4 similar Maria-profile cases · typical 2-3 day scheduling · covered under PIP',
    stageHint: 'imaging',
    injuryHint: 'lumbar',
    confidence: 95,
    modality: 'mri',
  },
  {
    name: 'MRI Cervical',
    provider: 'Open MRI Hollywood',
    metadata:
      'Used for 3 Bergen-County MVA intakes this month · same turnaround · covered under PIP',
    stageHint: 'imaging',
    injuryHint: 'cervical',
    confidence: 92,
    modality: 'mri',
  },
  {
    name: 'PT Eval',
    provider: 'Hackensack PT (River Rd)',
    metadata:
      "Jess's preferred PT provider · 12 bookings this month · 30 min new-patient slots · in-network GEICO",
    stageHint: 'conservative',
    confidence: 94,
    modality: 'pt',
  },
  {
    name: 'PT Session (6-week block)',
    provider: 'Hackensack PT',
    metadata:
      'Standard 3x/week protocol · avg 92% adherence for this provider',
    stageHint: 'conservative',
    confidence: 88,
    modality: 'pt',
  },
  {
    name: 'Pain Mgmt Consult',
    provider: 'Dr. Kapoor (Englewood)',
    metadata:
      'Typical next step after 4-6 weeks of PT with incomplete relief · covered under PIP',
    stageHint: 'pain_mgmt',
    confidence: 86,
    modality: 'pain_mgmt_consult',
  },
  {
    name: 'Orthopedic Consult',
    provider: 'Dr. Ng (Teaneck Ortho)',
    metadata:
      '12-day average to first appt · Kelly booked 3 similar cases this week · covered under PIP',
    stageHint: 'conservative',
    confidence: 83,
    modality: 'ortho_consult',
  },
  {
    name: 'Epidural Steroid Injection',
    provider: 'Dr. Kapoor',
    metadata:
      'Typical if MRI confirms L4/L5 impingement · pre-auth window ~7 days with GEICO PIP',
    stageHint: 'pain_mgmt',
    confidence: 78,
    modality: 'injection',
  },
  {
    name: 'Discogram',
    provider: 'NJ Spine Center',
    metadata:
      'Uncommon first-line; reserve for failed conservative + injections',
    stageHint: 'pain_mgmt',
    confidence: 60,
    modality: 'injection',
  },
  {
    name: 'EMG/NCS',
    provider: 'Dr. Pham (Neurology)',
    metadata:
      'Indicated for radicular leg pain; typical scheduling 5-7 days',
    stageHint: 'imaging',
    confidence: 82,
    modality: 'other',
  },
  {
    name: 'Surgical Consult',
    provider: 'Dr. Boachie (HSS affiliate)',
    metadata:
      'Reserve for cases with clear surgical indication on MRI',
    stageHint: 'surgical',
    confidence: 55,
    modality: 'surgery_consult',
  },
  {
    name: 'MMI Evaluation',
    provider: 'any treating provider',
    metadata:
      'Triggered 6-9 months post-injury once treatment plateaus',
    stageHint: 'mmi',
    confidence: 70,
    modality: 'other',
  },
]

function matchSuggestions(query: string): AiSuggestion[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return AI_SUGGESTIONS.filter((s) =>
    s.name.toLowerCase().includes(q) ||
    (s.provider ?? '').toLowerCase().includes(q)
  ).slice(0, 5)
}

// ---------- AI suggestion dropdown ----------

interface AiSuggestionListProps {
  query: string
  onPick: (s: AiSuggestion) => void
  /** Controlled active index for keyboard nav. */
  activeIndex: number
  onActiveIndexChange: (i: number) => void
  className?: string
}

function AiSuggestionList({
  query,
  onPick,
  activeIndex,
  onActiveIndexChange,
  className,
}: AiSuggestionListProps) {
  const matches = matchSuggestions(query)
  const empty = matches.length === 0

  return (
    <div
      role="listbox"
      className={cn(
        'absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-popover py-2 shadow-md',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        className
      )}
      data-state="open"
      onMouseDown={(e) => {
        // keep input focused while clicking rows
        e.preventDefault()
      }}
    >
      {empty ? (
        <div className="px-3 py-1.5 text-[11px] text-muted-foreground">
          Type to see AI-suggested providers and protocols based on similar
          cases.
        </div>
      ) : (
        matches.map((s, i) => {
          const active = i === activeIndex
          return (
            <button
              key={`${s.name}-${s.provider ?? 'none'}`}
              type="button"
              role="option"
              aria-selected={active}
              onMouseEnter={() => onActiveIndexChange(i)}
              onClick={() => onPick(s)}
              className={cn(
                'flex w-full items-start gap-2 px-3 py-2 text-left transition-colors',
                active && 'bg-accent/50'
              )}
            >
              <Sparkles className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[color:var(--ring)]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-[13px] font-medium text-foreground">
                    {s.name}
                    {s.provider && (
                      <span className="text-muted-foreground">
                        {' '}
                        @ {s.provider}
                      </span>
                    )}
                  </div>
                  <span className="inline-flex h-5 shrink-0 items-center rounded bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums">
                    {s.confidence}%
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {s.metadata}
                </div>
              </div>
            </button>
          )
        })
      )}
    </div>
  )
}

/** Shared keydown handler for the name input to drive the dropdown. */
function useSuggestionNav(
  query: string,
  onAccept: (s: AiSuggestion) => void
): {
  open: boolean
  setOpen: (v: boolean) => void
  activeIndex: number
  setActiveIndex: (i: number) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => boolean
} {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const matches = matchSuggestions(query)

  // clamp activeIndex as matches change
  useEffect(() => {
    if (activeIndex >= matches.length) setActiveIndex(0)
  }, [matches.length, activeIndex])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): boolean => {
    if (!open || matches.length === 0) return false
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((activeIndex + 1) % matches.length)
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((activeIndex - 1 + matches.length) % matches.length)
      return true
    }
    if (e.key === 'Enter') {
      const picked = matches[activeIndex]
      if (picked) {
        e.preventDefault()
        onAccept(picked)
        return true
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      return true
    }
    return false
  }

  return { open, setOpen, activeIndex, setActiveIndex, onKeyDown }
}

const COMMON_EVENT_TO_MODALITY: Record<string, { modality: Modality; stage: Phase }> = {
  'MRI Lumbar': { modality: 'mri', stage: 'imaging' },
  'MRI Cervical': { modality: 'mri', stage: 'imaging' },
  'PT Eval': { modality: 'pt', stage: 'conservative' },
  'PT Session': { modality: 'pt', stage: 'conservative' },
  'Pain Mgmt Consult': { modality: 'pain_mgmt_consult', stage: 'pain_mgmt' },
  'Orthopedic Consult': { modality: 'ortho_consult', stage: 'surgical' },
  'Neurology Consult': { modality: 'neuro_consult', stage: 'surgical' },
  Discogram: { modality: 'injection', stage: 'pain_mgmt' },
  'Epidural Steroid Injection': { modality: 'injection', stage: 'pain_mgmt' },
  'Facet Joint Injection': { modality: 'injection', stage: 'pain_mgmt' },
  'Trigger Point Injection': { modality: 'injection', stage: 'pain_mgmt' },
  'EMG/NCS': { modality: 'other', stage: 'imaging' },
  'Surgical Consult': { modality: 'surgery_consult', stage: 'surgical' },
  'MMI Evaluation': { modality: 'other', stage: 'mmi' },
  Chiropractic: { modality: 'chiro', stage: 'conservative' },
  'Massage Therapy': { modality: 'massage', stage: 'conservative' },
  Acupuncture: { modality: 'other', stage: 'conservative' },
}

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'client_declined', label: 'Client Declined' },
  { value: 'provider_declined', label: 'Provider Declined' },
  { value: 'no_show', label: 'No Show' },
  { value: 'cancelled', label: 'Cancelled' },
]

// ---------- Helpers ----------

function genId(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `evt-${rand}`
}

function eventStage(e: TreatmentEvent): Phase {
  return e.stage ?? phaseForModality(e.modality)
}

function eventDisplayName(e: TreatmentEvent): string {
  return e.name ?? MODALITY_LABEL[e.modality]
}

function eventProvider(e: TreatmentEvent): string | undefined {
  return e.provider ?? e.providerName
}

function formatShort(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatLong(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isoFromDate(d: Date): string {
  // local-date ISO (YYYY-MM-DD)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ---------- Status badge ----------

function StatusBadge({ status }: { status: EventStatus }) {
  const config: {
    dot: string
    bg: string
    Icon: React.ComponentType<{ className?: string }>
    label: string
    strike?: boolean
  } = (() => {
    switch (status) {
      case 'scheduled':
        return {
          dot: 'bg-zinc-400',
          bg: 'bg-transparent',
          Icon: CalendarIcon,
          label: 'Scheduled',
        }
      case 'recommended':
      case 'in_progress':
        return {
          dot: 'bg-amber-400',
          bg: 'bg-amber-400/10',
          Icon: Clock,
          label: status === 'recommended' ? 'Pending' : 'In Progress',
        }
      case 'completed':
        return {
          dot: 'bg-emerald-400',
          bg: 'bg-emerald-400/10',
          Icon: Check,
          label: 'Completed',
        }
      case 'no_show':
        return {
          dot: 'bg-red-500',
          bg: 'bg-red-500/10',
          Icon: AlertTriangle,
          label: 'No Show',
        }
      case 'cancelled':
        return {
          dot: 'bg-zinc-500',
          bg: 'bg-transparent',
          Icon: X,
          label: 'Cancelled',
          strike: true,
        }
      case 'client_declined':
      case 'provider_declined':
        return {
          dot: 'bg-red-500',
          bg: 'bg-red-500/10',
          Icon: X,
          label: status === 'client_declined' ? 'Declined' : 'Provider Declined',
        }
    }
  })()

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 h-[18px] border border-border text-[10px] text-foreground',
        config.bg,
        config.strike && 'line-through text-muted-foreground'
      )}
    >
      <span className={cn('inline-block h-1 w-1 rounded-full', config.dot)} />
      <config.Icon className="h-2.5 w-2.5" />
      {config.label}
    </span>
  )
}

// ---------- Sortable card ----------

interface SortableCardProps {
  event: TreatmentEvent
  onOpen: () => void
  dragging?: boolean
}

function SortableCard({ event, onOpen, dragging }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: event.id, data: { event } })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Only treat as click if the pointer didn't move (dnd-kit already gates drag at 5px).
        if (!isDragging) {
          e.stopPropagation()
          onOpen()
        }
      }}
    >
      <CardFace event={event} floating={dragging} />
    </div>
  )
}

function CardFace({
  event,
  floating,
}: {
  event: TreatmentEvent
  floating?: boolean
}) {
  const callExtracted = event.autoExtractedFromCall
  const aiSuggested = event.aiSuggested
  const provider = eventProvider(event)
  const date = event.completedDate ?? event.scheduledDate
  return (
    <div
      className={cn(
        'cursor-grab active:cursor-grabbing select-none rounded-md border bg-card p-3 transition-[transform,border-color] hover:border-ring/40',
        floating && 'scale-[1.02] border-ring shadow-md'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-foreground">
            {eventDisplayName(event)}
          </div>
          {provider ? (
            <div className="truncate text-[12px] text-muted-foreground">
              {provider}
            </div>
          ) : (
            <div className="truncate text-[12px] text-muted-foreground">
              Provider TBD
            </div>
          )}
        </div>
        {callExtracted && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-emerald-400">
                    <Sparkles className="h-3 w-3" />
                  </span>
                }
              />
              <TooltipContent>
                Auto-extracted from CM Intro Call, Apr 24 (95% confidence)
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {!callExtracted && aiSuggested && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-teal-400">
                    <Sparkles className="h-3 w-3" />
                  </span>
                }
              />
              <TooltipContent>
                Added from AI suggestion
                {typeof event.aiSuggestionConfidence === 'number'
                  ? ` · ${event.aiSuggestionConfidence}% confidence`
                  : ''}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <StatusBadge status={event.status} />
        {date && (
          <span className="text-[11px] text-muted-foreground tabular-nums font-mono">
            {formatShort(date)}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------- Column ----------

interface ColumnProps {
  phase: Phase
  injuryId: string
  events: TreatmentEvent[]
  columnId: string
  onOpenEvent: (id: string) => void
  onInlineAdd: (values: NewEventInline) => void
}

interface NewEventInline {
  name: string
  stage: Phase
  injuryId: string
  scheduledDate?: string
  provider?: string
  notes?: string
  aiSuggested?: boolean
  aiSuggestionConfidence?: number
  modality?: Modality
}

function Column({
  phase,
  injuryId,
  events,
  columnId,
  onOpenEvent,
  onInlineAdd,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable(columnId)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [provider, setProvider] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState<Date | undefined>()
  const [suggestionMeta, setSuggestionMeta] = useState<
    { confidence: number; modality: Modality } | null
  >(null)

  const reset = () => {
    setName('')
    setProvider('')
    setNotes('')
    setDate(undefined)
    setSuggestionMeta(null)
    setAdding(false)
  }

  const acceptSuggestion = (s: AiSuggestion) => {
    setName(s.name)
    if (s.provider) setProvider(s.provider)
    setSuggestionMeta({ confidence: s.confidence, modality: s.modality })
    nav.setOpen(false)
  }

  const commit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      reset()
      return
    }
    onInlineAdd({
      name: trimmed,
      stage: phase,
      injuryId,
      scheduledDate: date ? isoFromDate(date) : undefined,
      provider: provider.trim() || undefined,
      notes: notes.trim() || undefined,
      ...(suggestionMeta
        ? {
            aiSuggested: true,
            aiSuggestionConfidence: suggestionMeta.confidence,
            modality: suggestionMeta.modality,
          }
        : {}),
    })
    reset()
  }

  const nav = useSuggestionNav(name, (s) => acceptSuggestion(s))

  const ids = events.map((e) => e.id)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col gap-2 p-2 rounded-md min-h-[140px] border border-dashed border-transparent transition-colors',
        isOver && 'border-ring bg-ring/5'
      )}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {events.length === 0 && !adding ? (
          <div className="flex h-full min-h-[80px] items-center justify-center text-[11px] text-muted-foreground">
            —
          </div>
        ) : (
          events.map((e) => (
            <SortableCard
              key={e.id}
              event={e}
              onOpen={() => onOpenEvent(e.id)}
            />
          ))
        )}
      </SortableContext>

      {adding ? (
        <div className="rounded-md border border-border bg-card p-2.5 flex flex-col gap-2">
          <div className="relative">
            <Input
              autoFocus
              placeholder="Event name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSuggestionMeta(null)
                nav.setOpen(true)
              }}
              onFocus={() => nav.setOpen(true)}
              onBlur={() =>
                // Defer so click handlers on suggestion rows can fire first.
                setTimeout(() => nav.setOpen(false), 120)
              }
              onKeyDown={(e) => {
                if (nav.onKeyDown(e)) return
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commit()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  reset()
                }
              }}
              className="h-8 text-[13px]"
            />
            {nav.open && (
              <AiSuggestionList
                query={name}
                onPick={acceptSuggestion}
                activeIndex={nav.activeIndex}
                onActiveIndexChange={nav.setActiveIndex}
              />
            )}
          </div>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1 justify-start font-normal"
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span className="text-[12px]">
                      {date ? formatShort(isoFromDate(date)) : 'Date'}
                    </span>
                  </Button>
                }
              />
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                />
              </PopoverContent>
            </Popover>
          </div>
          <Input
            placeholder="Provider (optional)"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') reset()
            }}
            className="h-8 text-[13px]"
          />
          <Textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="min-h-[48px] text-[12px]"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={reset}>
              Cancel
            </Button>
            <Button size="sm" onClick={commit}>
              Add
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-dashed border-border text-[11px] text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      )}
    </div>
  )
}

// ---------- Minimal droppable helper (dnd-kit) ----------
// Wraps @dnd-kit's useDroppable so empty columns can still accept drops.
function useDroppable(id: string) {
  const { setNodeRef, isOver } = useDndKitDroppable({ id, data: { column: id } })
  return { setNodeRef, isOver }
}

// ---------- Sheet editor ----------

interface EditorProps {
  open: boolean
  event: TreatmentEvent | null
  injuries: Injury[]
  onClose: () => void
  onSave: (patch: Partial<TreatmentEvent>) => void
  onDelete: () => void
  onJumpTimestamp?: (eventId: string) => void
}

function EventSheet({
  open,
  event,
  injuries,
  onClose,
  onSave,
  onDelete,
  onJumpTimestamp,
}: EditorProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      {event && (
        <EventSheetBody
          key={event.id}
          event={event}
          injuries={injuries}
          onClose={onClose}
          onSave={onSave}
          onDelete={onDelete}
          onJumpTimestamp={onJumpTimestamp}
        />
      )}
    </Sheet>
  )
}

function EventSheetBody({
  event,
  injuries,
  onClose,
  onSave,
  onDelete,
  onJumpTimestamp,
}: {
  event: TreatmentEvent
  injuries: Injury[]
  onClose: () => void
  onSave: (patch: Partial<TreatmentEvent>) => void
  onDelete: () => void
  onJumpTimestamp?: (id: string) => void
}) {
  const [draft, setDraft] = useState<TreatmentEvent>(event)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const patch = (partial: Partial<TreatmentEvent>) =>
    setDraft((d) => ({ ...d, ...partial }))

  const commit = () => {
    if (!draft) return
    const changed: Partial<TreatmentEvent> = {
      name: draft.name,
      injuryId: draft.injuryId,
      stage: draft.stage,
      scheduledDate: draft.scheduledDate,
      provider: draft.provider,
      providerName: draft.provider ?? draft.providerName,
      notes: draft.notes,
      status: draft.status,
      urgency: draft.urgency,
    }
    onSave(changed)
    onClose()
  }

  const date = draft.scheduledDate ? new Date(draft.scheduledDate) : undefined

  return (
    <SheetContent
      side="right"
      className="w-[420px] sm:max-w-[420px] flex flex-col bg-card"
    >
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-border">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Edit event
            </div>
            <div className="mt-0.5 text-[15px] font-semibold truncate">
              {eventDisplayName(draft)}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {draft.autoExtractedFromCall && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-ring/30 bg-ring/5 px-2.5 py-2 text-[12px]">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-3.5 w-3.5 text-[color:var(--ring)] shrink-0" />
                <span className="truncate text-muted-foreground">
                  Auto-extracted from CM Intro Call · Apr 24 · 95% confidence
                </span>
              </div>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  onJumpTimestamp?.(draft.id)
                  console.log('Jump to timestamp for event', draft.id)
                }}
              >
                Jump
              </Button>
            </div>
          )}

          <Field label="Event name">
            <Input
              value={draft.name ?? MODALITY_LABEL[draft.modality]}
              onChange={(e) => patch({ name: e.target.value })}
              list="editor-event-names"
              className="h-8 text-[13px]"
            />
            <datalist id="editor-event-names">
              {COMMON_EVENTS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>

          <Field label="Injury">
            <NativeSelect
              value={draft.injuryId}
              onChange={(v) => patch({ injuryId: v })}
              options={injuries.map((i) => ({
                value: i.id,
                label: BODY_REGION_LABEL[i.bodyRegion],
              }))}
            />
          </Field>

          <Field label="Stage">
            <NativeSelect
              value={eventStage(draft)}
              onChange={(v) => patch({ stage: v as Phase })}
              options={PHASES.map((p) => ({ value: p.key, label: p.label }))}
            />
          </Field>

          <Field label="Scheduled">
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-full justify-start font-normal"
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span className="text-[12px]">
                      {draft.scheduledDate
                        ? formatLong(draft.scheduledDate)
                        : 'Pick a date'}
                    </span>
                  </Button>
                }
              />
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) =>
                    patch({
                      scheduledDate: d ? isoFromDate(d) : undefined,
                    })
                  }
                />
              </PopoverContent>
            </Popover>
          </Field>

          <Field label="Provider">
            <Input
              value={draft.provider ?? draft.providerName ?? ''}
              onChange={(e) => patch({ provider: e.target.value })}
              className="h-8 text-[13px]"
            />
          </Field>

          <Field label="Notes">
            <Textarea
              value={draft.notes ?? draft.outcomeNotes ?? ''}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={3}
              className="text-[12px]"
            />
          </Field>

          <Field label="Status">
            <NativeSelect
              value={draft.status}
              onChange={(v) => patch({ status: v as EventStatus })}
              options={STATUS_OPTIONS.map((s) => ({
                value: s.value,
                label: s.label,
              }))}
            />
          </Field>

          <label className="flex items-center gap-2 text-[13px]">
            <Checkbox
              checked={draft.urgency ?? false}
              onCheckedChange={(v) => patch({ urgency: Boolean(v) })}
            />
            Urgent
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={commit}>
              Save
            </Button>
          </div>
        </div>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete event?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove "{eventDisplayName(draft)}" from the case. This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  setConfirmDelete(false)
                  onDelete()
                  onClose()
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </SheetContent>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  )
}

function NativeSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-[13px] outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// ---------- Global add dialog ----------

interface AddDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  injuries: Injury[]
  onAdd: (event: TreatmentEvent) => void
}

function AddEventDialog({ open, onOpenChange, injuries, onAdd }: AddDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <AddEventDialogBody
          injuries={injuries}
          onCancel={() => onOpenChange(false)}
          onSubmit={(evt) => {
            onAdd(evt)
            onOpenChange(false)
          }}
        />
      )}
    </Dialog>
  )
}

function AddEventDialogBody({
  injuries,
  onCancel,
  onSubmit,
}: {
  injuries: Injury[]
  onCancel: () => void
  onSubmit: (e: TreatmentEvent) => void
}) {
  const firstInjury = injuries[0]?.id ?? ''
  const [name, setName] = useState('')
  const [injuryId, setInjuryId] = useState(firstInjury)
  const [stageManual, setStageManual] = useState<Phase | null>(null)
  const [status, setStatus] = useState<EventStatus>('recommended')
  const [date, setDate] = useState<Date | undefined>()
  const [provider, setProvider] = useState('')
  const [notes, setNotes] = useState('')
  const [urgency, setUrgency] = useState(false)
  const [suggestionMeta, setSuggestionMeta] = useState<
    { confidence: number; modality: Modality } | null
  >(null)

  // Derived: if the user hasn't manually picked a stage, map from the name.
  const mapped = COMMON_EVENT_TO_MODALITY[name]
  const stage: Phase = stageManual ?? mapped?.stage ?? 'conservative'

  const acceptSuggestion = (s: AiSuggestion) => {
    setName(s.name)
    if (s.provider) setProvider(s.provider)
    setStageManual(s.stageHint)
    if (s.injuryHint) {
      const match = injuries.find(
        (inj) => inj.bodyRegion === s.injuryHint
      )
      if (match) setInjuryId(match.id)
    }
    setSuggestionMeta({ confidence: s.confidence, modality: s.modality })
    nav.setOpen(false)
  }

  const nav = useSuggestionNav(name, (s) => acceptSuggestion(s))

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed || !injuryId) return
    const resolvedMapped = COMMON_EVENT_TO_MODALITY[trimmed]
    const modality: Modality =
      suggestionMeta?.modality ?? resolvedMapped?.modality ?? 'other'
    onSubmit({
      id: genId(),
      injuryId,
      modality,
      stage,
      name: trimmed,
      status,
      scheduledDate: date ? isoFromDate(date) : undefined,
      provider: provider.trim() || undefined,
      providerName: provider.trim() || undefined,
      notes: notes.trim() || undefined,
      urgency,
      autoExtractedFromCall: false,
      ...(suggestionMeta
        ? {
            aiSuggested: true,
            aiSuggestionConfidence: suggestionMeta.confidence,
          }
        : {}),
    })
  }

  return (
    <>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add treatment event</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label="Event name">
            <div className="relative">
              <Input
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setSuggestionMeta(null)
                  nav.setOpen(true)
                }}
                onFocus={() => nav.setOpen(true)}
                onBlur={() => setTimeout(() => nav.setOpen(false), 120)}
                onKeyDown={(e) => {
                  if (nav.onKeyDown(e)) return
                }}
                placeholder="e.g. MRI Lumbar"
                className="h-8"
              />
              {nav.open && (
                <AiSuggestionList
                  query={name}
                  onPick={acceptSuggestion}
                  activeIndex={nav.activeIndex}
                  onActiveIndexChange={nav.setActiveIndex}
                />
              )}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Injury">
              <NativeSelect
                value={injuryId}
                onChange={setInjuryId}
                options={injuries.map((i) => ({
                  value: i.id,
                  label: BODY_REGION_LABEL[i.bodyRegion],
                }))}
              />
            </Field>
            <Field label="Stage">
              <NativeSelect
                value={stage}
                onChange={(v) => setStageManual(v as Phase)}
                options={PHASES.map((p) => ({
                  value: p.key,
                  label: p.label,
                }))}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <NativeSelect
                value={status}
                onChange={(v) => setStatus(v as EventStatus)}
                options={STATUS_OPTIONS.map((s) => ({
                  value: s.value,
                  label: s.label,
                }))}
              />
            </Field>
            <Field label="Scheduled">
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-full justify-start font-normal"
                    >
                      <CalendarIcon className="h-3.5 w-3.5" />
                      <span className="text-[12px]">
                        {date ? formatShort(isoFromDate(date)) : 'Pick date'}
                      </span>
                    </Button>
                  }
                />
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={setDate} />
                </PopoverContent>
              </Popover>
            </Field>
          </div>

          <Field label="Provider">
            <Input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="h-8"
            />
          </Field>

          <Field label="Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </Field>

          <label className="flex items-center gap-2 text-[13px]">
            <Checkbox
              checked={urgency}
              onCheckedChange={(v) => setUrgency(Boolean(v))}
            />
            Urgent
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit}>
            Add event
          </Button>
        </DialogFooter>
      </DialogContent>
    </>
  )
}

// ---------- Props ----------

export interface TreatmentKanbanProps {
  injuries?: Injury[]
  events?: TreatmentEvent[]
  caseId?: string
  onEventUpdate?: (e: TreatmentEvent) => void
  onJumpTimestamp?: (eventId: string) => void
}

// ---------- Main component ----------

interface PendingCrossMove {
  eventId: string
  fromInjury: string
  toInjury: string
  toStage: Phase
  toIndex: number
}

export function TreatmentKanban({
  injuries: injuriesProp,
  events: eventsProp,
  caseId,
  onEventUpdate,
  onJumpTimestamp,
}: TreatmentKanbanProps) {
  const injuries = useMemo<Injury[]>(
    () => injuriesProp ?? DEMO_INJURIES,
    [injuriesProp]
  )
  const resolvedCaseId =
    caseId ?? injuries[0]?.caseId ?? 'default'
  const storageKey = `caos:kanban:${resolvedCaseId}`

  // Hydration
  const [events, setEvents] = useState<TreatmentEvent[]>(() => {
    if (typeof window === 'undefined') return eventsProp ?? DEMO_EVENTS
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed)) {
          return parsed as TreatmentEvent[]
        }
      }
    } catch {
      /* ignore */
    }
    return eventsProp ?? DEMO_EVENTS
  })

  // Debounced persistence.
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (writeTimer.current) clearTimeout(writeTimer.current)
    writeTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(events))
      } catch {
        /* ignore */
      }
    }, 200)
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current)
    }
  }, [events, storageKey])

  // Filter state
  const [search, setSearch] = useState('')
  const [injuryFilter, setInjuryFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<EventStatus>>(new Set())
  const [hideEmpty, setHideEmpty] = useState(false)

  // Selection + dialogs
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [pendingCross, setPendingCross] = useState<PendingCrossMove | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId]
  )

  // Filtered view
  const visibleEvents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events.filter((e) => {
      if (q) {
        const hay = [
          eventDisplayName(e),
          eventProvider(e) ?? '',
          e.notes ?? '',
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (injuryFilter.size > 0 && !injuryFilter.has(e.injuryId)) return false
      if (statusFilter.size > 0 && !statusFilter.has(e.status)) return false
      return true
    })
  }, [events, search, injuryFilter, statusFilter])

  // Group: injuryId -> phase -> events (sorted by orderIndex)
  const grouped = useMemo(() => {
    const map = new Map<string, Record<Phase, TreatmentEvent[]>>()
    for (const inj of injuries) {
      map.set(inj.id, {
        conservative: [],
        imaging: [],
        pain_mgmt: [],
        surgical: [],
        mmi: [],
      })
    }
    for (const e of visibleEvents) {
      const lane = map.get(e.injuryId)
      if (!lane) continue
      lane[eventStage(e)].push(e)
    }
    for (const lane of map.values()) {
      for (const phase of Object.keys(lane) as Phase[]) {
        lane[phase].sort((a, b) => {
          const ai = a.orderIndex ?? 0
          const bi = b.orderIndex ?? 0
          return ai - bi
        })
      }
    }
    return map
  }, [injuries, visibleEvents])

  // ----- Mutations -----
  const applyUpdate = useCallback(
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

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const addEvent = useCallback((evt: TreatmentEvent) => {
    setEvents((prev) => {
      const lane = prev.filter(
        (e) => e.injuryId === evt.injuryId && eventStage(e) === eventStage(evt)
      )
      const maxOrder = lane.reduce(
        (m, e) => (e.orderIndex !== undefined ? Math.max(m, e.orderIndex) : m),
        -1
      )
      const withOrder: TreatmentEvent = {
        ...evt,
        orderIndex: maxOrder + 1,
      }
      return [...prev, withOrder]
    })
  }, [])

  const inlineAdd = useCallback(
    (v: NewEventInline) => {
      const mapped = COMMON_EVENT_TO_MODALITY[v.name]
      addEvent({
        id: genId(),
        injuryId: v.injuryId,
        modality: v.modality ?? mapped?.modality ?? 'other',
        stage: v.stage,
        name: v.name,
        status: 'recommended',
        scheduledDate: v.scheduledDate,
        provider: v.provider,
        providerName: v.provider,
        notes: v.notes,
        autoExtractedFromCall: false,
        ...(v.aiSuggested
          ? {
              aiSuggested: true,
              aiSuggestionConfidence: v.aiSuggestionConfidence,
            }
          : {}),
      })
    },
    [addEvent]
  )

  // ----- Drag logic -----

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const columnId = (injuryId: string, phase: Phase) =>
    `col:${injuryId}:${phase}`

  const parseColumnId = (
    id: string
  ): { injuryId: string; phase: Phase } | null => {
    if (!id.startsWith('col:')) return null
    const [, injuryId, phase] = id.split(':')
    if (!injuryId || !phase) return null
    return { injuryId, phase: phase as Phase }
  }

  const handleDragStart = (e: DragStartEvent) => {
    setActiveDragId(String(e.active.id))
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = e
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    const activeEvent = events.find((ev) => ev.id === activeId)
    if (!activeEvent) return

    // Resolve target (injuryId, phase, insertIndex)
    let target: { injuryId: string; phase: Phase; insertIndex: number } | null =
      null

    const overColumn = parseColumnId(overId)
    if (overColumn) {
      // Dropped on a column background -> append
      const lane = grouped.get(overColumn.injuryId)
      const list = lane ? lane[overColumn.phase] : []
      target = {
        injuryId: overColumn.injuryId,
        phase: overColumn.phase,
        insertIndex: list.length,
      }
    } else {
      // Dropped on another card -> use its column & index
      const overEvent = events.find((ev) => ev.id === overId)
      if (!overEvent) return
      const lane = grouped.get(overEvent.injuryId)
      const list = lane ? lane[eventStage(overEvent)] : []
      const idx = list.findIndex((it) => it.id === overId)
      target = {
        injuryId: overEvent.injuryId,
        phase: eventStage(overEvent),
        insertIndex: idx < 0 ? list.length : idx,
      }
    }

    if (!target) return

    if (target.injuryId !== activeEvent.injuryId) {
      // Cross-injury move requires confirmation.
      setPendingCross({
        eventId: activeEvent.id,
        fromInjury: activeEvent.injuryId,
        toInjury: target.injuryId,
        toStage: target.phase,
        toIndex: target.insertIndex,
      })
      return
    }

    // Same-injury: update stage + reorder.
    performMove({
      eventId: activeEvent.id,
      toInjury: target.injuryId,
      toStage: target.phase,
      toIndex: target.insertIndex,
    })
  }

  const performMove = useCallback(
    (m: {
      eventId: string
      toInjury: string
      toStage: Phase
      toIndex: number
    }) => {
      setEvents((prev) => {
        const active = prev.find((e) => e.id === m.eventId)
        if (!active) return prev

        // Build the new lane order.
        const destLane = prev
          .filter(
            (e) =>
              e.injuryId === m.toInjury &&
              eventStage(e) === m.toStage &&
              e.id !== m.eventId
          )
          .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))

        const inserted: TreatmentEvent = {
          ...active,
          injuryId: m.toInjury,
          stage: m.toStage,
        }
        const reordered = [
          ...destLane.slice(0, m.toIndex),
          inserted,
          ...destLane.slice(m.toIndex),
        ]

        // Rewrite orderIndex for dest lane.
        const reorderedIndex = new Map<string, number>()
        reordered.forEach((e, i) => reorderedIndex.set(e.id, i))

        return prev.map((e) => {
          if (e.id === m.eventId) {
            return {
              ...e,
              injuryId: m.toInjury,
              stage: m.toStage,
              orderIndex: reorderedIndex.get(e.id) ?? 0,
            }
          }
          const ri = reorderedIndex.get(e.id)
          if (ri !== undefined) {
            return { ...e, orderIndex: ri }
          }
          return e
        })
      })
    },
    []
  )

  // Active card for drag overlay
  const activeEvent = useMemo(
    () => (activeDragId ? events.find((e) => e.id === activeDragId) ?? null : null),
    [activeDragId, events]
  )

  const pendingCrossInjuries = pendingCross
    ? {
        from: injuries.find((i) => i.id === pendingCross.fromInjury),
        to: injuries.find((i) => i.id === pendingCross.toInjury),
        event: events.find((e) => e.id === pendingCross.eventId),
      }
    : null

  // ----- Render -----

  const uniqueStatuses = useMemo(() => {
    const s = new Set<EventStatus>()
    for (const e of events) s.add(e.status)
    return Array.from(s)
  }, [events])

  const laneList = injuries.filter((inj) => {
    if (!hideEmpty) return true
    const lane = grouped.get(inj.id)
    if (!lane) return false
    return (Object.keys(lane) as Phase[]).some((p) => lane[p].length > 0)
  })

  return (
    <div className="w-full text-foreground">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events"
            className="h-9 pl-7 w-56"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="h-9">
                Injury
                {injuryFilter.size > 0 && (
                  <span className="ml-1 rounded bg-muted px-1 text-[10px]">
                    {injuryFilter.size}
                  </span>
                )}
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Filter by injury</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {injuries.map((i) => (
              <DropdownMenuCheckboxItem
                key={i.id}
                checked={injuryFilter.has(i.id)}
                onCheckedChange={(v) => {
                  setInjuryFilter((prev) => {
                    const next = new Set(prev)
                    if (v) next.add(i.id)
                    else next.delete(i.id)
                    return next
                  })
                }}
              >
                {BODY_REGION_LABEL[i.bodyRegion]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="h-9">
                Status
                {statusFilter.size > 0 && (
                  <span className="ml-1 rounded bg-muted px-1 text-[10px]">
                    {statusFilter.size}
                  </span>
                )}
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {uniqueStatuses.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={statusFilter.has(s)}
                onCheckedChange={(v) => {
                  setStatusFilter((prev) => {
                    const next = new Set(prev)
                    if (v) next.add(s)
                    else next.delete(s)
                    return next
                  })
                }}
              >
                {STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <label className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
          <Checkbox
            checked={hideEmpty}
            onCheckedChange={(v) => setHideEmpty(Boolean(v))}
          />
          Hide empty rows
        </label>

        <div className="ml-auto">
          <Button size="sm" className="h-9" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add event
          </Button>
        </div>
      </div>

      {/* Kanban */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="px-4 pb-4 text-[13px]">
          {/* Column headers */}
          <div
            className="grid gap-3 pb-2 sticky top-0 z-10 bg-background"
            style={{
              gridTemplateColumns: `repeat(${PHASES.length}, minmax(200px, 1fr))`,
            }}
          >
            {PHASES.map((p) => {
              // total visible count in this phase
              let count = 0
              for (const lane of grouped.values()) count += lane[p.key].length
              return (
                <div
                  key={p.key}
                  className="flex items-center gap-2 px-1 text-[11px] uppercase tracking-wider text-muted-foreground"
                >
                  <span>{p.label}</span>
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-muted/40 px-1 text-[10px] text-foreground">
                    {count}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="space-y-3">
            {laneList.map((injury) => {
              const lane = grouped.get(injury.id) ?? {
                conservative: [],
                imaging: [],
                pain_mgmt: [],
                surgical: [],
                mmi: [],
              }
              return (
                <div
                  key={injury.id}
                  className="rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] font-semibold truncate">
                        {BODY_REGION_LABEL[injury.bodyRegion]}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center rounded px-2 h-5 border text-[11px] capitalize',
                          severityPillClass(injury.severity)
                        )}
                      >
                        {injury.severity}
                      </span>
                    </div>
                    {injury.nextAction && (
                      <div className="text-[11px] text-muted-foreground truncate max-w-[280px]">
                        Next: {injury.nextAction}
                      </div>
                    )}
                  </div>

                  <div
                    className="grid gap-3 p-2"
                    style={{
                      gridTemplateColumns: `repeat(${PHASES.length}, minmax(200px, 1fr))`,
                    }}
                  >
                    {PHASES.map((p) => (
                      <Column
                        key={p.key}
                        phase={p.key}
                        injuryId={injury.id}
                        events={lane[p.key]}
                        columnId={columnId(injury.id, p.key)}
                        onOpenEvent={setSelectedId}
                        onInlineAdd={inlineAdd}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <DragOverlay>
          {activeEvent ? <CardFace event={activeEvent} floating /> : null}
        </DragOverlay>
      </DndContext>

      {/* Cross-injury confirmation */}
      <AlertDialog
        open={!!pendingCross}
        onOpenChange={(v) => !v && setPendingCross(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move event across injuries?</AlertDialogTitle>
            <AlertDialogDescription>
              Move "
              {pendingCrossInjuries?.event
                ? eventDisplayName(pendingCrossInjuries.event)
                : ''}
              " from{' '}
              {pendingCrossInjuries?.from
                ? BODY_REGION_LABEL[pendingCrossInjuries.from.bodyRegion]
                : '—'}{' '}
              to{' '}
              {pendingCrossInjuries?.to
                ? BODY_REGION_LABEL[pendingCrossInjuries.to.bodyRegion]
                : '—'}
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingCross(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingCross) {
                  performMove({
                    eventId: pendingCross.eventId,
                    toInjury: pendingCross.toInjury,
                    toStage: pendingCross.toStage,
                    toIndex: pendingCross.toIndex,
                  })
                }
                setPendingCross(null)
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Side sheet editor */}
      <EventSheet
        open={!!selectedEvent}
        event={selectedEvent}
        injuries={injuries}
        onClose={() => setSelectedId(null)}
        onSave={(patch) => {
          if (!selectedEvent) return
          applyUpdate(selectedEvent.id, patch)
        }}
        onDelete={() => {
          if (!selectedEvent) return
          deleteEvent(selectedEvent.id)
        }}
        onJumpTimestamp={onJumpTimestamp}
      />

      {/* Global add */}
      <AddEventDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        injuries={injuries}
        onAdd={addEvent}
      />
    </div>
  )
}
