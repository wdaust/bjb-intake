import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Phone,
  FileSignature,
  CalendarPlus,
  ArrowUpRightFromSquare,
  XCircle,
  Play,
  FileAudio,
  ArrowLeft,
  PhoneOff,
  Clock,
  CheckCircle2,
  User,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  initials,
  relativeTime,
  slaDisplay,
  verdictStyle,
  tierStyle,
} from '@/lib/intakeUtils'
import { CallScoreCard } from '@/components/intake/CallScoreCard'
import type { CallScores } from '@/components/intake/CallScoreCard'
import type { ReasoningBullet } from '@/components/intake/VerdictCard'
import { TranscriptViewer } from '@/components/intake/TranscriptViewer'
import type { TranscriptSegment } from '@/components/intake/TranscriptViewer'
import { AgreementCard } from '@/components/intake/AgreementCard'
import type { AgreementStatus } from '@/components/intake/AgreementCard'
import { AppointmentScheduler } from '@/components/intake/AppointmentScheduler'
import type { BookedState, CmOption } from '@/components/intake/AppointmentScheduler'
import { MOCK_LEADS } from '@/pages/IntakeQueue'
import type { IntakeLead } from '@/pages/IntakeQueue'

// ---------------------------------------------------------------------------
// Lead-phase state + mock fixtures
// ---------------------------------------------------------------------------

type LeadPhase = 'before_call' | 'during_call' | 'scored'

interface TimelineEvent {
  ts: string
  kind: 'intake' | 'call' | 'agreement_sent' | 'agreement_signed' | 'appointment' | 'cm_assigned'
  label: string
  detail?: string
}

interface ExtractedFacts {
  incidentDate: string | null
  incidentVenue: string | null
  defendant: string | null
  commercialDefendant: boolean | null
  erVisit: boolean | null
  erFacility: string | null
  policeReport: string | null
  witnesses: { name: string; phone?: string }[]
  clientInsurance: string | null
  priorRepresentation: boolean | null
  narrative: string | null
}

// Maria Santos — golden-set intake. Full fixture lives here so the demo runs
// with zero network calls.
const MARIA_FIXTURE = {
  phase: 'scored' as LeadPhase,
  verdict: {
    verdict: 'PURSUE-HARD',
    valueTier: 'HIGH' as const,
    opportunityScore: 88,
    confidence: '87% · High',
    estValueRange: '$75K-$250K',
    narrative:
      'Clear-liability commercial-defendant rear-end in NJ with same-day ER visit, documented cervical-spine complaints, and no prior representation. Venue is plaintiff-favorable and policy limits likely exceed $100K. File immediately; the 2-year statute is unambiguous and treatment momentum is strong.',
    reasoningBullets: [
      {
        tag: 'DECISION',
        text: 'Liability is near-admitted: rear-end impact at a stop-controlled intersection, police on scene, and the at-fault driver admitted to looking at his phone.',
      },
      {
        tag: 'FIT',
        text: 'Commercial defendant (ABC Delivery truck, DOT-regulated) means higher policy limits and a solvent target — well within our retention criteria.',
      },
      {
        tag: 'SIGNAL',
        text: 'Same-day ER visit at Hackensack UMC with documented neck and low-back pain establishes a clean causation chain with no pre-existing comorbidities volunteered.',
      },
      {
        tag: 'RISK',
        text: 'Client mentioned a 2019 minor fender-bender; need to pull prior MVA records early to neutralize a defense-side causation argument.',
      },
      {
        tag: 'ACTION',
        text: 'Send engagement now, calendar the intro call with Jess within 48h, and open the PIP claim with GEICO before end of week.',
      },
    ] as ReasoningBullet[],
    greenSignals: [
      'Clear liability',
      'Commercial defendant',
      'Same-day ER',
      'No prior rep',
      'Within SOL',
    ],
    redSignals: ['Prior 2019 MVA (minor)'],
    keyLiabilityFacts: [
      'Rear-ended while stopped at a red light on Route 17 southbound at 3:42pm.',
      'At-fault driver (ABC Delivery truck, commercial plates) admitted inattention at the scene.',
      'Bergen County PD responded; officer issued a citation for careless driving (NJSA 39:4-97).',
      'Dashcam footage from a passing vehicle may corroborate — client has a lead on it.',
    ],
    keyDamagesFacts: [
      'Same-day ER at Hackensack UMC: neck strain, thoracic contusion, LBP radiating to left leg.',
      'CT scan ordered, cleared for concussion; discharged with muscle relaxants and PT referral.',
      'Has not yet started PT as of call date — high priority to route to in-network provider.',
      'Missed 4 days of work (teacher, Bergen County school district); documenting lost wages.',
    ],
    weaknessesRisks: [
      '2019 rear-end incident; need to confirm no overlapping body parts or ongoing care.',
      'Vehicle is still drivable — visible damages lower than pure total-loss comps.',
      'No witness contact info captured yet; 48h window to lock it before memories fade.',
    ],
    recommendedNextAction:
      'Send engagement agreement today; book Jess for intro Monday 11 AM; file PIP with GEICO and request police report within 48h.',
  },
  scores: {
    information_capture: {
      score: 94,
      evidence_quote:
        'Mark captured incident date, venue, defendant details, injuries, and ER facility in the first 8 minutes.',
      missed_items: ['Witness phone numbers'],
    },
    compliance: {
      score: 100,
      evidence_quote:
        'All required disclosures delivered verbatim: recording notice, no-fee-unless-recovery, conflict check.',
    },
    empathy: {
      score: 80,
      evidence_quote:
        '"I\'m so sorry you\'re dealing with this — let\'s take this at your pace." Solid warmth, but missed one acknowledgement when Maria mentioned her kids.',
      issues: ['One missed empathy beat near 08:42'],
    },
    call_progression: {
      score: 90,
      evidence_quote:
        'Followed the script cleanly from opening through closing; only one mid-call tangent (insurance history) which was recovered well.',
    },
  } as CallScores,
  transcript: buildMariaTranscript(),
  extractedFacts: {
    incidentDate: '2026-04-14',
    incidentVenue: 'Route 17 southbound, Bergen County, NJ',
    defendant: 'ABC Delivery truck driver (commercial plates)',
    commercialDefendant: true,
    erVisit: true,
    erFacility: 'Hackensack UMC',
    policeReport: 'Bergen County PD, case #BCPD-2026-04144',
    witnesses: [{ name: 'Unknown dashcam driver (lead pending)' }],
    clientInsurance: 'GEICO (full PIP coverage)',
    priorRepresentation: false,
    narrative:
      'Rear-ended while stopped at red light by ABC Delivery truck. Driver admitted phone use. Same-day ER at Hackensack UMC with neck/back complaints. Teacher, missed 4 days work.',
  } as ExtractedFacts,
  agreement: {
    status: 'signed' as AgreementStatus,
    sentAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    viewedAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
    signedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    signerPhone: '(201) 555-0142',
  },
  appointment: {
    booked: true,
    cmUserId: 'u_jess',
    cmName: 'Jess Martin',
    scheduledTs: nextMondayAt11().toISOString(),
  },
}

// Module-scope "now" anchor so the page renders deterministically (and
// renders are pure). Computed once when this module is first imported.
const PAGE_LOAD_MS = Date.now()

function nextMondayAt11(): Date {
  const d = new Date()
  const day = d.getDay()
  const add = ((1 + 7 - day) % 7) || 7
  d.setDate(d.getDate() + add)
  d.setHours(11, 0, 0, 0)
  return d
}

function buildMariaTranscript(): TranscriptSegment[] {
  // 28 segments of the Mark+Maria intake call. Kept concise but
  // representative of the golden-set conversation shape.
  return [
    { speaker: 'CM', start: 0, end: 6, text: 'Hi Maria, this is Mark from Bender Jewell Brach. Thanks for reaching out today. I just want to confirm you\'re okay with me recording this conversation for our records?' },
    { speaker: 'CLIENT', start: 6, end: 9, text: 'Yes, that\'s fine.' },
    { speaker: 'CM', start: 9, end: 18, text: 'Great. And before we get into it, I want you to know — there\'s no fee to you unless we recover on your case. Zero out of pocket. Okay? Tell me what happened.' },
    { speaker: 'CLIENT', start: 18, end: 45, text: 'Okay, so last Tuesday, the 14th, I was driving home from school — I teach fourth grade in Paramus — and I was stopped at a red light on Route 17, and this truck just plowed into the back of me. Hard. My head snapped forward and back.' },
    { speaker: 'CM', start: 45, end: 52, text: 'I\'m so sorry you\'re dealing with this. That sounds really scary. Did you see what kind of truck it was?' },
    { speaker: 'CLIENT', start: 52, end: 68, text: 'Yeah, it was one of those ABC Delivery trucks. Big one. The driver got out and he was kind of panicked, said he was looking at his phone and didn\'t see me stop.' },
    { speaker: 'CM', start: 68, end: 74, text: 'He told you, at the scene, that he was looking at his phone?' },
    { speaker: 'CLIENT', start: 74, end: 77, text: 'Yes. Twice, actually.' },
    { speaker: 'CM', start: 77, end: 82, text: 'That\'s important. Did the police come?' },
    { speaker: 'CLIENT', start: 82, end: 98, text: 'Yeah, Bergen County. The officer gave him a ticket for careless driving. I have the report number somewhere — BCPD-2026-04144, I think.' },
    { speaker: 'CM', start: 98, end: 105, text: 'Perfect, I\'ve got that written down. Any witnesses stick around?' },
    { speaker: 'CLIENT', start: 105, end: 120, text: 'There was a guy behind me with a dashcam, said he\'d be willing to share it, but I only got his first name — Tom. He gave me a number but I lost the napkin.' },
    { speaker: 'CM', start: 120, end: 128, text: 'Let\'s see if we can track him down. Did you go to the hospital afterward?' },
    { speaker: 'CLIENT', start: 128, end: 146, text: 'Yeah, I went straight to Hackensack UMC. They did a CT scan, thank god nothing was bleeding in my head, but my neck and lower back are killing me, especially the left side going down my leg.' },
    { speaker: 'CM', start: 146, end: 154, text: 'They discharged you the same day? Any prescriptions, PT referral?' },
    { speaker: 'CLIENT', start: 154, end: 166, text: 'Muscle relaxers, and they said I should do physical therapy, but I haven\'t started yet. I don\'t know who to go to and I\'ve been nervous about the cost.' },
    { speaker: 'CM', start: 166, end: 178, text: 'Don\'t worry about the cost — we work with in-network providers who don\'t bill you up front. I\'ll have our case manager Jess help you get that set up this week.' },
    { speaker: 'CLIENT', start: 178, end: 181, text: 'Oh, thank you. That\'s a huge relief.' },
    { speaker: 'CM', start: 181, end: 191, text: 'Have you missed any work because of this? You mentioned you teach fourth grade.' },
    { speaker: 'CLIENT', start: 191, end: 203, text: 'Four days so far. I used sick leave. The principal has been great but my back still hurts when I sit too long.' },
    { speaker: 'CM', start: 203, end: 210, text: 'We\'ll document all of that. Are you the only driver on your insurance, and do you have PIP coverage?' },
    { speaker: 'CLIENT', start: 210, end: 220, text: 'It\'s me and my husband, GEICO. I think we have full PIP, my husband handles that stuff.' },
    { speaker: 'CM', start: 220, end: 228, text: 'Perfect. One more question — have you ever been in another accident or had a prior injury claim?' },
    { speaker: 'CLIENT', start: 228, end: 244, text: 'Years ago, 2019 maybe, someone bumped me at a stop sign. Nothing serious, didn\'t go to the doctor, didn\'t hire a lawyer. It was like a fender bender.' },
    { speaker: 'CM', start: 244, end: 253, text: 'Good, that\'s fine. And nobody else has called you about this case — no other attorneys, no insurance adjusters pressuring you to settle?' },
    { speaker: 'CLIENT', start: 253, end: 258, text: 'No, you\'re the first. Their adjuster called but I didn\'t say anything.' },
    { speaker: 'CM', start: 258, end: 272, text: 'Smart. Don\'t talk to them again — send them to us. Here\'s what I\'m going to do next: I\'m sending you an engagement agreement in the next hour to the email you gave us. Once you sign that, Jess will call you Monday at 11 AM to walk through your treatment plan.' },
    { speaker: 'CLIENT', start: 272, end: 274, text: 'Okay, that works.' },
    { speaker: 'CM', start: 274, end: 283, text: 'Great. Hang in there, Maria. We\'ll take care of this — you just focus on feeling better.' },
  ]
}

const CM_OPTIONS: CmOption[] = [
  {
    id: 'u_jess',
    name: 'Jess Martin',
    availableSlots: nextWeekSlots(1, ['09:00', '10:00', '11:00', '14:00']),
  },
  {
    id: 'u_cassandra',
    name: 'Cassandra Spanato',
    availableSlots: nextWeekSlots(2, ['09:30', '13:00', '15:30']),
  },
  {
    id: 'u_jordan',
    name: 'Jordan Reyes',
    availableSlots: nextWeekSlots(0, ['10:30', '12:00', '16:00']),
  },
]

function nextWeekSlots(dayOffset: number, times: string[]): string[] {
  const base = new Date()
  base.setDate(base.getDate() + dayOffset + 1)
  const out: string[] = []
  for (let i = 0; i < 5; i++) {
    const day = new Date(base)
    day.setDate(base.getDate() + i)
    for (const t of times) {
      const parts = t.split(':')
      const h = Number(parts[0] ?? 9)
      const m = Number(parts[1] ?? 0)
      day.setHours(h, m, 0, 0)
      out.push(day.toISOString())
    }
  }
  return out
}

const CHECKLIST_ITEMS = [
  { section: 'Opening', items: ['Recording consent', 'No-fee disclosure', 'Confirm caller identity'] },
  { section: 'Incident', items: ['Date & time', 'Location / venue', 'Vehicle + defendant details', 'Commercial vs personal'] },
  { section: 'Liability', items: ['Sequence of events', 'Admissions', 'Police report #', 'Witnesses'] },
  { section: 'Damages', items: ['ER visit & facility', 'Imaging / diagnosis', 'Ongoing symptoms', 'Missed work'] },
  { section: 'Coverage', items: ['Client insurance', 'PIP', 'UM/UIM', 'Prior MVA history'] },
  { section: 'Closing', items: ['No prior rep', 'No adjuster statements', 'Next steps explained'] },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntakeDetail() {
  const { leadId } = useParams<{ leadId: string }>()
  const navigate = useNavigate()

  const lead: IntakeLead | undefined = useMemo(
    () => MOCK_LEADS.find((l) => l.id === leadId) ?? MOCK_LEADS[0],
    [leadId],
  )

  // Maria's lead is wired to the full fixture; any other lead starts in
  // `before_call` and uses the sparser stub.
  const isMaria = lead?.name === 'Maria Santos'
  const [phase, setPhase] = useState<LeadPhase>(
    isMaria ? MARIA_FIXTURE.phase : 'before_call',
  )

  const [agreementStatus, setAgreementStatus] = useState<AgreementStatus>(
    isMaria ? MARIA_FIXTURE.agreement.status : 'not_sent',
  )

  const initialBooking: BookedState | null = isMaria
    ? {
        cmUserId: MARIA_FIXTURE.appointment.cmUserId,
        cmName: MARIA_FIXTURE.appointment.cmName,
        scheduledTs: MARIA_FIXTURE.appointment.scheduledTs,
      }
    : null
  const [booking, setBooking] = useState<BookedState | null>(initialBooking)

  const [highlightQuote, setHighlightQuote] = useState<string | undefined>(
    undefined,
  )

  if (!lead) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Lead not found.
      </div>
    )
  }

  const facts = isMaria ? MARIA_FIXTURE.extractedFacts : null
  const transcript = isMaria ? MARIA_FIXTURE.transcript : []
  const scores = isMaria ? MARIA_FIXTURE.scores : null
  const verdictData = isMaria ? MARIA_FIXTURE.verdict : null

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[var(--background)] text-[var(--foreground)] font-[Inter_Variable,Inter,system-ui] text-[13px] leading-[1.45]">
      <div className="mx-auto max-w-[1180px] px-6 py-4">
        {/* Breadcrumb */}
        <button
          type="button"
          onClick={() => navigate('/intake')}
          className="mb-3 inline-flex items-center gap-1 text-[12px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to queue
        </button>

        <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-5">
          {/* Left rail — sticky inspector */}
          <aside className="self-start sticky top-[48px]">
            <LeftRail
              lead={lead}
              phase={phase}
              agreementStatus={agreementStatus}
              booking={booking}
              onStartCall={() => setPhase('during_call')}
              onEndCall={() => setPhase('scored')}
              onSendAgreement={() => setAgreementStatus('sent')}
            />
          </aside>

          {/* Main */}
          <div className="min-w-0 space-y-4">
            {phase === 'before_call' && (
              <BeforeCallPanel onStart={() => setPhase('during_call')} />
            )}
            {phase === 'during_call' && (
              <DuringCallPanel
                transcript={transcript}
                facts={facts}
                onEnd={() => setPhase('scored')}
              />
            )}
            {phase === 'scored' && verdictData && scores && (
              <ScoredPanel
                verdictData={verdictData}
                scores={scores}
                facts={facts}
                transcript={transcript}
                highlightQuote={highlightQuote}
                onHoverScoreQuote={setHighlightQuote}
                agreementStatus={agreementStatus}
                onSendAgreement={() => setAgreementStatus('sent')}
                onResendAgreement={() => {
                  /* noop in demo */
                }}
                onViewAgreement={() => {
                  /* noop in demo */
                }}
                booking={booking}
                onBook={(payload) => setBooking(payload)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Left rail — lead summary + SLA + actions + case timeline, all in one column
// ---------------------------------------------------------------------------

function LeftRail({
  lead,
  phase,
  agreementStatus,
  booking,
  onStartCall,
  onEndCall,
  onSendAgreement,
}: {
  lead: IntakeLead
  phase: LeadPhase
  agreementStatus: AgreementStatus
  booking: BookedState | null
  onStartCall: () => void
  onEndCall: () => void
  onSendAgreement: () => void
}) {
  const sla = slaDisplay(lead.slaDeadline)
  const tStyle = tierStyle(lead.valueTier)
  const vStyle = verdictStyle(lead.verdict)

  const events = useMemo<TimelineEvent[]>(() => {
    const out: TimelineEvent[] = [
      {
        ts: lead.intakeDate,
        kind: 'intake',
        label: 'Lead created',
        detail: `from ${lead.source}`,
      },
    ]
    if (lead.assignedTo) {
      out.push({
        ts: lead.intakeDate,
        kind: 'cm_assigned',
        label: `Assigned to ${lead.assignedTo}`,
      })
    }
    if (phase !== 'before_call') {
      out.push({
        ts: new Date(PAGE_LOAD_MS - 45 * 60 * 1000).toISOString(),
        kind: 'call',
        label: 'Intake call completed',
        detail: '4:43 recording',
      })
    }
    if (agreementStatus !== 'not_sent' && MARIA_FIXTURE.agreement.sentAt) {
      out.push({
        ts: MARIA_FIXTURE.agreement.sentAt,
        kind: 'agreement_sent',
        label: 'Agreement sent',
      })
    }
    if (agreementStatus === 'signed' && MARIA_FIXTURE.agreement.signedAt) {
      out.push({
        ts: MARIA_FIXTURE.agreement.signedAt,
        kind: 'agreement_signed',
        label: 'Agreement signed',
        detail: 'engagement executed',
      })
    }
    if (booking) {
      out.push({
        ts: new Date(PAGE_LOAD_MS).toISOString(),
        kind: 'appointment',
        label: `Intro call booked with ${booking.cmName}`,
        detail: new Date(booking.scheduledTs).toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
      })
    }
    return out.sort(
      (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
    )
  }, [lead, phase, agreementStatus, booking])

  return (
    <div className="space-y-3">
      {/* Lead summary card */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[12px] font-semibold text-[var(--foreground)]">
            {initials(lead.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold">
              {lead.name}
            </div>
            <div className="font-mono text-[11px] text-[var(--muted-foreground)]">
              {lead.phone}
            </div>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12px]">
          <DtDd label="Case type" value={lead.caseType} />
          <DtDd label="State" value={lead.state} />
          <DtDd label="Source" value={lead.source} />
          <DtDd label="Intake" value={relativeTime(lead.intakeDate)} />
          <DtDd label="Lead ID" value={lead.id} mono />
          {lead.assignedTo && <DtDd label="CM" value={lead.assignedTo} />}
        </dl>

        {/* Opportunity bar + verdict pill */}
        {lead.valueTier && (
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className={cn('h-full rounded-full', tStyle.bar)}
                style={{ width: `${lead.opportunityScore ?? 0}%` }}
              />
            </div>
            <span className="font-mono text-[11px] tabular-nums text-[var(--foreground)]">
              {lead.opportunityScore ?? '—'}
            </span>
          </div>
        )}
        {lead.verdict && (
          <div className="mt-2 flex items-center justify-between">
            <span
              className={cn(
                'inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium',
                vStyle.badge,
              )}
            >
              {lead.verdict}
            </span>
            {lead.estValueRange && (
              <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                {lead.estValueRange}
              </span>
            )}
          </div>
        )}
      </div>

      {/* SLA timer */}
      <div
        className={cn(
          'rounded-lg border px-4 py-3',
          sla.state === 'urgent'
            ? 'border-[var(--ring)]/30 bg-[var(--ring)]'
            : 'border-[var(--border)] bg-[var(--card)]',
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            <Clock className="h-3 w-3" />
            SLA
          </div>
          <span
            className={cn(
              'font-mono text-[15px] font-semibold tabular-nums',
              sla.state === 'urgent' && 'text-[var(--ring)]',
              sla.state === 'ok' && 'text-[var(--foreground)]',
              (sla.state === 'passed' || sla.state === 'none') &&
                'text-[var(--muted-foreground)]',
            )}
          >
            {sla.label}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-1.5">
        {phase === 'before_call' && (
          <ActionBtn icon={<Phone className="h-3.5 w-3.5" />} onClick={onStartCall} primary>
            Start call
          </ActionBtn>
        )}
        {phase === 'during_call' && (
          <ActionBtn icon={<PhoneOff className="h-3.5 w-3.5" />} onClick={onEndCall} primary>
            End call + score
          </ActionBtn>
        )}
        <ActionBtn
          icon={<FileSignature className="h-3.5 w-3.5" />}
          onClick={onSendAgreement}
        >
          Send agreement
        </ActionBtn>
        <ActionBtn icon={<CalendarPlus className="h-3.5 w-3.5" />}>
          Schedule
        </ActionBtn>
        <ActionBtn icon={<ArrowUpRightFromSquare className="h-3.5 w-3.5" />}>
          Mark refer-out
        </ActionBtn>
        <ActionBtn icon={<XCircle className="h-3.5 w-3.5" />}>
          Mark rejected
        </ActionBtn>
      </div>

      {/* Case timeline */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
          Case timeline
        </div>
        <ol className="mt-3 space-y-3">
          {events.map((e, i) => (
            <TimelineRow
              key={i}
              event={e}
              last={i === events.length - 1}
            />
          ))}
        </ol>
      </div>
    </div>
  )
}

function DtDd({
  label,
  value,
  mono,
}: {
  label: string
  value: string | null
  mono?: boolean
}) {
  return (
    <>
      <dt className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </dt>
      <dd
        className={cn(
          'truncate text-[12px] text-[var(--foreground)]',
          mono && 'font-mono',
        )}
      >
        {value ?? '—'}
      </dd>
    </>
  )
}

function ActionBtn({
  children,
  icon,
  onClick,
  primary,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  onClick?: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-8 w-full items-center gap-2 rounded-md border px-3 text-left text-[12px] font-medium transition-colors',
        primary
          ? 'border-[var(--ring)]/30 bg-[var(--ring)] text-[var(--background)] hover:bg-[var(--ring)]/90'
          : 'border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--ring)]',
      )}
    >
      {icon}
      <span>{children}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Before / during call panels (unchanged behavior, kept for phase gating)
// ---------------------------------------------------------------------------

function BeforeCallPanel({ onStart }: { onStart: () => void }) {
  return (
    <>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
              Ready to call
            </div>
            <div className="mt-1 text-[15px] font-semibold text-[var(--foreground)]">
              Follow the scripted intake flow
            </div>
          </div>
          <Button
            onClick={onStart}
            className="h-9 rounded-md bg-[var(--ring)] px-4 text-[13px] font-semibold text-[var(--background)] hover:bg-[var(--ring)]/90"
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Start call
          </Button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-md border border-dashed border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
          <FileAudio className="h-4 w-4 text-[var(--muted-foreground)]" />
          <div className="flex-1 text-[12px] text-[var(--muted-foreground)]">
            Or upload a pre-recorded call (.wav, .mp3, .m4a)
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-md border-[var(--border)] bg-[var(--card)] text-[12px] text-[var(--foreground)] hover:bg-[var(--ring)]"
          >
            Choose file
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
          Intake checklist
        </div>
        <div className="mt-3 space-y-3">
          {CHECKLIST_ITEMS.map((section) => (
            <ChecklistSection
              key={section.section}
              title={section.section}
              items={section.items}
            />
          ))}
        </div>
      </div>
    </>
  )
}

function ChecklistSection({ title, items }: { title: string; items: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--card)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-[12px] font-medium text-[var(--foreground)]">{title}</span>
        <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
          {items.length}
        </span>
      </button>
      {open && (
        <ul className="border-t border-[var(--border)] px-3 py-2">
          {items.map((it) => (
            <li
              key={it}
              className="flex items-center gap-2 py-0.5 text-[12px] text-[var(--foreground)]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--border)]" />
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DuringCallPanel({
  transcript,
  facts,
  onEnd,
}: {
  transcript: TranscriptSegment[]
  facts: ExtractedFacts | null
  onEnd: () => void
}) {
  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-[var(--ring)]/30 bg-[var(--ring)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--ring)]" />
          <span className="text-[12px] font-medium text-[var(--foreground)]">
            Call in progress
          </span>
          <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
            auto-transcribing
          </span>
        </div>
        <Button
          onClick={onEnd}
          size="sm"
          className="h-7 rounded-md bg-[var(--ring)] px-3 text-[12px] font-semibold text-[var(--background)] hover:bg-[var(--ring)]/90"
        >
          End call + score
        </Button>
      </div>

      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4">
        <TranscriptViewer
          segments={transcript}
          autoScroll
          className="max-h-[620px]"
        />
        <ExtractedFactsPanel facts={facts} live />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Scored panel — compact verdict hero + tabs
// ---------------------------------------------------------------------------

function ScoredPanel({
  verdictData,
  scores,
  facts,
  transcript,
  highlightQuote,
  onHoverScoreQuote,
  agreementStatus,
  onSendAgreement,
  onResendAgreement,
  onViewAgreement,
  booking,
  onBook,
}: {
  verdictData: typeof MARIA_FIXTURE.verdict
  scores: CallScores
  facts: ExtractedFacts | null
  transcript: TranscriptSegment[]
  highlightQuote: string | undefined
  onHoverScoreQuote: (q: string | undefined) => void
  agreementStatus: AgreementStatus
  onSendAgreement: () => void
  onResendAgreement: () => void
  onViewAgreement: () => void
  booking: BookedState | null
  onBook: (b: BookedState) => void
}) {
  return (
    <>
      <VerdictHero data={verdictData} />

      <Tabs defaultValue="scoring" className="gap-3">
        <TabsList
          variant="line"
          className="h-9 w-full justify-start gap-0 border-b border-[var(--border)]"
        >
          <TabsTrigger
            value="scoring"
            className="h-9 rounded-none px-3 text-[12px] font-medium data-active:text-[var(--foreground)]"
          >
            Scoring
          </TabsTrigger>
          <TabsTrigger
            value="facts"
            className="h-9 rounded-none px-3 text-[12px] font-medium data-active:text-[var(--foreground)]"
          >
            Facts
          </TabsTrigger>
          <TabsTrigger
            value="agreement"
            className="h-9 rounded-none px-3 text-[12px] font-medium data-active:text-[var(--foreground)]"
          >
            Agreement
          </TabsTrigger>
          <TabsTrigger
            value="appointment"
            className="h-9 rounded-none px-3 text-[12px] font-medium data-active:text-[var(--foreground)]"
          >
            Appointment
          </TabsTrigger>
          <TabsTrigger
            value="transcript"
            className="h-9 rounded-none px-3 text-[12px] font-medium data-active:text-[var(--foreground)]"
          >
            Transcript
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scoring" className="min-h-[480px]">
          <div
            onMouseLeave={() => onHoverScoreQuote(undefined)}
            onMouseEnter={() =>
              onHoverScoreQuote(scores.information_capture.evidence_quote)
            }
          >
            <CallScoreCard scores={scores} />
          </div>
        </TabsContent>

        <TabsContent value="facts" className="min-h-[480px]">
          <ExtractedFactsPanel facts={facts} />
        </TabsContent>

        <TabsContent value="agreement" className="min-h-[480px]">
          <AgreementCard
            status={agreementStatus}
            sentAt={MARIA_FIXTURE.agreement.sentAt}
            viewedAt={MARIA_FIXTURE.agreement.viewedAt}
            signedAt={MARIA_FIXTURE.agreement.signedAt}
            signerPhone={MARIA_FIXTURE.agreement.signerPhone}
            onSend={onSendAgreement}
            onResend={onResendAgreement}
            onView={onViewAgreement}
          />
        </TabsContent>

        <TabsContent value="appointment" className="min-h-[480px]">
          <AppointmentScheduler
            cmOptions={CM_OPTIONS}
            onBook={onBook}
            booked={booking}
          />
        </TabsContent>

        <TabsContent value="transcript" className="min-h-[480px]">
          <TranscriptViewer
            segments={transcript}
            highlightQuote={highlightQuote}
            className="max-h-[640px]"
          />
        </TabsContent>
      </Tabs>
    </>
  )
}

// ---------------------------------------------------------------------------
// Compact verdict hero card — single card, all above-the-fold content
// ---------------------------------------------------------------------------

function VerdictHero({ data }: { data: typeof MARIA_FIXTURE.verdict }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      {/* Top row — pill + tier + stats */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant="outline"
          className="h-6 rounded-md border-[var(--ring)]/30 bg-[var(--ring)]/10 px-2 text-[11px] font-semibold tracking-wide text-[var(--ring)]"
        >
          {data.verdict}
        </Badge>
        <Badge
          variant="outline"
          className="h-6 rounded-md border-[var(--border)] bg-[var(--card)] px-2 text-[11px] font-medium text-[var(--muted-foreground)]"
        >
          {data.valueTier}
        </Badge>
        <div className="ml-auto flex items-baseline gap-4">
          <HeroStat label="Opportunity" value={String(data.opportunityScore)} mono />
          <HeroStat label="Est. value" value={data.estValueRange} mono />
          <HeroStat label="Confidence" value={data.confidence} />
        </div>
      </div>

      {/* Narrative */}
      <p className="mt-3 text-[12px] leading-[1.55] text-[var(--foreground)]">
        {data.narrative}
      </p>

      {/* Reasoning bullets — uppercase grey label, no colored backgrounds */}
      <div className="mt-4 divide-y divide-border/60 border-y border-border/60">
        {data.reasoningBullets.map((b, i) => (
          <div
            key={i}
            className="grid grid-cols-[72px_1fr] items-baseline gap-x-3 py-2"
          >
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {b.tag}
            </span>
            <span className="text-[12px] leading-[1.55] text-foreground">
              {b.text}
            </span>
          </div>
        ))}
      </div>

      {/* Green / red signal chips — neutral chip with ✓ / × glyph */}
      {(data.greenSignals.length > 0 || data.redSignals.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.greenSignals.map((s, i) => (
            <span
              key={`g-${i}`}
              className="inline-flex h-5 items-center gap-1 rounded border border-border bg-card px-1.5 text-[11px] text-foreground"
            >
              <span className="text-muted-foreground">✓</span>
              {s}
            </span>
          ))}
          {data.redSignals.map((s, i) => (
            <span
              key={`r-${i}`}
              className="inline-flex h-5 items-center gap-1 rounded border border-border bg-card px-1.5 text-[11px] text-muted-foreground"
            >
              <span>×</span>
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Recommended next action — quiet accent, not a hero banner */}
      <div className="mt-4 flex items-start gap-3 rounded-md border border-border border-l-2 border-l-ring bg-card/50 px-3 py-2.5">
        <div className="flex-1">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Recommended next action
          </div>
          <div className="mt-1 text-[12px] leading-[1.5] text-foreground">
            {data.recommendedNextAction}
          </div>
        </div>
      </div>
    </div>
  )
}

function HeroStat({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </span>
      <span
        className={cn(
          'text-[13px] font-semibold text-[var(--foreground)]',
          mono && 'font-mono tabular-nums',
        )}
      >
        {value}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Facts panel (local — unchanged)
// ---------------------------------------------------------------------------

function ExtractedFactsPanel({
  facts,
  live,
}: {
  facts: ExtractedFacts | null
  live?: boolean
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
          Auto-extracted facts
        </div>
        {live ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ring)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--ring)]" />
            live
          </span>
        ) : (
          <CheckCircle2 className="h-3 w-3 text-[var(--ring)]" />
        )}
      </div>

      {!facts && (
        <div className="mt-4 text-[12px] text-[var(--muted-foreground)]">
          No facts yet. They&rsquo;ll populate as the call progresses.
        </div>
      )}

      {facts && (
        <dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-[12px]">
          <FactRow label="Incident" value={facts.incidentDate} mono />
          <FactRow label="Venue" value={facts.incidentVenue} />
          <FactRow label="Defendant" value={facts.defendant} />
          <FactRow
            label="Commercial"
            value={
              facts.commercialDefendant === null
                ? null
                : facts.commercialDefendant
                  ? 'Yes'
                  : 'No'
            }
          />
          <FactRow
            label="ER visit"
            value={
              facts.erVisit === null
                ? null
                : facts.erVisit
                  ? `Yes — ${facts.erFacility ?? 'facility TBD'}`
                  : 'No'
            }
          />
          <FactRow label="Police" value={facts.policeReport} mono />
          <FactRow
            label="Witnesses"
            value={
              facts.witnesses.length === 0
                ? null
                : facts.witnesses.map((w) => w.name).join(', ')
            }
          />
          <FactRow label="Insurance" value={facts.clientInsurance} />
          <FactRow
            label="Prior rep"
            value={
              facts.priorRepresentation === null
                ? null
                : facts.priorRepresentation
                  ? 'Yes'
                  : 'No'
            }
          />
        </dl>
      )}

      {facts?.narrative && (
        <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-2.5 text-[12px] leading-[1.5] text-[var(--foreground)]">
          {facts.narrative}
        </div>
      )}

      {/* Key fact accordions — moved here so Facts tab owns the full picture */}
      {facts && (
        <div className="mt-3 space-y-1 border-t border-[var(--border)] pt-3">
          <FactAccordion title="Key liability facts" items={MARIA_FIXTURE.verdict.keyLiabilityFacts} />
          <FactAccordion title="Key damages facts" items={MARIA_FIXTURE.verdict.keyDamagesFacts} />
          <FactAccordion title="Weaknesses / risks" items={MARIA_FIXTURE.verdict.weaknessesRisks} />
        </div>
      )}
    </div>
  )
}

function FactAccordion({ title, items }: { title: string; items: string[] }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-1 text-left text-[12px] font-medium text-[var(--foreground)] transition-colors hover:text-[var(--ring)]"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-[var(--muted-foreground)] transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <ul className="mt-1 space-y-1 pb-1.5 pl-3">
          {items.map((it, i) => (
            <li
              key={i}
              className="relative text-[12px] leading-[1.5] text-[var(--foreground)] before:absolute before:-left-3 before:top-[0.45em] before:h-1 before:w-1 before:rounded-full before:bg-[var(--muted-foreground)]"
            >
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FactRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string | null
  mono?: boolean
}) {
  return (
    <>
      <dt className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </dt>
      <dd
        className={cn(
          'text-[12px] text-[var(--foreground)]',
          mono && 'font-mono tabular-nums',
          !value && 'text-[var(--muted-foreground)]',
        )}
      >
        {value ?? '—'}
      </dd>
    </>
  )
}

// ---------------------------------------------------------------------------
// Timeline row
// ---------------------------------------------------------------------------

function TimelineRow({
  event,
  last,
}: {
  event: TimelineEvent
  last: boolean
}) {
  const icon = iconForKind(event.kind)
  return (
    <li className="relative flex gap-3">
      {!last && (
        <span className="absolute left-[11px] top-6 h-full w-px bg-[var(--border)]" />
      )}
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--ring)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <div className="text-[12px] font-medium text-[var(--foreground)]">
          {event.label}
        </div>
        {event.detail && (
          <div className="truncate text-[11px] text-[var(--muted-foreground)]">
            {event.detail}
          </div>
        )}
        <div className="mt-0.5 font-mono text-[10px] text-[var(--muted-foreground)]">
          {relativeTime(event.ts)}
        </div>
      </div>
    </li>
  )
}

function iconForKind(kind: TimelineEvent['kind']): React.ReactNode {
  const klass = 'h-3 w-3'
  switch (kind) {
    case 'intake':
      return <User className={klass} />
    case 'call':
      return <Phone className={klass} />
    case 'agreement_sent':
      return <FileSignature className={klass} />
    case 'agreement_signed':
      return <CheckCircle2 className={klass} />
    case 'appointment':
      return <CalendarPlus className={klass} />
    case 'cm_assigned':
      return <User className={klass} />
    default:
      return <Clock className={klass} />
  }
}
