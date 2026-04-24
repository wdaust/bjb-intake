import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Pause,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CallPlayer } from '@/components/case/CallPlayer'
import type { CallPlayerSegment } from '@/components/case/CallPlayer'
import { CallScoreCard } from '@/components/intake/CallScoreCard'
import type { CallScores } from '@/components/intake/CallScoreCard'
import { TreatmentKanban } from '@/components/treatment/TreatmentKanban'
import {
  DEMO_INJURIES,
  DEMO_EVENTS,
} from '@/components/treatment/TreatmentKanban'
import type { TreatmentEvent, Injury } from '@/lib/treatmentUtils'

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

// ---------------------------------------------------------------------------
// Post-call AI artifacts
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
  // The four-field CallScores type doesn't have treatment_coordination /
  // next_step_clarity slots, so we surface those as separate highlight
  // rows below. The top card keeps parity with the intake-side design.
  call_progression: {
    score: 100,
    evidence_quote:
      "Here's what I'm going to do today: get PT scheduled, send confirmation...",
  },
}

interface ExtraDimension {
  key: string
  label: string
  score: number
  evidence: string
}

// Treatment coordination + next-step clarity — the two dimensions the CM
// rubric adds on top of the shared four. We render them inline under the
// CallScoreCard so every rubric callout from the brief shows up.
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
// Kanban states — before-call (no post-call extractions) vs. after-call
// ---------------------------------------------------------------------------

const PRE_CALL_EVENTS: TreatmentEvent[] = DEMO_EVENTS.map((e) => {
  // Before the Jess call, the post-call PT recs have not been extracted yet.
  // Drop the lumbar MRI + the AI-tagged PT entries to show the base state.
  if (e.id === 'evt-c-pt' || e.id === 'evt-l-pt' || e.id === 'evt-l-mri') {
    return null
  }
  return { ...e, autoExtractedFromCall: false }
}).filter((e): e is TreatmentEvent => e !== null)

const POST_CALL_EVENTS: TreatmentEvent[] = DEMO_EVENTS

const KANBAN_INJURIES: Injury[] = DEMO_INJURIES

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CaseDemoDetail() {
  const navigate = useNavigate()
  const [scored, setScored] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)

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

              {/* State-aware status chip: Ready → Live → Complete */}
              <StatusChip scored={scored} audioPlaying={audioPlaying} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-6 py-6">
        {/* Section 2 — CM call player */}
        <section className="mb-4">
          <SectionLabel>Case manager intro call</SectionLabel>
          <CallPlayer
            src="/audio/maria_cm_call.mp3"
            title="CM Intro Call · 3:51 · Jess Martin × Maria Santos"
            durationLabel="3:51"
            segments={CM_CALL_SEGMENTS}
            onComplete={() => setScored(true)}
            onPlayingChange={setAudioPlaying}
            className="h-[480px]"
          />
        </section>

        {/* Section 3 — post-call AI output (always rendered at full opacity) */}
        <section className="mb-4">
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>Post-call AI output</SectionLabel>
            {/* Subtle "updating..." indicator next to the Call Score header */}
            {audioPlaying && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#5B8CFF]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5B8CFF]" />
                updating...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Col 1 — call score */}
            <div className="space-y-4">
              <CallScoreCard scores={CM_CALL_SCORES} />
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  CM-specific dimensions
                </div>
                <div className="mt-3 space-y-3">
                  {EXTRA_DIMENSIONS.map((d) => (
                    <ExtraRow key={d.key} d={d} />
                  ))}
                </div>
              </div>
            </div>

            {/* Col 2 — extracted treatment updates */}
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

            {/* Col 3 — action items */}
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

        {/* Section 4 — treatment progression kanban */}
        <section className="mb-4">
          <SectionLabel>Treatment progression</SectionLabel>
          <div className="rounded-lg border border-border bg-card">
            {/* Remount the kanban when state flips so new AI-tinted cards
                get animated in via a key change. */}
            <TreatmentKanban
              key={scored ? 'post' : 'pre'}
              injuries={KANBAN_INJURIES}
              events={scored ? POST_CALL_EVENTS : PRE_CALL_EVENTS}
            />
          </div>
        </section>

        {/* Section 5 — return link */}
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
// Small pieces
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
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

// State-aware chip. Before play → neutral "Ready" with pause icon. While
// audio playing → pulsing green dot + "LIVE · scoring in real time". After
// audio ends → green check + "Scoring complete — 96 / 100". Also injects
// the keyframes for the subtle "animate-live-ring" applied to the newest
// item card while audio is playing.
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

      {/* Keyframes for the subtle 1px border-ring animation on the newest
          item while audio is playing. Inline <style> keeps this page
          self-contained rather than polluting global CSS. */}
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

function ExtraRow({ d }: { d: ExtraDimension }) {
  const tier =
    d.score >= 90
      ? { bar: 'bg-[#5B8CFF]/70', text: 'text-[#5B8CFF]' }
      : d.score >= 70
        ? { bar: 'bg-teal-400/70', text: 'text-teal-300' }
        : { bar: 'bg-amber-400/70', text: 'text-amber-300' }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {d.label}
        </div>
        <span
          className={cn(
            'font-mono text-[12px] font-semibold tabular-nums',
            tier.text,
          )}
        >
          {d.score}
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border">
        <div
          className={cn('h-full rounded-full transition-all', tier.bar)}
          style={{ width: `${Math.max(2, Math.min(100, d.score))}%` }}
        />
      </div>
      <blockquote className="mt-2 border-l-2 border-[#5B8CFF]/40 pl-3 text-[12px] italic text-muted-foreground">
        &ldquo;{d.evidence}&rdquo;
      </blockquote>
    </div>
  )
}
