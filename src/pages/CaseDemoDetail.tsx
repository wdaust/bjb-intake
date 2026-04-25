import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ListPlus,
  Pause,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/AuthContext'
import { CallPlayer } from '@/components/case/CallPlayer'
import type { CallPlayerSegment } from '@/components/case/CallPlayer'
import type { CallScores } from '@/components/intake/CallScoreCard'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { TreatmentKanban } from '@/components/treatment/TreatmentKanban'
import {
  DEMO_INJURIES,
  DEMO_EVENTS,
} from '@/components/treatment/TreatmentKanban'
import type { TreatmentEvent, Injury } from '@/lib/treatmentUtils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { resolveCaseTrack } from '@/lib/caseTrack'
import type { CaseForRanking } from '@/lib/callQueueRanker'
import { TrackChip } from '@/components/case/TrackChip'
import { TrackPicker } from '@/components/case/TrackPicker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// ---------------------------------------------------------------------------
// Maria's CM call transcript — ~170wpm + 0.4s gap matches the seeded audio.
// ---------------------------------------------------------------------------

const CM_CALL_SEGMENTS: CallPlayerSegment[] = [
  { speaker: 'JESS', start: 0, end: 11.6, text: "Hi Maria, this is Jess from Brandon J. Broderick's office. I'm a case manager here. I just wanted to touch base after your call with Mark yesterday. Is now still a good time?" },
  { speaker: 'MARIA', start: 12, end: 18.4, text: "Oh yeah, hi. Um, yeah, it's a good time. Sorry, I'm just moving some things around. Go ahead." },
  { speaker: 'JESS', start: 18.8, end: 32.2, text: "No worries. So I have the basics from Mark, but I want to walk through it with you myself and make sure I have everything right. Can you tell me about the accident, just in your own words?" },
  { speaker: 'MARIA', start: 32.6, end: 51, text: "Um, okay. So it was, I think last Tuesday? Yeah, Tuesday. I was driving home on the Turnpike, near exit eleven I think. I was just sitting in traffic, not moving, and this guy, I don't even know what he was doing, he just slammed into the back of me. Really hard." },
  { speaker: 'JESS', start: 51.4, end: 53.8, text: 'Did the police come to the scene?' },
  { speaker: 'MARIA', start: 54.2, end: 59.5, text: "Yeah, State Police came. I have the report number somewhere. Hold on. Okay, it's NJ-SP-2026-0482-A." },
  { speaker: 'JESS', start: 59.9, end: 64.5, text: "Perfect, I'm writing that down. Was anyone else in the car with you?" },
  { speaker: 'MARIA', start: 64.9, end: 68.4, text: 'No, just me. Thank God. My daughter was at school.' },
  { speaker: 'JESS', start: 68.8, end: 72.4, text: 'Okay. Were you taken to the hospital from the scene?' },
  { speaker: 'MARIA', start: 72.8, end: 88, text: 'Yeah, the paramedics, I was shaking really bad and my neck was already hurting, so they took me to Robert Wood Johnson. I was there for like five hours. They did x-rays, CT scan, gave me some muscle relaxers, and sent me home.' },
  { speaker: 'JESS', start: 88.4, end: 94.7, text: 'Got it. So the CT scan, did they mention anything about the results, or was it all cleared?' },
  { speaker: 'MARIA', start: 95.1, end: 106, text: 'They said no fracture. But my neck and my lower back are killing me. Like, I can barely turn my head, and the lower back, it shoots down my right leg.' },
  { speaker: 'JESS', start: 106.4, end: 116.3, text: "That shooting pain down the leg is something we'll definitely want to look at. Has anyone, a doctor or your primary, followed up with you since the ER?" },
  { speaker: 'MARIA', start: 116.7, end: 126.3, text: "I saw my regular doctor Thursday. She said I should do physical therapy and maybe get an MRI if it doesn't get better in a couple weeks." },
  { speaker: 'JESS', start: 126.7, end: 129.5, text: 'Okay. Has the physical therapy been scheduled yet?' },
  { speaker: 'MARIA', start: 129.9, end: 139.1, text: "Uh, no. She gave me a referral but I haven't called them yet. I've just been kind of, you know, trying to get through the day." },
  { speaker: 'JESS', start: 139.5, end: 159.9, text: "That's completely understandable. So here's what I'd like to do. First, I want to get that PT scheduled for you as quickly as possible. The sooner you're in active treatment, the better for your case and for your recovery. We work with a network of providers. Would it be easier if our office coordinated that appointment for you?" },
  { speaker: 'MARIA', start: 160.3, end: 165.3, text: "Oh, yeah, actually that would be great. I didn't know you guys did that." },
  { speaker: 'JESS', start: 165.7, end: 189.7, text: "We do. Second thing. I want to flag the MRI. Given the shooting pain down your leg, that's a classic sign of something going on at the L4 or L5 level, and we shouldn't wait a couple of weeks. I'm going to ask you to call your primary back and ask her to order the MRI now, not in two weeks. Can you do that today or tomorrow?" },
  { speaker: 'MARIA', start: 190.1, end: 193.2, text: 'Yeah, I can call her office in the morning.' },
  { speaker: 'JESS', start: 193.6, end: 200, text: 'Perfect. Now, quick question on insurance. Do you know if you have PIP coverage on your auto policy?' },
  { speaker: 'MARIA', start: 200.4, end: 206.4, text: "I think so? I have GEICO. I have like, the basic New Jersey package, whatever that's called." },
  { speaker: 'JESS', start: 206.8, end: 224.1, text: "Okay, that's what I needed. Do you know the policy number? You don't have to tell me right now. You can just text it or email it to me later. Same with any photos of the damage to your car, and the police report if you have a copy." },
  { speaker: 'MARIA', start: 224.5, end: 226.6, text: 'Yeah, I can do that tonight.' },
  { speaker: 'JESS', start: 227, end: 237.6, text: "Great. Last thing, just so we're on the same page: you understand that our office is representing you for this accident, correct? You haven't spoken with any other law firm?" },
  { speaker: 'MARIA', start: 238, end: 240.1, text: 'Right. No, you guys are it.' },
  { speaker: 'JESS', start: 240.5, end: 258.5, text: "Perfect. You'll be getting calls from the adjuster. Do not speak to them. Direct them to me. Here's what I'm going to do today: I'll get PT scheduled for you and send you confirmation. Tomorrow you'll call your doctor about the MRI. End of the week we'll talk again. Sound good?" },
  { speaker: 'MARIA', start: 258.9, end: 262.8, text: "Yeah, that's, yeah, thank you, Jess. I feel a lot better." },
  { speaker: 'JESS', start: 263.2, end: 265.7, text: "We've got you. Talk to you Friday." },
]

// Shorter seed transcript for the earlier Mark × Maria intake-triage call.
const INTAKE_TRIAGE_SEGMENTS: CallPlayerSegment[] = [
  { speaker: 'MARK', start: 0, end: 6, text: "Hi Maria, this is Mark with Brandon J. Broderick's office. You reached out through our website — do you have a few minutes to walk through what happened?" },
  { speaker: 'MARIA', start: 6.4, end: 10.8, text: 'Yeah, sure. I got rear-ended on the Turnpike last week and I\'ve been in a lot of pain.' },
  { speaker: 'MARK', start: 11.2, end: 18, text: 'I\'m sorry you\'re dealing with that. Let me take some basics and then we\'ll hand you off to one of our case managers who will stay with you end-to-end. Date of the accident?' },
  { speaker: 'MARIA', start: 18.4, end: 22.1, text: 'Last Tuesday. Around 4pm. Near exit 11 on the Turnpike.' },
  { speaker: 'MARK', start: 22.5, end: 27.8, text: 'Got it. And were you taken to the hospital? Did police respond?' },
  { speaker: 'MARIA', start: 28.2, end: 38, text: 'Yeah, state police came, paramedics brought me to Robert Wood Johnson. I was there about five hours. They did a CT, no fracture, sent me home with muscle relaxers.' },
  { speaker: 'MARK', start: 38.4, end: 45.1, text: 'Okay. Any followup since? Primary care, specialist, anything?' },
  { speaker: 'MARIA', start: 45.5, end: 52.2, text: "I saw my regular doctor Thursday. She wants me to do PT and maybe an MRI if it doesn't get better." },
  { speaker: 'MARK', start: 52.6, end: 62, text: "Good, that's helpful. I'm going to get you set up with our case manager Jess — she\'ll coordinate treatment from here and walk you through insurance. You\'ll hear from her tomorrow." },
  { speaker: 'MARIA', start: 62.4, end: 65, text: 'Okay. That sounds great. Thank you.' },
  { speaker: 'MARK', start: 65.4, end: 72.5, text: "One last thing — have you spoken with any other attorney or firm about this? We just want to make sure we're the only ones." },
  { speaker: 'MARIA', start: 72.9, end: 75.8, text: 'No, you guys are the only ones.' },
  { speaker: 'MARK', start: 76.2, end: 82, text: "Perfect. We're going to take good care of you. You\'ll hear from Jess tomorrow morning." },
]

// ---------------------------------------------------------------------------
// Post-call AI artifacts — the CM intro call (today)
// ---------------------------------------------------------------------------

const CM_CALL_SCORES: CallScores = {
  information_capture: {
    score: 95,
    evidence_quote: 'Insurance — do you have PIP on your auto policy?',
  },
  compliance: {
    score: 100,
    evidence_quote:
      "You'll be getting calls from the adjuster — do not speak to them, direct them to me.",
  },
  empathy: {
    score: 90,
    evidence_quote: "We've got you. Talk to you Friday.",
  },
  call_progression: {
    score: 100,
    evidence_quote:
      "Here's what I'm going to do today: get PT scheduled, send confirmation...",
  },
}

// Earlier-call seed scores. These drive the trend chip (74 → 88 → 96).
const INTAKE_TRIAGE_SCORES: CallScores = {
  information_capture: {
    score: 88,
    evidence_quote: 'Date of the accident? ... Were you taken to the hospital?',
  },
  compliance: {
    score: 92,
    evidence_quote:
      "Have you spoken with any other attorney or firm about this?",
  },
  empathy: {
    score: 82,
    evidence_quote: "I'm sorry you're dealing with that.",
  },
  call_progression: {
    score: 90,
    evidence_quote:
      "I'm going to get you set up with our case manager Jess — she'll coordinate treatment from here.",
  },
}

const INITIAL_TRIAGE_SCORES: CallScores = {
  information_capture: {
    score: 72,
    evidence_quote: 'Intake form captured — basic contact only.',
  },
  compliance: {
    score: 78,
    evidence_quote: 'Standard website disclosure acknowledged.',
  },
  empathy: {
    score: 70,
    evidence_quote: 'Brief hold time, apologetic tone.',
  },
  call_progression: {
    score: 76,
    evidence_quote: 'Handed off to intake specialist within 24 hours.',
  },
}

interface ExtraDimension {
  key: string
  label: string
  score: number
  evidence: string
}

// Treatment coordination + next-step clarity — the two dimensions the CM
// rubric adds on top of the shared four. Shown as extra rows inside the
// expanded hero so every rubric callout from the brief shows up.
const EXTRA_DIMENSIONS: ExtraDimension[] = [
  {
    key: 'treatment_coordination',
    label: 'Treatment coordination',
    score: 100,
    evidence:
      'Second — the MRI. Given the shooting pain down your leg, that\'s a classic sign of something going on at the L4 or L5 level...',
  },
  {
    key: 'next_step_clarity',
    label: 'Next-step clarity',
    score: 100,
    evidence:
      "Here's what I'm going to do today: I'll get PT scheduled for you and send you confirmation. Tomorrow you'll call your doctor about the MRI.",
  },
]

interface ExtractedUpdate {
  id: string
  modality: string
  headline: string
  evidence: string
  note?: string
}

const EXTRACTED_UPDATES: ExtractedUpdate[] = [
  {
    id: 'upd-mri',
    modality: 'MRI Lumbar',
    headline: 'MRI lumbar recommended — urgent',
    evidence:
      "that's a classic sign of something going on at the L4 or L5 level",
    note: 'Client asked to call PCP tomorrow to order MRI now.',
  },
  {
    id: 'upd-pt',
    modality: 'Physical Therapy',
    headline: 'PT recommended — CM to coordinate',
    evidence: 'First, I want to get that PT scheduled for you',
  },
  {
    id: 'upd-pip',
    modality: 'PIP Insurance',
    headline: 'PIP coverage noted — GEICO, basic NJ package',
    evidence: 'do you have PIP on your auto policy?',
  },
  {
    id: 'upd-er',
    modality: 'ER Visit',
    headline: 'ER completed — Robert Wood Johnson, CT cleared',
    evidence:
      'they took me to Robert Wood Johnson. I was there for like five hours.',
    note: 'Previously reported. Context confirmed on call.',
  },
]

type Owner = 'CM' | 'Client' | 'Provider'

interface ActionItem {
  id: string
  owner: Owner
  action: string
  due: string
}

const ACTION_ITEMS: ActionItem[] = [
  {
    id: 'act-pt',
    owner: 'CM',
    action: 'Schedule physical therapy and send confirmation',
    due: 'today',
  },
  {
    id: 'act-mri',
    owner: 'Client',
    action: 'Call PCP to request MRI be ordered now',
    due: 'tomorrow',
  },
  {
    id: 'act-adjuster',
    owner: 'Client',
    action: 'Do not speak with GEICO adjuster — direct to CM',
    due: 'ongoing',
  },
  {
    id: 'act-followup',
    owner: 'CM',
    action: 'Follow-up call with client',
    due: 'Friday',
  },
  {
    id: 'act-docs',
    owner: 'Client',
    action: 'Text/email PIP policy number, car damage photos, police report',
    due: 'tonight',
  },
]

// ---------------------------------------------------------------------------
// Multi-call data model
// ---------------------------------------------------------------------------

interface Call {
  id: string
  date: string // short human label (e.g. "Today · Apr 24", "Apr 21")
  dateSort: number // for ordering
  callType: string
  participants: string
  duration: string
  audioUrl: string | null
  transcript: CallPlayerSegment[]
  scores: CallScores
  extraDimensions?: ExtraDimension[] // CM-specific callouts
  isCurrent?: boolean // this is the CM call that drives audioPlaying/scored
}

const CALLS: Call[] = [
  {
    id: 'call-cm-intro',
    date: 'Today · Apr 24',
    dateSort: 20260424,
    callType: 'CM Intro Call',
    participants: 'Jess × Maria',
    duration: '3:51',
    audioUrl: '/audio/maria_cm_call.mp3',
    transcript: CM_CALL_SEGMENTS,
    scores: CM_CALL_SCORES,
    extraDimensions: EXTRA_DIMENSIONS,
    isCurrent: true,
  },
  {
    id: 'call-intake-triage',
    date: 'Apr 21',
    dateSort: 20260421,
    callType: 'Intake Triage',
    participants: 'Mark × Maria',
    duration: '2:45',
    audioUrl: '/audio/maria_intake_call1.mp3',
    transcript: INTAKE_TRIAGE_SEGMENTS,
    scores: INTAKE_TRIAGE_SCORES,
  },
  {
    id: 'call-initial',
    date: 'Apr 18',
    dateSort: 20260418,
    callType: 'Initial Triage',
    participants: 'Website intake',
    duration: '1:12',
    audioUrl: null,
    transcript: [],
    scores: INITIAL_TRIAGE_SCORES,
  },
]

// Newest-first; the default expanded row is CALLS[0].
const CALLS_SORTED = [...CALLS].sort((a, b) => b.dateSort - a.dateSort)

// ---------------------------------------------------------------------------
// Kanban states — before-call (no post-call extractions) vs. after-call
// ---------------------------------------------------------------------------

const PRE_CALL_EVENTS: TreatmentEvent[] = DEMO_EVENTS.map((e) => {
  if (e.id === 'evt-c-pt' || e.id === 'evt-l-pt' || e.id === 'evt-l-mri') {
    return null
  }
  return { ...e, autoExtractedFromCall: false }
}).filter((e): e is TreatmentEvent => e !== null)

const POST_CALL_EVENTS: TreatmentEvent[] = DEMO_EVENTS

const KANBAN_INJURIES: Injury[] = DEMO_INJURIES

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

const ROW_ORDER = [
  'information_capture',
  'compliance',
  'empathy',
  'call_progression',
] as const

type RowKey = (typeof ROW_ORDER)[number]

const ROW_LABELS: Record<RowKey, string> = {
  information_capture: 'Information capture',
  compliance: 'Compliance',
  empathy: 'Empathy',
  call_progression: 'Call progression',
}

function overallScore(scores: CallScores): number {
  return Math.round(
    ROW_ORDER.reduce((sum, k) => sum + scores[k].score, 0) / ROW_ORDER.length,
  )
}

function tierClasses(score: number): {
  bar: string
  text: string
  ring: string
} {
  if (score >= 90)
    return { bar: 'bg-ring/70', text: 'text-ring', ring: 'border-ring/40' }
  if (score >= 70)
    return {
      bar: 'bg-teal-400/70',
      text: 'text-teal-300',
      ring: 'border-teal-400/30',
    }
  if (score >= 50)
    return {
      bar: 'bg-amber-400/70',
      text: 'text-amber-300',
      ring: 'border-amber-400/30',
    }
  return {
    bar: 'bg-red-400/70',
    text: 'text-red-300',
    ring: 'border-red-400/30',
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CaseDemoDetail() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [scored, setScored] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)
  // Case id is hard-coded for the demo fixture (the route is /case-demo/INT-...).
  const demoCaseId = 'MAT-26042500001'
  const queueUserId = user?.uid || 'default'
  const initialQueued = useMemo(() => {
    if (typeof window === 'undefined') return false
    try {
      const raw = window.localStorage.getItem(`caos:queue:${queueUserId}:order`)
      if (!raw) return false
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.includes(demoCaseId)
    } catch {
      return false
    }
  }, [queueUserId])
  const [queued, setQueued] = useState(initialQueued)
  const [justAdded, setJustAdded] = useState(false)

  function handleAddToQueue() {
    if (queued) return
    try {
      const key = `caos:queue:${queueUserId}:order`
      const raw = window.localStorage.getItem(key)
      const existing: string[] = raw
        ? (() => {
            try {
              const parsed = JSON.parse(raw)
              return Array.isArray(parsed)
                ? parsed.filter((v): v is string => typeof v === 'string')
                : []
            } catch {
              return []
            }
          })()
        : []
      const next = [demoCaseId, ...existing.filter((id) => id !== demoCaseId)]
      window.localStorage.setItem(key, JSON.stringify(next))
      setQueued(true)
      setJustAdded(true)
      window.setTimeout(() => setJustAdded(false), 1400)
    } catch {
      /* swallow — localStorage may be disabled */
    }
  }

  const currentCall = CALLS_SORTED[0]
  if (!currentCall) return null

  const currentOverall = overallScore(currentCall.scores)

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-background text-foreground font-[Inter_Variable,Inter,system-ui] text-[13px] leading-[1.45]">
      {/* Section 1 — sticky header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1180px] px-6 py-5">
          {/* Breadcrumb */}
          <button
            type="button"
            onClick={() => navigate('/today')}
            className="mb-3 inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          >
            Caseload
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-foreground">Maria Santos</span>
          </button>

          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-card text-[14px] font-semibold text-foreground">
                MS
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h1 className="text-[18px] font-semibold text-foreground">
                    Maria Santos
                  </h1>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-[13px] text-foreground">MVA</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-[13px] text-foreground">NJ</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-mono text-[12px] text-muted-foreground">
                    MAT-26042500001
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-flex h-5 items-center rounded-full border border-[#5B8CFF]/20 bg-[#5B8CFF]/10 px-2 text-[11px] font-medium text-[#5B8CFF]">
                    Active Treatment
                  </span>
                  <DemoTrackChip />
                  <span
                    className="inline-flex h-5 items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 font-mono text-[10px] font-medium tracking-wider text-amber-300"
                    title="This page renders fixture data for Maria regardless of leadId."
                  >
                    DEMO
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/intake/INT-260212225483')}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Intake source
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <StatChip label="Days in pre-lit" value="1" />
              <StatChip label="Treatment events" value="7" />
              <StatChip label="Next action" value="Confirm MRI by tomorrow" wide />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddToQueue}
                disabled={queued}
                className={cn(
                  'h-7 gap-1.5 rounded-md border-border bg-card text-[12px] text-foreground hover:bg-ring/10',
                  justAdded && 'animate-pulse',
                )}
              >
                <ListPlus className="h-3.5 w-3.5" />
                {queued ? (justAdded ? 'Added' : 'Queued') : 'Add to queue'}
              </Button>
              <StatusChip scored={scored} audioPlaying={audioPlaying} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-6 py-6">
        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="calls">Calls · {CALLS_SORTED.length}</TabsTrigger>
            <TabsTrigger value="treatment">Treatment</TabsTrigger>
            <TabsTrigger value="updates">Updates</TabsTrigger>
          </TabsList>

          {/* Overview — at-a-glance summary across all sources */}
          <TabsContent value="overview">
            <CaseOverviewTab
              currentCall={currentCall}
              currentOverall={currentOverall}
              allCalls={CALLS_SORTED}
              postCallEvents={scored ? POST_CALL_EVENTS : PRE_CALL_EVENTS}
              injuries={KANBAN_INJURIES}
              actionItems={ACTION_ITEMS}
              redSignals={MARIA_CASE_FOR_RANKING.redSignals}
              nextAction={MARIA_CASE_FOR_RANKING.openAction ?? 'No open action'}
              daysSinceLastContact={1}
              slaCountdown="3h 14m"
              solCountdown="364d"
            />
          </TabsContent>

          {/* Calls — score hero + multi-call accordion */}
          <TabsContent value="calls" className="space-y-5">
        {/* Section 2 — Call Score hero (collapsible) */}
        <section className="mb-5">
          <CallScoreHero
            call={currentCall}
            overall={currentOverall}
            allCalls={CALLS_SORTED}
            audioPlaying={audioPlaying}
          />
        </section>

        {/* Section 3 — multi-call accordion stack */}
        <section className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>All calls on this case</SectionLabel>
            <span className="font-mono text-[11px] text-muted-foreground">
              {CALLS_SORTED.length} calls
            </span>
          </div>
          <CallStack
            calls={CALLS_SORTED}
            onCurrentComplete={() => setScored(true)}
            onCurrentPlayingChange={setAudioPlaying}
          />
        </section>
          </TabsContent>

          {/* Updates — post-call AI extracted updates + action items */}
          <TabsContent value="updates">

        {/* Section 4 — post-call AI output (updates + action items) */}
        <section className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>Post-call AI output</SectionLabel>
            {audioPlaying && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#5B8CFF]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5B8CFF]" />
                updating...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Col 1 — extracted treatment updates */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Auto-extracted treatment updates
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {EXTRACTED_UPDATES.length}
                </span>
              </div>
              <ul className="mt-3 space-y-3">
                {EXTRACTED_UPDATES.map((u, i) => (
                  <li
                    key={u.id}
                    className={cn(
                      'rounded-md border border-border bg-background p-3 transition-all',
                      audioPlaying && i === 0 && 'animate-live-ring',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex h-5 items-center rounded-full border border-[#5B8CFF]/25 bg-[#5B8CFF]/10 px-2 text-[11px] font-medium text-[#5B8CFF]">
                        {u.modality}
                      </span>
                      <span className="inline-flex h-5 items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Applied
                      </span>
                    </div>
                    <div className="mt-2 text-[13px] font-medium text-foreground">
                      {u.headline}
                    </div>
                    <blockquote className="mt-1.5 border-l-2 border-[#5B8CFF]/40 pl-2.5 text-[12px] italic text-muted-foreground">
                      &ldquo;{u.evidence}&rdquo;
                    </blockquote>
                    {u.note && (
                      <div className="mt-1.5 text-[11px] text-muted-foreground">
                        {u.note}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 2 — action items */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Action items
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {ACTION_ITEMS.length}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {ACTION_ITEMS.map((a, i) => (
                  <li
                    key={a.id}
                    className={cn(
                      'flex items-start gap-2.5 rounded-md border border-border bg-background p-2.5 transition-all',
                      audioPlaying && i === 0 && 'animate-live-ring',
                    )}
                  >
                    <OwnerBadge owner={a.owner} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] leading-[1.45] text-foreground">
                        {a.action}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        due {a.due}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
          </TabsContent>

          {/* Treatment — Kanban progression */}
          <TabsContent value="treatment">
        {/* Section 5 — treatment progression kanban (untouched) */}
        <section className="mb-4">
          <SectionLabel>Treatment progression</SectionLabel>
          <div className="rounded-lg border border-border bg-card">
            <TreatmentKanban
              key={scored ? 'post' : 'pre'}
              injuries={KANBAN_INJURIES}
              events={scored ? POST_CALL_EVENTS : PRE_CALL_EVENTS}
            />
          </div>
        </section>
          </TabsContent>
        </Tabs>

        {/* Section 6 — return link */}
        <div className="flex justify-center pb-8">
          <button
            type="button"
            onClick={() => navigate('/today')}
            className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Return to daily brief
          </button>
        </div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Call Score Hero
// ---------------------------------------------------------------------------

function CallScoreHero({
  call,
  overall,
  allCalls,
  audioPlaying,
}: {
  call: Call
  overall: number
  allCalls: Call[]
  audioPlaying: boolean
}) {
  const [open, setOpen] = useState(false)
  const tier = tierClasses(overall)

  // Trend chip: scores over time, oldest → newest.
  const trend = [...allCalls]
    .sort((a, b) => a.dateSort - b.dateSort)
    .map((c) => overallScore(c.scores))

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-card">
        {/* Collapsed banner body */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5 p-5">
          {/* Left: big score */}
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                'font-mono text-[40px] font-semibold leading-none tabular-nums',
                tier.text,
              )}
            >
              {overall}
            </span>
            <span className="font-mono text-[14px] text-muted-foreground">
              / 100
            </span>
          </div>

          {/* Middle: call meta + sparkline + trend chip */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {trend.length > 1 && <TrendChip values={trend} />}
              {audioPlaying && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[#5B8CFF]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5B8CFF]" />
                  scoring live
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="min-w-0 truncate text-[13px] font-medium text-foreground">
                {call.callType} · {call.duration} · {call.participants} ·{' '}
                {call.date.replace('Today · ', '')}
              </div>
              <DimensionSparkline scores={call.scores} />
            </div>
          </div>

          {/* Right: chevron toggle */}
          <CollapsibleTrigger
            render={
              <button
                type="button"
                aria-label={open ? 'Collapse score details' : 'Expand score details'}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform duration-150',
                    open && 'rotate-180',
                  )}
                />
              </button>
            }
          />
        </div>

        {/* Expanded detail panel — CSS max-height transition */}
        <CollapsibleContent
          className="overflow-hidden transition-[max-height] duration-300 ease-out data-[starting-style]:max-h-0 data-[ending-style]:max-h-0 data-[open]:max-h-[1600px] data-[closed]:max-h-0"
          keepMounted
        >
          <div className="border-t border-border p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {ROW_ORDER.map((key) => (
                <DimensionRow key={key} label={ROW_LABELS[key]} dim={call.scores[key]} />
              ))}
              {call.extraDimensions?.map((d) => (
                <DimensionRow
                  key={d.key}
                  label={d.label}
                  dim={{ score: d.score, evidence_quote: d.evidence }}
                />
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// Small inline SVG sparkline: 4 bars, one per dimension.
function DimensionSparkline({ scores }: { scores: CallScores }) {
  const values = ROW_ORDER.map((k) => scores[k].score)
  const width = 56
  const height = 18
  const barW = 10
  const gap = 4

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="shrink-0"
    >
      {values.map((v, i) => {
        const h = Math.max(2, Math.round((v / 100) * height))
        const x = i * (barW + gap)
        const y = height - h
        const fill =
          v >= 90 ? 'var(--ring)' : v >= 70 ? '#2dd4bf' : '#fbbf24'
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx={1}
            fill={fill}
            opacity={0.8}
          />
        )
      })}
    </svg>
  )
}

// Score-trend chip. `74 → 88 → 96 ↗`.
function TrendChip({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const first = values[0]
  const last = values[values.length - 1]
  if (first === undefined || last === undefined) return null
  const up = last > first
  const down = last < first

  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-full border border-border bg-background px-2">
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
        {values.join(' → ')}
      </span>
      {up && (
        <span className="inline-flex items-center gap-0.5 text-emerald-300">
          <TrendingUp className="h-3 w-3" />
        </span>
      )}
      {down && (
        <span className="text-[11px] text-amber-300">↘</span>
      )}
    </span>
  )
}

// One dimension row inside the expanded hero: label, score, progress, quote,
// and a per-dimension "Why this score?" Collapsible.
function DimensionRow({
  label,
  dim,
}: {
  label: string
  dim: { score: number; evidence_quote: string }
}) {
  const [why, setWhy] = useState(false)
  const tier = tierClasses(dim.score)

  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <span
          className={cn(
            'font-mono text-[12px] font-semibold tabular-nums',
            tier.text,
          )}
        >
          {dim.score}
        </span>
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

      <Collapsible open={why} onOpenChange={setWhy}>
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="mt-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {why ? 'Hide reasoning' : 'Why this score?'}
            </button>
          }
        />
        <CollapsibleContent
          className="overflow-hidden transition-[max-height] duration-200 ease-out data-[open]:max-h-64 data-[closed]:max-h-0"
          keepMounted
        >
          <div className="mt-2 rounded-md border border-border bg-ring/10 p-2.5 text-[12px] text-foreground">
            Score reflects how fully the rep hit this rubric dimension.
            Deductions apply for missed required fields, skipped disclosures,
            or tone mismatches. See rubric v8 for full weighting.
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Call Stack (accordion of all calls)
// ---------------------------------------------------------------------------

function CallStack({
  calls,
  onCurrentComplete,
  onCurrentPlayingChange,
}: {
  calls: Call[]
  onCurrentComplete: () => void
  onCurrentPlayingChange: (playing: boolean) => void
}) {
  // Default-expanded: the first (newest) call.
  const firstId = calls[0]?.id
  const defaultValue = firstId ? [firstId] : []

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Accordion defaultValue={defaultValue}>
        {calls.map((c, i) => {
          const overall = overallScore(c.scores)
          const tier = tierClasses(overall)
          const isFirst = i === 0

          return (
            <AccordionItem
              key={c.id}
              value={c.id}
              className={cn(
                'border-b border-border last:border-b-0',
                isFirst && 'bg-ring/5',
              )}
            >
              <AccordionTrigger
                className={cn(
                  'h-14 items-center px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-background/40 hover:no-underline',
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {c.date}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="truncate text-foreground">{c.callType}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {c.duration}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{c.participants}</span>
                  <span className="ml-auto inline-flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground">
                      Score
                    </span>
                    <span
                      className={cn(
                        'font-mono text-[13px] font-semibold tabular-nums',
                        tier.text,
                      )}
                    >
                      {overall}
                    </span>
                  </span>
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-4">
                <CallRowContent
                  call={c}
                  onComplete={c.isCurrent ? onCurrentComplete : undefined}
                  onPlayingChange={
                    c.isCurrent ? onCurrentPlayingChange : undefined
                  }
                />
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}

function CallRowContent({
  call,
  onComplete,
  onPlayingChange,
}: {
  call: Call
  onComplete?: () => void
  onPlayingChange?: (playing: boolean) => void
}) {
  return (
    <div className="space-y-4 pb-4">
      {call.audioUrl ? (
        <CallPlayer
          src={call.audioUrl}
          title={`${call.callType} · ${call.duration} · ${call.participants}`}
          durationLabel={call.duration}
          segments={call.transcript}
          onComplete={onComplete}
          onPlayingChange={onPlayingChange}
          className="h-[420px]"
        />
      ) : (
        <div className="rounded-md border border-dashed border-border bg-background p-6 text-center">
          <div className="text-[12px] text-muted-foreground">
            No audio recording available for this call.
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground/80">
            Score card below is reconstructed from legacy notes.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {ROW_ORDER.map((key) => (
          <DimensionRow
            key={key}
            label={ROW_LABELS[key]}
            dim={call.scores[key]}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  )
}

function StatChip({
  label,
  value,
  wide,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col justify-center rounded-md border border-border bg-card px-3 py-1.5',
        wide ? 'max-w-[220px]' : 'min-w-[110px]',
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          'truncate text-[13px] font-semibold text-foreground',
          wide && 'text-[12px] font-medium',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function StatusChip({
  scored,
  audioPlaying,
}: {
  scored: boolean
  audioPlaying: boolean
}) {
  const state = scored ? 'complete' : audioPlaying ? 'live' : 'ready'

  return (
    <div
      className={cn(
        'ml-2 inline-flex h-7 items-center gap-2 rounded-full border px-2.5 transition-colors',
        state === 'complete' && 'border-emerald-400/20 bg-emerald-400/10',
        state === 'live' && 'border-emerald-400/30 bg-emerald-400/10',
        state === 'ready' && 'border-border bg-card',
      )}
    >
      {state === 'complete' && (
        <>
          <CheckCircle2 className="h-3 w-3 text-emerald-300" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-300">
            Scoring complete — 96 / 100
          </span>
        </>
      )}
      {state === 'live' && (
        <>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-300">
            Live · scoring in real time
          </span>
        </>
      )}
      {state === 'ready' && (
        <>
          <Pause className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Ready
          </span>
        </>
      )}

      <style>{`@keyframes cp-live-ring {
        0%,100% { box-shadow: 0 0 0 0 rgba(91, 140, 255, 0); }
        50% { box-shadow: 0 0 0 1px rgba(91, 140, 255, 0.45); }
      }
      .animate-live-ring { animation: cp-live-ring 1.8s ease-in-out infinite; }`}</style>
    </div>
  )
}

function OwnerBadge({ owner }: { owner: Owner }) {
  const style =
    owner === 'CM'
      ? 'bg-[#5B8CFF]/10 text-[#5B8CFF] border-[#5B8CFF]/25'
      : owner === 'Client'
        ? 'bg-amber-400/10 text-amber-300/90 border-amber-400/20'
        : 'bg-teal-400/10 text-teal-300/90 border-teal-400/20'
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[10px] font-medium uppercase tracking-wider',
        style,
      )}
    >
      {owner}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Overview tab — at-a-glance summary across all sources
// ---------------------------------------------------------------------------

interface CaseOverviewTabProps {
  currentCall: Call
  currentOverall: number
  allCalls: Call[]
  postCallEvents: TreatmentEvent[]
  injuries: Injury[]
  actionItems: ActionItem[]
  redSignals: string[]
  nextAction: string
  daysSinceLastContact: number
  slaCountdown: string | null
  solCountdown: string | null
}

function CaseOverviewTab({
  currentCall,
  currentOverall,
  allCalls,
  postCallEvents,
  injuries,
  actionItems,
  redSignals,
  nextAction,
  daysSinceLastContact,
  slaCountdown,
  solCountdown,
}: CaseOverviewTabProps) {
  const tier = tierClasses(currentOverall)
  const trackInfo = resolveCaseTrack(MARIA_CASE_FOR_RANKING, 'default')

  const upcomingEvents = postCallEvents
    .filter((e) => e.status === 'scheduled' && e.scheduledDate)
    .sort((a, b) =>
      String(a.scheduledDate).localeCompare(String(b.scheduledDate)),
    )
    .slice(0, 3)

  const pendingOrder = postCallEvents
    .filter((e) => e.status === 'recommended')
    .slice(0, 3)

  // Top 3 action items — owner=CM first (we drive those), then Client.
  const topActions = [...actionItems]
    .sort((a, b) => ownerWeight(b.owner) - ownerWeight(a.owner))
    .slice(0, 3)

  // Score trend across all calls.
  const trend = [...allCalls]
    .sort((a, b) => a.dateSort - b.dateSort)
    .map((c) => overallScore(c.scores))

  return (
    <div className="space-y-4">
      {/* HERO — track + reason + next action */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <TrackChip info={trackInfo} />
          {redSignals.length > 0 &&
            redSignals.slice(0, 2).map((sig) => (
              <span
                key={sig}
                className="inline-flex h-6 items-center gap-1 rounded-full border border-amber-700/40 bg-amber-900/20 px-2 text-[11px] text-amber-300"
              >
                <AlertTriangle className="h-3 w-3" />
                {sig}
              </span>
            ))}
          {slaCountdown && (
            <span className="inline-flex h-6 items-center gap-1 rounded-full border border-red-700/40 bg-red-900/20 px-2 text-[11px] text-red-300">
              <Clock className="h-3 w-3" />
              SLA {slaCountdown}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Next action
          </span>
          <span className="text-[14px] font-medium text-foreground">
            {nextAction}
          </span>
        </div>
      </div>

      {/* TWO-COLUMN BODY */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left col (2/3) */}
        <div className="space-y-4 lg:col-span-2">
          {/* Latest call summary */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Latest call
              </span>
              <span className="text-[11px] text-muted-foreground">
                {currentCall.callType} · {currentCall.date}
              </span>
            </div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      'font-mono text-[40px] font-semibold leading-none tabular-nums',
                      tier.text,
                    )}
                  >
                    {currentOverall}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    / 100
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {currentCall.participants} · {currentCall.duration}
                </div>
              </div>
              {trend.length > 1 && <TrendChip values={trend} />}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DimMini label="Info" score={currentCall.scores.information_capture.score} />
              <DimMini label="Compliance" score={currentCall.scores.compliance.score} />
              <DimMini label="Empathy" score={currentCall.scores.empathy.score} />
              <DimMini label="Progression" score={currentCall.scores.call_progression.score} />
            </div>
          </div>

          {/* Treatment phase strip — per-injury */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Treatment phase by injury
            </div>
            <ul className="space-y-2">
              {injuries.map((inj) => (
                <li key={inj.id} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-[12px] capitalize text-foreground">
                    {inj.bodyRegion.replace(/_/g, ' ')}
                  </span>
                  <PhaseBar phase={inj.currentPhase} />
                  <span className="w-24 shrink-0 text-right text-[11px] capitalize text-muted-foreground">
                    {inj.currentPhase.replace(/_/g, ' ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Open scheduling */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Open scheduling
              </span>
              <span className="text-[11px] text-muted-foreground">
                {upcomingEvents.length} scheduled · {pendingOrder.length} pending order
              </span>
            </div>
            {upcomingEvents.length + pendingOrder.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                Nothing pending — case is clear.
              </p>
            ) : (
              <ul className="space-y-1.5 text-[12px]">
                {upcomingEvents.map((e) => (
                  <li key={e.id} className="flex items-center justify-between">
                    <span className="text-foreground">{e.name ?? e.modality}</span>
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <span className="inline-flex h-5 items-center rounded-full border border-sky-700/40 bg-sky-900/30 px-1.5 text-[10px] text-sky-300">
                        Scheduled
                      </span>
                      <span className="font-mono">{e.scheduledDate}</span>
                    </span>
                  </li>
                ))}
                {pendingOrder.map((e) => (
                  <li key={e.id} className="flex items-center justify-between">
                    <span className="text-foreground">{e.name ?? e.modality}</span>
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <span className="inline-flex h-5 items-center rounded-full border border-amber-700/40 bg-amber-900/30 px-1.5 text-[10px] text-amber-300">
                        Pending order
                      </span>
                      {e.providerName && (
                        <span className="font-mono">{e.providerName}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right col (1/3) — actions + clocks */}
        <div className="space-y-4 lg:col-span-1">
          {/* Top action items */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Top actions
            </div>
            <ul className="space-y-2 text-[12px]">
              {topActions.map((a) => (
                <li key={a.id} className="flex items-start gap-2">
                  <OwnerBadge owner={a.owner} />
                  <div className="min-w-0 flex-1">
                    <div className="leading-snug text-foreground">{a.action}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      due {a.due}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Clocks */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Clocks
            </div>
            <dl className="space-y-2 text-[12px]">
              {slaCountdown && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">SLA</dt>
                  <dd className="font-mono text-red-300">{slaCountdown}</dd>
                </div>
              )}
              {solCountdown && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Statute of limitations</dt>
                  <dd className="font-mono text-foreground">{solCountdown}</dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Days since contact</dt>
                <dd className="font-mono text-foreground">{daysSinceLastContact}d</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Calls on case</dt>
                <dd className="font-mono text-foreground">{allCalls.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Injuries tracked</dt>
                <dd className="font-mono text-foreground">{injuries.length}</dd>
              </div>
            </dl>
          </div>

          {/* Risk flags */}
          {redSignals.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Risk flags
              </div>
              <ul className="space-y-1.5 text-[12px]">
                {redSignals.map((s) => (
                  <li key={s} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
                    <span className="text-foreground">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ownerWeight(o: Owner): number {
  return o === 'CM' ? 3 : o === 'Client' ? 2 : 1
}

function DimMini({ label, score }: { label: string; score: number }) {
  const tier = tierClasses(score)
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn('font-mono text-[11px] tabular-nums', tier.text)}>
          {score}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-border">
        <div
          className={cn('h-full rounded-full', tier.bar)}
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </div>
    </div>
  )
}

const PHASE_ORDER = ['conservative', 'imaging', 'pain_mgmt', 'surgical', 'mmi'] as const

function PhaseBar({ phase }: { phase: string }) {
  const idx = PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number])
  return (
    <div className="flex flex-1 items-center gap-1">
      {PHASE_ORDER.map((p, i) => (
        <div
          key={p}
          className={cn(
            'h-1.5 flex-1 rounded-full',
            idx >= 0 && i <= idx ? 'bg-sky-500/70' : 'bg-border',
          )}
          title={p.replace(/_/g, ' ')}
        />
      ))}
    </div>
  )
}

// Maria's case shape for the track resolver. Mirrors the EXTRA_DEMO_CASES
// fixture in CallQueue so overrides set on the queue page reflect here.
const MARIA_CASE_FOR_RANKING: CaseForRanking = {
  id: 'CASE-MARIA-SANTOS',
  clientName: 'Maria Santos',
  caseType: 'MVA',
  estValue: 150_000,
  slaDeadline: null,
  lastContactAt: null,
  lastTreatmentEventAt: null,
  redSignals: ['Awaiting MRI authorization', 'Client hesitation on last call'],
  openAction: 'Confirm MRI scheduling',
  verdict: 'PURSUE-HARD',
}

function DemoTrackChip() {
  const { user } = useAuth()
  const userKey = user?.uid || 'default'
  const [open, setOpen] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    function bump() { setRevision((r) => r + 1) }
    window.addEventListener('caos:track-override', bump)
    return () => window.removeEventListener('caos:track-override', bump)
  }, [])

  void revision
  const info = resolveCaseTrack(MARIA_CASE_FOR_RANKING, userKey)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="outline-none"
            title={info.isManualOverride ? `Set by CM: ${info.reason}` : `AI-derived: ${info.reason}`}
          >
            <TrackChip info={info} />
          </button>
        }
      />
      <PopoverContent align="start" className="w-auto p-2">
        <TrackPicker
          caseId={MARIA_CASE_FOR_RANKING.id}
          userKey={userKey}
          current={info}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
