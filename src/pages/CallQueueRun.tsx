import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Plus,
  X,
} from 'lucide-react'
import {
  rankCases,
  RANKER_DEMO_CASES,
  type CaseForRanking,
  type RankedCase,
} from '@/lib/callQueueRanker'
import { useAuth } from '@/lib/AuthContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { TreatmentKanban } from '@/components/treatment/TreatmentKanban'

// ---------------------------------------------------------------------------
// Local demo supplement — mirrors the two extra cases shown on /queue so the
// cockpit hydrates the same list even before Agent D wires shared state.
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_HOUR = 60 * 60 * 1000

function offsetIso(ms: number, anchor: Date): string {
  return new Date(anchor.getTime() + ms).toISOString()
}

function buildExtraCases(anchor: Date): CaseForRanking[] {
  return [
    {
      id: 'CASE-MARIA-SANTOS',
      clientName: 'Maria Santos',
      caseType: 'MVA',
      estValue: 150_000,
      slaDeadline: offsetIso(3 * MS_PER_HOUR + 14 * 60 * 1000, anchor),
      lastContactAt: offsetIso(-9 * MS_PER_DAY, anchor),
      lastTreatmentEventAt: offsetIso(-6 * MS_PER_DAY, anchor),
      redSignals: ['Awaiting MRI authorization', 'Client hesitation on last call'],
      openAction: 'Confirm MRI scheduling',
      verdict: 'PURSUE-HARD',
    },
    {
      id: 'CASE-260101',
      clientName: 'Jade Nakamura',
      caseType: 'Slip and Fall',
      estValue: 42_000,
      slaDeadline: null,
      lastContactAt: offsetIso(-6 * MS_PER_DAY, anchor),
      lastTreatmentEventAt: offsetIso(-11 * MS_PER_DAY, anchor),
      redSignals: [],
      openAction: 'PT status check',
      verdict: 'SOLID-CASE',
    },
  ]
}

function assembleCases(anchor: Date): CaseForRanking[] {
  const byId = new Map<string, CaseForRanking>()
  for (const c of RANKER_DEMO_CASES) byId.set(c.id, c)
  for (const c of buildExtraCases(anchor)) byId.set(c.id, c)
  return Array.from(byId.values())
}

// ---------------------------------------------------------------------------
// Script rubric — 6 question mini-flow shared by every case
// ---------------------------------------------------------------------------

interface ScriptOption {
  id: string
  label: string
  expected?: boolean
}

interface ScriptQuestion {
  id: string
  section: string
  prompt: string
  options: ScriptOption[]
  layout: 'grid-2' | 'tiles'
}

const SCRIPT: ScriptQuestion[] = [
  {
    id: 'status',
    section: 'Section 1 · Opening',
    prompt: 'How are you feeling since our last call?',
    layout: 'grid-2',
    options: [
      { id: 'better', label: 'Better', expected: true },
      { id: 'same', label: 'About the same' },
      { id: 'worse', label: 'Worse' },
      { id: 'unclear', label: 'Unclear' },
    ],
  },
  {
    id: 'venue',
    section: 'Section 2 · Incident basics',
    prompt: 'Can you confirm the venue of the accident?',
    layout: 'tiles',
    options: [
      { id: 'nj-turnpike', label: 'NJ Turnpike · Exit 11', expected: true },
      { id: 'route-17-sb', label: 'Route 17 SB' },
      { id: 'i-95-n', label: 'I-95 N' },
      { id: 'other', label: 'Other…' },
    ],
  },
  {
    id: 'treatment',
    section: 'Section 3 · Treatment update',
    prompt: 'Any new treatment since we last spoke?',
    layout: 'grid-2',
    options: [
      { id: 'yes', label: 'Yes', expected: true },
      { id: 'no', label: 'No' },
      { id: 'unclear', label: 'Unclear' },
    ],
  },
  {
    id: 'pt',
    section: 'Section 3 · Treatment update',
    prompt: 'Has physical therapy been scheduled?',
    layout: 'grid-2',
    options: [
      { id: 'yes', label: 'Yes', expected: true },
      { id: 'no', label: 'No' },
      { id: 'unclear', label: 'Unclear' },
    ],
  },
  {
    id: 'mri',
    section: 'Section 3 · Treatment update',
    prompt: 'Has the MRI been scheduled?',
    layout: 'grid-2',
    options: [
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: 'No', expected: true },
      { id: 'unclear', label: 'Unclear' },
    ],
  },
  {
    id: 'adjuster',
    section: 'Section 4 · Carrier contact',
    prompt: 'Has the adjuster contacted you directly?',
    layout: 'grid-2',
    options: [
      { id: 'no', label: 'No', expected: true },
      { id: 'yes', label: 'Yes' },
      { id: 'unclear', label: 'Unclear' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Capture tag prefixes
// ---------------------------------------------------------------------------

const CAPTURE_TAGS = [
  'injury',
  'provider',
  'meds',
  'venue',
  'witness',
  'insurance',
  'pain',
  'task',
] as const

// ---------------------------------------------------------------------------
// Pre-call brief — hardcoded for Maria; generic for others
// ---------------------------------------------------------------------------

interface PreCallBrief {
  summary: string
  talkingPoints: string[]
  changes: { when: string; text: string }[]
}

function briefForCase(c: RankedCase): PreCallBrief {
  if (c.id === 'CASE-MARIA-SANTOS') {
    return {
      summary:
        'Last call Apr 21 with Mark. Maria hasn’t scheduled PT yet. MRI recommendation pending.',
      talkingPoints: [
        'Confirm PT booked',
        'Check on MRI scheduling',
        'Ask about pain level trend',
      ],
      changes: [
        { when: '2 days ago', text: 'Treatment event added: ER visit · auto-extracted' },
        { when: '4 days ago', text: 'Adjuster left voicemail — not yet returned' },
        { when: '6 days ago', text: 'Primary care referral issued · auto-extracted' },
      ],
    }
  }
  return {
    summary: 'No prior calls on file. Introduce yourself and collect basics.',
    talkingPoints: [
      'Warm intro — explain the CM role',
      'Confirm incident details',
      'Capture treatment timeline so far',
    ],
    changes: [],
  }
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

interface CallNotes {
  capturedData: Record<string, string>
  notes: string
  tasks: { id: string; text: string; done: boolean }[]
}

function notesKey(caseId: string, callId: string): string {
  return `caos:call-notes:${caseId}:${callId}`
}

function loadNotes(caseId: string, callId: string): CallNotes {
  if (typeof window === 'undefined') {
    return { capturedData: {}, notes: '', tasks: [] }
  }
  try {
    const raw = window.localStorage.getItem(notesKey(caseId, callId))
    if (!raw) return { capturedData: {}, notes: '', tasks: [] }
    const parsed = JSON.parse(raw) as Partial<CallNotes>
    return {
      capturedData: parsed.capturedData ?? {},
      notes: parsed.notes ?? '',
      tasks: parsed.tasks ?? [],
    }
  } catch {
    return { capturedData: {}, notes: '', tasks: [] }
  }
}

function saveNotes(caseId: string, callId: string, data: CallNotes): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(notesKey(caseId, callId), JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Disposition
// ---------------------------------------------------------------------------

type Disposition = 'reached' | 'voicemail' | 'wrong_number' | 'no_answer' | 'snooze'

const DISPOSITION_LABELS: Record<Disposition, string> = {
  reached: 'Reached',
  voicemail: 'Voicemail',
  wrong_number: 'Wrong number',
  no_answer: 'No answer',
  snooze: 'Snooze',
}

const DISPOSITION_SHORT: Record<Disposition, string> = {
  reached: 'Reached',
  voicemail: 'VM',
  wrong_number: 'WN',
  no_answer: 'NA',
  snooze: 'Snoozed',
}

interface CompletedEntry {
  id: string
  disposition: Disposition
  completedAt: string
}

function completedKey(userKey: string): string {
  return `caos:queue:${userKey}:completed`
}

function loadCompleted(userKey: string): CompletedEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(completedKey(userKey))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return parsed as CompletedEntry[]
    return []
  } catch {
    return []
  }
}

function saveCompleted(userKey: string, list: CompletedEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(completedKey(userKey), JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : ''
  const out = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
  return out || first.charAt(0).toUpperCase()
}

function formatClock(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function formatDollars(value: number | null): string {
  if (value === null) return '—'
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  if (value >= 1_000) return `$${Math.round(value / 1000)}K`
  return `$${value}`
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function CallQueueRun() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const userKey = user?.uid || 'default'

  // ---- Queue hydration --------------------------------------------------
  const ranked = useMemo<RankedCase[]>(() => {
    const anchor = new Date()
    return rankCases(assembleCases(anchor), anchor)
  }, [])

  const orderKey = `caos:queue:${userKey}:order`
  const orderedQueue = useMemo<RankedCase[]>(() => {
    let orderIds: string[] | null = null
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(orderKey)
        if (raw) {
          const parsed = JSON.parse(raw) as unknown
          if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
            orderIds = parsed as string[]
          }
        }
      } catch {
        orderIds = null
      }
    }
    if (!orderIds || orderIds.length === 0) {
      return ranked
    }
    const byId = new Map(ranked.map((r) => [r.id, r]))
    const ordered: RankedCase[] = []
    for (const id of orderIds) {
      const c = byId.get(id)
      if (c) ordered.push(c)
    }
    for (const r of ranked) {
      if (!orderIds.includes(r.id)) ordered.push(r)
    }
    return ordered
  }, [ranked, orderKey])

  // ---- Index / navigation -----------------------------------------------
  const startIdx = (() => {
    const raw = searchParams.get('start')
    if (!raw) return 0
    const n = parseInt(raw, 10)
    if (Number.isNaN(n) || n < 0 || n >= orderedQueue.length) return 0
    return n
  })()

  const [currentIdx, setCurrentIdx] = useState(startIdx)
  const currentCase = orderedQueue[currentIdx]
  const callId = useMemo(
    () => `call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    // Intentionally recomputed when the case changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentIdx, currentCase?.id],
  )

  // ---- Completed tracking ----------------------------------------------
  const [completed, setCompleted] = useState<CompletedEntry[]>(() =>
    loadCompleted(userKey),
  )
  useEffect(() => {
    saveCompleted(userKey, completed)
  }, [completed, userKey])
  const completedById = useMemo(() => {
    const m = new Map<string, CompletedEntry>()
    for (const e of completed) m.set(e.id, e)
    return m
  }, [completed])

  // ---- Elapsed timer -----------------------------------------------------
  const startedAt = useRef<number>(Date.now())
  const [elapsedMin, setElapsedMin] = useState(0)
  useEffect(() => {
    const t = setInterval(() => {
      setElapsedMin(Math.floor((Date.now() - startedAt.current) / 60000))
    }, 15_000)
    return () => clearInterval(t)
  }, [])

  // ---- Per-call state ---------------------------------------------------
  const [capturedData, setCapturedData] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [tasks, setTasks] = useState<CallNotes['tasks']>([])
  const [questionIdx, setQuestionIdx] = useState(0)
  const [, setHistory] = useState<{ qId: string; answer: string }[]>([])
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Load per-call notes on case change.
  useEffect(() => {
    if (!currentCase) return
    const loaded = loadNotes(currentCase.id, callId)
    setCapturedData(loaded.capturedData)
    setNotes(loaded.notes)
    setTasks(
      loaded.tasks.length > 0
        ? loaded.tasks
        : defaultTasksForCase(currentCase.id),
    )
    setQuestionIdx(0)
    setHistory([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCase?.id, callId])

  // Persist notes on change.
  useEffect(() => {
    if (!currentCase) return
    saveNotes(currentCase.id, callId, { capturedData, notes, tasks })
  }, [currentCase, callId, capturedData, notes, tasks])

  const hasUnsavedCapture =
    notes.trim().length > 0 || Object.keys(capturedData).length > 0

  // ---- UI state ----------------------------------------------------------
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [briefExpanded, setBriefExpanded] = useState(true)
  const [kanbanExpanded, setKanbanExpanded] = useState(false)
  const [dispositionOpen, setDispositionOpen] = useState(false)
  const [confirmJumpIdx, setConfirmJumpIdx] = useState<number | null>(null)
  const [confirmExit, setConfirmExit] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [addTaskText, setAddTaskText] = useState('')
  const [dialAnimation, setDialAnimation] = useState(false)

  // ---- Script helpers ----------------------------------------------------
  const currentQuestion = SCRIPT[questionIdx]

  const handleAnswer = useCallback(
    (answerId: string) => {
      if (!currentQuestion) return
      setCapturedData((prev) => ({ ...prev, [currentQuestion.id]: answerId }))
      setHistory((prev) => [...prev, { qId: currentQuestion.id, answer: answerId }])
      if (questionIdx < SCRIPT.length - 1) {
        setQuestionIdx((i) => i + 1)
      }
    },
    [currentQuestion, questionIdx],
  )

  function handleBack() {
    if (questionIdx === 0) return
    setQuestionIdx((i) => i - 1)
    setHistory((h) => h.slice(0, -1))
  }

  function handleSkip() {
    if (questionIdx < SCRIPT.length - 1) {
      setQuestionIdx((i) => i + 1)
    }
  }

  // ---- Capture pad ------------------------------------------------------
  function insertTag(tag: string) {
    const el = textareaRef.current
    const prefix = `[${tag}] `
    if (el) {
      const start = el.selectionStart ?? notes.length
      const end = el.selectionEnd ?? notes.length
      const before = notes.slice(0, start)
      const after = notes.slice(end)
      const needsLeadingNewline = before.length > 0 && !before.endsWith('\n')
      const insertion = (needsLeadingNewline ? '\n' : '') + prefix
      const next = before + insertion + after
      setNotes(next)
      // Restore caret after inserted prefix.
      requestAnimationFrame(() => {
        if (!textareaRef.current) return
        const pos = before.length + insertion.length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(pos, pos)
      })
    } else {
      setNotes((n) => (n.length > 0 && !n.endsWith('\n') ? n + '\n' : n) + prefix)
    }
  }

  function toggleTask(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    )
  }

  function addTask() {
    const text = addTaskText.trim()
    if (!text) {
      setAddTaskOpen(false)
      return
    }
    setTasks((prev) => [
      ...prev,
      { id: `t-${Date.now().toString(36)}`, text, done: false },
    ])
    setAddTaskText('')
    setAddTaskOpen(false)
  }

  // ---- Queue navigation -------------------------------------------------
  function tryJumpTo(idx: number) {
    if (idx === currentIdx) return
    if (hasUnsavedCapture) {
      setConfirmJumpIdx(idx)
      return
    }
    jumpTo(idx)
  }

  function jumpTo(idx: number) {
    if (idx < 0 || idx >= orderedQueue.length) return
    setCurrentIdx(idx)
  }

  function tryExit() {
    if (hasUnsavedCapture) {
      setConfirmExit(true)
    } else {
      navigate('/queue')
    }
  }

  // ---- End call & next --------------------------------------------------
  function completeAndAdvance(disposition: Disposition, exit: boolean) {
    if (!currentCase) return
    setCompleted((prev) => {
      const next = prev.filter((e) => e.id !== currentCase.id)
      next.push({
        id: currentCase.id,
        disposition,
        completedAt: new Date().toISOString(),
      })
      return next
    })
    setDispositionOpen(false)
    if (exit) {
      navigate('/queue')
      return
    }
    // Advance + countdown
    const nextIdx = findNextIdx(currentIdx)
    if (nextIdx === null) {
      navigate('/queue')
      return
    }
    setCountdown(3)
  }

  const findNextIdx = useCallback(
    (from: number): number | null => {
      for (let i = from + 1; i < orderedQueue.length; i++) {
        const c = orderedQueue[i]
        if (c && !completedById.has(c.id)) return i
      }
      return null
    },
    [orderedQueue, completedById],
  )

  // Countdown driver
  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      const nextIdx = findNextIdx(currentIdx)
      setCountdown(null)
      if (nextIdx !== null) {
        jumpTo(nextIdx)
      } else {
        navigate('/queue')
      }
      return
    }
    const t = setTimeout(() => setCountdown((n) => (n === null ? null : n - 1)), 900)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown])

  // ---- Dial animation ---------------------------------------------------
  const handleDial = useCallback(() => {
    setDialAnimation(true)
    // Brief tone via WebAudio — tiny, no asset.
    try {
      const AudioCtxCtor =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (AudioCtxCtor) {
        const ctx = new AudioCtxCtor()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = 440
        gain.gain.value = 0.04
        osc.connect(gain).connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.2)
        setTimeout(() => ctx.close().catch(() => {}), 400)
      }
    } catch {
      /* ignore */
    }
    setTimeout(() => setDialAnimation(false), 900)
  }, [])

  // ---- Keyboard shortcuts ----------------------------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const isTyping =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)

      if (e.key === 'Escape') {
        e.preventDefault()
        tryExit()
        return
      }

      if (isTyping) return

      const k = e.key.toLowerCase()
      if (k === 'tab' && !e.shiftKey) {
        const ta = textareaRef.current
        if (ta) {
          e.preventDefault()
          ta.focus()
        }
        return
      }
      if (k === 'n') {
        e.preventDefault()
        setDispositionOpen(true)
        return
      }
      if (k === 's') {
        e.preventDefault()
        setDispositionOpen(true)
        // Pre-select snooze (handled via state default below)
        return
      }
      if (k === 'd') {
        e.preventDefault()
        handleDial()
        return
      }
      if (k === 'j') {
        e.preventDefault()
        const nextIdx = Math.min(orderedQueue.length - 1, currentIdx + 1)
        tryJumpTo(nextIdx)
        return
      }
      if (k === 'k') {
        e.preventDefault()
        const prevIdx = Math.max(0, currentIdx - 1)
        tryJumpTo(prevIdx)
        return
      }
      // 1 / 2 / 3 → answer buttons
      if ((k === '1' || k === '2' || k === '3') && currentQuestion) {
        const idx = parseInt(k, 10) - 1
        const opt = currentQuestion.options[idx]
        if (opt) {
          e.preventDefault()
          handleAnswer(opt.id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, orderedQueue.length, currentQuestion, handleAnswer, handleDial])

  // ---- Progress calc ----------------------------------------------------
  const totalCount = orderedQueue.length
  const doneCount = completed.length
  const progressPct =
    totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)

  if (!currentCase) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <p className="text-[13px]">No cases in queue.</p>
        <Button size="sm" onClick={() => navigate('/queue')}>
          Back to queue
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-48px)] flex-col bg-background text-foreground">
      {/* ------------------------------------------------------------- */}
      {/* PROGRESS HEADER                                                */}
      {/* ------------------------------------------------------------- */}
      <header
        className={cn(
          'sticky top-0 z-30 flex h-10 shrink-0 items-center gap-3 border-b border-border px-3',
          'bg-background/95 backdrop-blur-sm',
        )}
      >
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1"
          onClick={tryExit}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Exit
        </Button>
        <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
          <span>
            Queue ·{' '}
            <span className="text-foreground">
              {currentIdx + 1} of {totalCount}
            </span>
          </span>
          <span className="h-3 w-px bg-border" />
          <span>{elapsedMin} min elapsed</span>
          <span className="h-3 w-px bg-border" />
          <span>
            {doneCount}/{totalCount} done
          </span>
        </div>
        <div className="ml-auto w-56">
          <Progress value={progressPct} />
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* BODY                                                           */}
      {/* ------------------------------------------------------------- */}
      <div className="flex min-h-0 flex-1">
        {/* ---- Left queue rail ---- */}
        <QueueRail
          queue={orderedQueue}
          currentIdx={currentIdx}
          completedById={completedById}
          collapsed={railCollapsed}
          onToggleCollapse={() => setRailCollapsed((c) => !c)}
          onRowClick={(i) => tryJumpTo(i)}
        />

        {/* ---- Call cockpit ---- */}
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4 pb-24">
            {/* Case header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[12px] font-semibold text-foreground">
                {initialsOf(currentCase.clientName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-[15px] font-semibold tracking-tight">
                    {currentCase.clientName}
                  </h1>
                  <span className="rounded-full border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {currentCase.caseType}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <span>{currentCase.id}</span>
                  <span>·</span>
                  <span>{formatDollars(currentCase.estValue)}</span>
                </div>
              </div>
              <Button
                size="sm"
                variant={dialAnimation ? 'default' : 'outline'}
                className={cn(
                  'h-8 gap-1.5 transition-all',
                  dialAnimation && 'ring-2 ring-ring/50',
                )}
                onClick={handleDial}
              >
                <Phone
                  className={cn(
                    'h-3.5 w-3.5',
                    dialAnimation && 'animate-pulse',
                  )}
                />
                {dialAnimation ? 'Connecting…' : 'Dial'}
                <span className="text-[10px] opacity-60">D</span>
              </Button>
            </div>

            {/* Pre-call brief */}
            <PreCallBriefCard
              brief={briefForCase(currentCase)}
              expanded={briefExpanded}
              onToggle={() => setBriefExpanded((e) => !e)}
            />

            {/* Script prompt */}
            <ScriptCard
              question={currentQuestion}
              stepIdx={questionIdx}
              totalSteps={SCRIPT.length}
              onAnswer={handleAnswer}
              onBack={handleBack}
              onSkip={handleSkip}
              canBack={questionIdx > 0}
              canSkip={questionIdx < SCRIPT.length - 1}
            />

            {/* Capture pad */}
            <CapturePad
              tags={CAPTURE_TAGS}
              onTagClick={insertTag}
              notes={notes}
              onNotesChange={setNotes}
              textareaRef={textareaRef}
              tasks={tasks}
              onToggleTask={toggleTask}
              onOpenAddTask={() => setAddTaskOpen(true)}
              addTaskOpen={addTaskOpen}
              addTaskText={addTaskText}
              setAddTaskText={setAddTaskText}
              onConfirmAddTask={addTask}
              onCancelAddTask={() => {
                setAddTaskOpen(false)
                setAddTaskText('')
              }}
            />

            {/* Treatment Kanban (collapsible) */}
            <section className="mt-4 rounded-lg border border-border bg-card">
              <button
                type="button"
                onClick={() => setKanbanExpanded((e) => !e)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium hover:bg-muted/30"
              >
                {kanbanExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span>Treatment Kanban</span>
                <span className="text-[11px] text-muted-foreground">
                  · add events without leaving
                </span>
              </button>
              {kanbanExpanded && (
                <div
                  className="max-h-[320px] overflow-y-auto border-t border-border p-3"
                  // Scope the embedded kanban so it doesn't fight the cockpit's own shortcuts
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <TreatmentKanban caseId={currentCase.id} />
                </div>
              )}
            </section>
          </div>

          {/* Sticky end-call footer */}
          <div
            className={cn(
              'pointer-events-none absolute right-0 bottom-0 left-0 flex justify-end px-5 pb-4',
            )}
          >
            <div className="pointer-events-auto flex items-center gap-2">
              <span className="rounded-md border border-border bg-background/95 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                N
              </span>
              <Button
                size="lg"
                className="h-10 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setDispositionOpen(true)}
              >
                End call & next
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </main>
      </div>

      {/* ---- Disposition modal ---- */}
      <DispositionDialog
        open={dispositionOpen}
        onOpenChange={setDispositionOpen}
        clientName={currentCase.clientName}
        onSave={(d, exit) => completeAndAdvance(d, exit)}
      />

      {/* ---- Confirm jump modal ---- */}
      <ConfirmDialog
        open={confirmJumpIdx !== null}
        title="Unsaved capture"
        description="You have unsaved capture notes on the current call. Jump anyway?"
        confirmLabel="Jump"
        onCancel={() => setConfirmJumpIdx(null)}
        onConfirm={() => {
          const idx = confirmJumpIdx
          setConfirmJumpIdx(null)
          if (idx !== null) jumpTo(idx)
        }}
      />

      {/* ---- Confirm exit modal ---- */}
      <ConfirmDialog
        open={confirmExit}
        title="Exit queue?"
        description="You have unsaved capture notes. Exit anyway?"
        confirmLabel="Exit"
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => {
          setConfirmExit(false)
          navigate('/queue')
        }}
      />

      {/* ---- Countdown overlay ---- */}
      {countdown !== null && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background/90">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Next call in
          </div>
          <div className="mt-2 font-mono text-[120px] leading-none font-semibold text-foreground">
            {countdown}
          </div>
          <button
            type="button"
            onClick={() => {
              const nextIdx = findNextIdx(currentIdx)
              setCountdown(null)
              if (nextIdx !== null) jumpTo(nextIdx)
              else navigate('/queue')
            }}
            className="mt-6 text-[12px] text-muted-foreground hover:text-foreground hover:underline"
          >
            Skip countdown
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Left queue rail
// ---------------------------------------------------------------------------

interface QueueRailProps {
  queue: RankedCase[]
  currentIdx: number
  completedById: Map<string, CompletedEntry>
  collapsed: boolean
  onToggleCollapse: () => void
  onRowClick: (idx: number) => void
}

function QueueRail({
  queue,
  currentIdx,
  completedById,
  collapsed,
  onToggleCollapse,
  onRowClick,
}: QueueRailProps) {
  const width: CSSProperties = collapsed ? { width: 48 } : { width: 320 }
  return (
    <aside
      style={width}
      className="flex shrink-0 flex-col border-r border-border bg-card transition-[width] duration-150"
    >
      <div className="flex h-9 items-center justify-between border-b border-border px-2">
        {!collapsed && (
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Queue
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand queue' : 'Collapse queue'}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="flex flex-col">
          {queue.map((c, i) => {
            const done = completedById.get(c.id)
            const isCurrent = i === currentIdx
            return (
              <li
                key={c.id}
                className={cn(
                  'border-b border-border last:border-0',
                  isCurrent && 'border-l-2 border-l-ring bg-ring/5',
                )}
              >
                <button
                  type="button"
                  onClick={() => onRowClick(i)}
                  className={cn(
                    'flex w-full items-center gap-2 px-2 py-2 text-left transition-colors',
                    'hover:bg-muted/40',
                  )}
                >
                  <StatusGlyph
                    state={done ? 'done' : isCurrent ? 'current' : 'upcoming'}
                  />
                  <span
                    className={cn(
                      'inline-flex h-5 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[10px]',
                      done
                        ? 'text-muted-foreground'
                        : isCurrent
                          ? 'bg-ring/15 text-ring'
                          : 'text-muted-foreground',
                    )}
                  >
                    #{c.rank}
                  </span>
                  {!collapsed && (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'truncate text-[12px] font-medium',
                            done ? 'text-muted-foreground' : 'text-foreground',
                          )}
                        >
                          {c.clientName}
                        </span>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-ring/15 px-1.5 py-0.5 text-[9px] font-semibold text-ring">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ring" />
                            LIVE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        {done ? (
                          <>
                            <span>{DISPOSITION_SHORT[done.disposition]}</span>
                            <span>·</span>
                            <span>
                              {formatClock(new Date(done.completedAt))}
                            </span>
                          </>
                        ) : isCurrent ? (
                          <span>Current</span>
                        ) : (
                          <>
                            <span className="truncate">
                              {c.reasonChips[0]?.label ?? c.caseType}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}

function StatusGlyph({
  state,
}: {
  state: 'done' | 'current' | 'upcoming'
}) {
  if (state === 'done') {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ring/20 text-ring">
        <Check className="h-2.5 w-2.5" />
      </span>
    )
  }
  if (state === 'current') {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <span className="h-2 w-2 animate-pulse rounded-full bg-ring" />
      </span>
    )
  }
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Pre-call brief card
// ---------------------------------------------------------------------------

function PreCallBriefCard({
  brief,
  expanded,
  onToggle,
}: {
  brief: PreCallBrief
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <section className="mb-4 rounded-lg border border-border border-l-2 border-l-ring bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/30"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Pre-call brief
        </span>
        {!expanded && (
          <span className="ml-2 truncate text-[12px] text-foreground/80">
            {brief.summary}
          </span>
        )}
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-border p-3">
          <p className="text-[13px] leading-relaxed text-foreground/90">
            {brief.summary}
          </p>
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              Talking points
            </p>
            <ol className="space-y-1 pl-4 text-[13px] text-foreground/90">
              {brief.talkingPoints.map((tp, i) => (
                <li key={i} className="list-decimal">
                  {tp}
                </li>
              ))}
            </ol>
          </div>
          {brief.changes.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                What’s changed
              </p>
              <ul className="space-y-1 text-[12px]">
                {brief.changes.map((ch, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      +
                    </span>
                    <span className="text-muted-foreground">{ch.when} ·</span>
                    <span className="text-foreground/80">{ch.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Script card
// ---------------------------------------------------------------------------

interface ScriptCardProps {
  question: ScriptQuestion | undefined
  stepIdx: number
  totalSteps: number
  onAnswer: (id: string) => void
  onBack: () => void
  onSkip: () => void
  canBack: boolean
  canSkip: boolean
}

function ScriptCard({
  question,
  stepIdx,
  totalSteps,
  onAnswer,
  onBack,
  onSkip,
  canBack,
  canSkip,
}: ScriptCardProps) {
  if (!question) {
    return (
      <section className="mb-4 rounded-lg border border-border bg-card p-4">
        <p className="text-[13px] text-muted-foreground">
          Script complete. End the call when ready.
        </p>
      </section>
    )
  }
  return (
    <section className="mb-4 rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {question.section}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          Step {stepIdx + 1} / {totalSteps}
        </span>
      </div>
      <div className="p-3">
        <p className="mb-3 text-[14px] font-medium leading-relaxed">
          “{question.prompt}”
        </p>
        <div
          className={cn(
            'grid gap-2',
            question.layout === 'grid-2'
              ? 'grid-cols-2'
              : 'grid-cols-2 sm:grid-cols-4',
          )}
        >
          {question.options.map((opt, i) => (
            <Button
              key={opt.id}
              variant="outline"
              size="default"
              className={cn(
                'h-auto justify-start whitespace-normal py-2.5 text-left',
                opt.expected && 'border-ring/40 bg-ring/5',
              )}
              onClick={() => onAnswer(opt.id)}
            >
              <span className="flex w-full items-center gap-2">
                {i < 3 && (
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border font-mono text-[10px] text-muted-foreground">
                    {i + 1}
                  </span>
                )}
                <span className="flex-1 text-[13px] font-medium">
                  {opt.label}
                </span>
                {opt.expected && (
                  <span className="text-[10px] font-normal text-ring">
                    expected
                  </span>
                )}
              </span>
            </Button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-muted-foreground"
            onClick={onBack}
            disabled={!canBack}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-muted-foreground"
            onClick={onSkip}
            disabled={!canSkip}
          >
            Skip
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Capture pad
// ---------------------------------------------------------------------------

interface CapturePadProps {
  tags: readonly string[]
  onTagClick: (t: string) => void
  notes: string
  onNotesChange: (v: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  tasks: CallNotes['tasks']
  onToggleTask: (id: string) => void
  onOpenAddTask: () => void
  addTaskOpen: boolean
  addTaskText: string
  setAddTaskText: (v: string) => void
  onConfirmAddTask: () => void
  onCancelAddTask: () => void
}

function CapturePad({
  tags,
  onTagClick,
  notes,
  onNotesChange,
  textareaRef,
  tasks,
  onToggleTask,
  onOpenAddTask,
  addTaskOpen,
  addTaskText,
  setAddTaskText,
  onConfirmAddTask,
  onCancelAddTask,
}: CapturePadProps) {
  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(96, el.scrollHeight)}px`
  }, [notes, textareaRef])

  return (
    <section className="mb-4 rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Capture pad
        </span>
        <span className="text-[10px] text-muted-foreground">
          Tab to focus
        </span>
      </div>
      <div className="space-y-3 p-3">
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTagClick(t)}
              className="inline-flex h-6 items-center rounded-full border border-border bg-background px-2 text-[11px] text-muted-foreground hover:border-ring/30 hover:bg-ring/5 hover:text-ring"
            >
              [{t}]
            </button>
          ))}
        </div>

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Type free notes as the call unfolds…"
          className="min-h-24 text-[13px] leading-relaxed"
        />

        {/* Tasks */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Tasks
            </span>
            {!addTaskOpen && (
              <Button
                size="xs"
                variant="ghost"
                className="h-6 gap-1 text-muted-foreground"
                onClick={onOpenAddTask}
              >
                <Plus className="h-3 w-3" />
                Add task
              </Button>
            )}
          </div>
          <ul className="space-y-1">
            {tasks.length === 0 && !addTaskOpen && (
              <li className="text-[12px] text-muted-foreground">
                No tasks yet.
              </li>
            )}
            {tasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
              >
                <Checkbox
                  checked={t.done}
                  onCheckedChange={() => onToggleTask(t.id)}
                />
                <span
                  className={cn(
                    'flex-1 text-[12px]',
                    t.done && 'text-muted-foreground line-through',
                  )}
                >
                  {t.text}
                </span>
              </li>
            ))}
            {addTaskOpen && (
              <li className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
                <Input
                  autoFocus
                  value={addTaskText}
                  onChange={(e) => setAddTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      onConfirmAddTask()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      onCancelAddTask()
                    }
                  }}
                  placeholder="New task…"
                  className="h-7 text-[12px]"
                />
                <Button size="xs" onClick={onConfirmAddTask}>
                  Add
                </Button>
                <Button size="xs" variant="ghost" onClick={onCancelAddTask}>
                  <X className="h-3 w-3" />
                </Button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Default task suggestions
// ---------------------------------------------------------------------------

function defaultTasksForCase(caseId: string): CallNotes['tasks'] {
  if (caseId === 'CASE-MARIA-SANTOS') {
    return [
      { id: 'td-1', text: 'Pull prior MVA records from RWJ ER', done: false },
      { id: 'td-2', text: 'File PIP claim with GEICO within 7 days', done: false },
      { id: 'td-3', text: 'Coordinate PT intake with network provider', done: false },
    ]
  }
  return [
    { id: 'td-1', text: 'Confirm best contact number', done: false },
    { id: 'td-2', text: 'Send intake packet via email', done: false },
  ]
}

// ---------------------------------------------------------------------------
// Disposition dialog
// ---------------------------------------------------------------------------

interface DispositionDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  clientName: string
  onSave: (d: Disposition, exit: boolean) => void
}

interface AIEvent {
  id: string
  label: string
  detail: string
}

const DEFAULT_AI_EVENTS: AIEvent[] = [
  {
    id: 'ev-1',
    label: 'Treatment event: PT referral acknowledged',
    detail: 'Client confirmed receipt of referral slip.',
  },
  {
    id: 'ev-2',
    label: 'Task: Follow up on MRI scheduling',
    detail: 'MRI remains unscheduled — flag to adjuster.',
  },
  {
    id: 'ev-3',
    label: 'Note: Pain trend improved (6 → 4)',
    detail: 'Scoring agent inferred improvement from call transcript.',
  },
]

type SnoozeOption = 'tomorrow' | '3days' | 'monday' | 'custom'

function DispositionDialog(props: DispositionDialogProps) {
  // Remount the inner content each time the dialog opens so all state
  // (disposition, snooze, note, AI events) resets cleanly without requiring
  // a setState-in-effect cascade.
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && <DispositionDialogBody {...props} />}
    </Dialog>
  )
}

function DispositionDialogBody({
  clientName,
  onSave,
}: DispositionDialogProps) {
  const [disposition, setDisposition] = useState<Disposition>('reached')
  const [snoozeOpt, setSnoozeOpt] = useState<SnoozeOption>('tomorrow')
  const [quickNote, setQuickNote] = useState('')
  const [eventAccepted, setEventAccepted] = useState<Record<string, boolean>>(
    () => Object.fromEntries(DEFAULT_AI_EVENTS.map((e) => [e.id, true])),
  )

  function toggleEvent(id: string) {
    setEventAccepted((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>End call · {clientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Disposition */}
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              Disposition
            </p>
            <RadioGroup<Disposition>
              value={disposition}
              onValueChange={(v) => setDisposition(v)}
              className="grid grid-cols-2 gap-1.5"
            >
              {(Object.keys(DISPOSITION_LABELS) as Disposition[]).map((d) => (
                <label
                  key={d}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-[12px] transition-colors',
                    disposition === d
                      ? 'border-ring/40 bg-ring/5 text-foreground'
                      : 'border-border bg-background text-foreground/80 hover:border-ring/20',
                  )}
                >
                  <RadioGroupItem value={d} />
                  <span>{DISPOSITION_LABELS[d]}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Snooze options */}
          {disposition === 'snooze' && (
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Snooze until
              </p>
              <RadioGroup<SnoozeOption>
                value={snoozeOpt}
                onValueChange={(v) => setSnoozeOpt(v)}
                className="grid grid-cols-2 gap-1.5"
              >
                {(
                  [
                    ['tomorrow', 'Tomorrow 9am'],
                    ['3days', 'In 3 days'],
                    ['monday', 'Next Monday'],
                    ['custom', 'Custom…'],
                  ] as [SnoozeOption, string][]
                ).map(([k, lbl]) => (
                  <label
                    key={k}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-[12px] transition-colors',
                      snoozeOpt === k
                        ? 'border-ring/40 bg-ring/5 text-foreground'
                        : 'border-border bg-background text-foreground/80 hover:border-ring/20',
                    )}
                  >
                    <RadioGroupItem value={k} />
                    <span>{lbl}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Quick note */}
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              Quick note
            </p>
            <Textarea
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              placeholder="Optional wrap-up note…"
              className="min-h-16 text-[13px]"
            />
          </div>

          {/* AI-extracted events */}
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              AI-extracted events ({DEFAULT_AI_EVENTS.length})
            </p>
            <ul className="space-y-1">
              {DEFAULT_AI_EVENTS.map((ev) => {
                const accepted = eventAccepted[ev.id] ?? false
                return (
                  <li
                    key={ev.id}
                    className={cn(
                      'flex items-start gap-2 rounded-md border px-2 py-1.5',
                      accepted
                        ? 'border-ring/30 bg-ring/5'
                        : 'border-border bg-background opacity-60',
                    )}
                  >
                    <Checkbox
                      checked={accepted}
                      onCheckedChange={() => toggleEvent(ev.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-foreground">
                        {ev.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {ev.detail}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onSave(disposition, true)}
          >
            Save & Exit
          </Button>
          <Button onClick={() => onSave(disposition, false)}>
            Save & Next
          </Button>
        </DialogFooter>
      </DialogContent>
  )
}

// ---------------------------------------------------------------------------
// Generic confirm dialog
// ---------------------------------------------------------------------------

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onCancel() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-[13px] text-muted-foreground">{description}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Exports — both default and named for router-wiring flexibility
// ---------------------------------------------------------------------------

export { CallQueueRun }
export default CallQueueRun
