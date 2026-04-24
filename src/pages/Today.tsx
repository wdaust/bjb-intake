/**
 * Today — CM daily brief.
 *
 * The CM's morning landing page. Shows what matters for the day:
 *  - greeting
 *  - upcoming appointments (Maria's 11 AM intro)
 *  - new intake leads in queue
 *  - active cases that need attention today
 *  - personal pace (placeholder sparkline)
 *
 * Everything links to deeper screens. Designed to be the "home base"
 * that makes the CM open CAOS every morning.
 */
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clock, Inbox, Briefcase, ArrowRight, Phone, FileText, Play } from 'lucide-react'
import { rankCases, RANKER_DEMO_CASES } from '@/lib/callQueueRanker'

// ---------- Mock data for the demo ----------

const TODAY_APPOINTMENTS = [
  {
    id: 'appt-maria-intro',
    time: '11:00 AM',
    minutesFromNow: 12,          // for demo urgency indicator
    client: 'Maria Santos',
    clientInitials: 'MS',
    kind: 'Intro call',
    caseType: 'MVA · NJ',
    prep: 'Pre-call brief: PURSUE-HARD · $75K-$250K · radicular pain → MRI urgency',
    caseLink: '/case-demo/INT-260424-maria',
  },
  {
    id: 'appt-thompson',
    time: '2:30 PM',
    minutesFromNow: 248,
    client: 'James Thompson',
    clientInitials: 'JT',
    kind: 'Treatment check-in',
    caseType: 'Premises · NY',
    prep: 'Last contact 22d ago · confirm PT attendance',
    caseLink: '#',
  },
]

const NEW_LEADS_IN_QUEUE = [
  { name: 'Priya Raman', type: 'Slip and Fall · NJ', sla: 'passed', verdict: 'PURSUE-CALLBACK SOFT' },
  { name: "Eamon O'Brien", type: 'MVA · PA', sla: '3:29 left', verdict: 'PURSUE-HARD' },
  { name: 'Maria Santos', type: 'MVA · NJ', sla: 'qualified', verdict: 'PURSUE-HARD' },
]

const ACTIVE_CASES_TODAY = [
  {
    id: 'MAT-26042500001',
    name: 'Maria Santos',
    initials: 'MS',
    status: 'Intro call at 11',
    urgency: 'high' as const,
    nextAction: 'Schedule PT this morning',
  },
  {
    id: 'MAT-26022678622',
    name: 'Kassim Robinson',
    initials: 'KR',
    status: 'MRI results pending',
    urgency: 'medium' as const,
    nextAction: 'Call Open MRI Hollywood for status',
  },
  {
    id: 'MAT-25110573188',
    name: 'Denisa Durovic',
    initials: 'DD',
    status: 'Treatment gap 18d',
    urgency: 'high' as const,
    nextAction: 'Re-engage; client unresponsive 2 weeks',
  },
  {
    id: 'MAT-25121275041',
    name: 'Amy Vegliante',
    initials: 'AV',
    status: 'Records due Thursday',
    urgency: 'low' as const,
    nextAction: 'Follow up with PCP office',
  },
]

// ---------- Component ----------

export default function Today() {
  const navigate = useNavigate()
  const now = useMemo(() => new Date(), [])
  const greeting =
    now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  // Ranked queue for today's banner. Totals/tier counts come from the shared
  // ranker so the banner matches the queue builder page exactly.
  const ranked = useMemo(() => rankCases(RANKER_DEMO_CASES, now), [now])
  const queueTotal = ranked.length
  const criticalCount = ranked.filter((c) => c.priorityTier === 'critical').length
  const highCount = ranked.filter((c) => c.priorityTier === 'high').length

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1180px] px-6 py-6">
      {/* Header */}
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-mono">
          {dateStr}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {greeting}, Cassandra.
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Two intro calls booked. Maria Santos is up first at 11:00 — she&rsquo;s your highest-value
          pre-lit case this week.
        </p>
      </div>

      {/* Today's queue banner — entry point to plow-through mode. */}
      <div className="mb-5 flex items-center gap-4 rounded-lg border border-border border-l-2 border-l-ring bg-card px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Today&rsquo;s queue
          </div>
          <div className="mt-0.5 text-[13px] text-foreground">
            <span className="font-mono tabular-nums">{queueTotal}</span>{' '}
            calls planned
            <span className="mx-1.5 text-muted-foreground">·</span>
            <span className="font-mono tabular-nums">{criticalCount}</span> critical
            <span className="mx-1.5 text-muted-foreground">·</span>
            <span className="font-mono tabular-nums">{highCount}</span> high priority
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/queue/run?start=0')}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-ring/30 bg-ring px-3 text-[12px] font-semibold text-background transition-colors hover:bg-ring/90"
        >
          <Play className="h-3.5 w-3.5" />
          Start today&rsquo;s queue
        </button>
      </div>

      {/* Three-column grid */}
      <div className="grid grid-cols-[1.2fr_1fr] gap-5">
        {/* Left column — Today's schedule */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Today&rsquo;s schedule
            </h2>
            <span className="text-[11px] font-mono text-muted-foreground">
              2 appointments
            </span>
          </div>
          <div className="space-y-3">
            {TODAY_APPOINTMENTS.map((a) => {
              const urgent = a.minutesFromNow < 30
              return (
                <button
                  key={a.id}
                  onClick={() => navigate(a.caseLink)}
                  className={[
                    'group block w-full rounded-lg border border-border bg-card p-4 text-left',
                    'transition-colors hover:bg-accent/40',
                    urgent ? 'ring-1 ring-primary/30' : '',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary font-mono">
                      {a.time.replace(' AM', '').replace(' PM', '')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold">{a.client}</span>
                        <span className="text-[11px] uppercase tracking-wider rounded border border-border px-1.5 py-0.5 text-muted-foreground">
                          {a.kind}
                        </span>
                        {urgent && (
                          <span className="ml-auto inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-[11px] font-mono text-primary">
                            <Clock className="h-3 w-3" />
                            in {a.minutesFromNow}m
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[12px] text-muted-foreground">{a.caseType}</div>
                      <div className="mt-2 text-[12px] leading-relaxed text-foreground/80">
                        {a.prep}
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Active cases needing attention */}
          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Active cases needing attention
              </h2>
              <Link
                to="/"
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                View all 47 →
              </Link>
            </div>
            <div className="rounded-lg border border-border bg-card">
              {ACTIVE_CASES_TODAY.map((c, idx) => (
                <button
                  key={c.id}
                  onClick={() => navigate('/case/' + c.id)}
                  className={[
                    'group flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent/40',
                    idx !== ACTIVE_CASES_TODAY.length - 1 ? 'border-b border-border' : '',
                  ].join(' ')}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {c.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">{c.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{c.id}</span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">
                      {c.nextAction}
                    </div>
                  </div>
                  <div
                    className={[
                      'rounded px-2 py-0.5 text-[11px] font-medium',
                      c.urgency === 'high'
                        ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                        : c.urgency === 'medium'
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : 'bg-accent/20 text-muted-foreground border border-border',
                    ].join(' ')}
                  >
                    {c.status}
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right column — Queue + pace */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              New leads in queue
            </h2>
            <Link
              to="/intake"
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              View all →
            </Link>
          </div>
          <div className="rounded-lg border border-border bg-card">
            {NEW_LEADS_IN_QUEUE.map((l, idx) => (
              <div
                key={l.name}
                className={[
                  'flex items-center gap-3 px-4 py-3',
                  idx !== NEW_LEADS_IN_QUEUE.length - 1 ? 'border-b border-border' : '',
                ].join(' ')}
              >
                <Inbox className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{l.name}</div>
                  <div className="text-[11px] text-muted-foreground">{l.type}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[11px] text-muted-foreground">{l.sla}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {l.verdict}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pace / summary card */}
          <div className="mt-5 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Month-to-date
              </h3>
              <span className="font-mono text-[11px] text-muted-foreground">April</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <div className="font-mono text-2xl font-semibold">14</div>
                <div className="text-[11px] text-muted-foreground">Activations</div>
              </div>
              <div>
                <div className="font-mono text-2xl font-semibold">3</div>
                <div className="text-[11px] text-muted-foreground">Advanced to RFD</div>
              </div>
              <div>
                <div className="font-mono text-2xl font-semibold">96%</div>
                <div className="text-[11px] text-muted-foreground">Portfolio health</div>
              </div>
            </div>
            {/* Pace sparkline stub — 14 days of bars */}
            <div className="mt-4 flex h-12 items-end gap-1">
              {[3, 2, 4, 5, 3, 2, 0, 4, 5, 6, 3, 4, 5, 7].map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-primary/40"
                  style={{ height: v === 0 ? 3 : `${(v / 7) * 100}%` }}
                  title={`Day ${i + 1}: ${v} events`}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>2 wk ago</span>
              <span>today</span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link
              to="/intake"
              className="rounded-lg border border-border bg-card px-4 py-3 text-[13px] transition-colors hover:bg-accent/40"
            >
              <Inbox className="mb-1 h-4 w-4 text-primary" />
              <div className="font-medium">Intake queue</div>
              <div className="text-[11px] text-muted-foreground">3 new leads</div>
            </Link>
            <Link
              to="/"
              className="rounded-lg border border-border bg-card px-4 py-3 text-[13px] transition-colors hover:bg-accent/40"
            >
              <Briefcase className="mb-1 h-4 w-4 text-primary" />
              <div className="font-medium">Caseload</div>
              <div className="text-[11px] text-muted-foreground">47 active</div>
            </Link>
            <Link
              to="/case-demo/INT-260424-maria"
              className="rounded-lg border border-border bg-card px-4 py-3 text-[13px] transition-colors hover:bg-accent/40"
            >
              <Phone className="mb-1 h-4 w-4 text-primary" />
              <div className="font-medium">Next call</div>
              <div className="text-[11px] text-muted-foreground">Maria Santos · 11 AM</div>
            </Link>
            <Link
              to="/manager"
              className="rounded-lg border border-border bg-card px-4 py-3 text-[13px] transition-colors hover:bg-accent/40"
            >
              <FileText className="mb-1 h-4 w-4 text-primary" />
              <div className="font-medium">Reports</div>
              <div className="text-[11px] text-muted-foreground">Manager view</div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
