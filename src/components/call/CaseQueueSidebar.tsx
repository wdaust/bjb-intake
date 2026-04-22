import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useQueue } from '@/lib/QueueContext'
import { daysSince } from '@/data/mockData'

const STAGE_SHORT: Record<string, string> = {
  early_case: 'Early',
  active_treatment: 'Active Tx',
  mid_treatment: 'Mid Tx',
  late_treatment: 'Late Tx',
  demand_prep: 'Demand',
  litigation: 'Litigation',
  resolved: 'Resolved',
}

const FLAG_LABELS: Record<string, string> = {
  treatment_gap: 'Gap',
  no_contact: 'No contact',
  no_next_appointment: 'No appt',
  weak_treatment: 'Weak',
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function getInitialColor(name: string): string {
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-teal-500', 'bg-pink-500',
    'bg-orange-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-emerald-500',
    'bg-rose-500', 'bg-amber-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length] ?? colors[0]!
}

export function CaseQueueSidebar() {
  const navigate = useNavigate()
  const { queue, currentIndex, setCurrentIndex, goNext, goPrev } = useQueue()
  const [collapsed, setCollapsed] = useState(false)

  if (queue.length === 0) return null

  if (collapsed) {
    return (
      <div className="w-10 border-r border-border/50 bg-card/50 flex flex-col items-center pt-3">
        <button
          onClick={() => setCollapsed(false)}
          className="text-muted-foreground hover:text-foreground text-xs rotate-90 whitespace-nowrap"
        >
          Queue ({queue.length})
        </button>
      </div>
    )
  }

  return (
    <div className="w-72 border-r border-border/50 bg-card/30 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border/50 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold">Case Queue</p>
          <p className="text-[10px] text-muted-foreground">
            {currentIndex >= 0 ? currentIndex + 1 : '—'} of {queue.length}
          </p>
        </div>
        <button onClick={() => setCollapsed(true)} className="text-muted-foreground hover:text-foreground text-xs">
          Hide
        </button>
      </div>

      {/* Nav buttons */}
      <div className="flex gap-1 p-2 border-b border-border/50">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs h-7"
          disabled={currentIndex <= 0}
          onClick={() => { const id = goPrev(); if (id) navigate(`/case/${id}`) }}
        >
          Prev
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs h-7"
          disabled={currentIndex >= queue.length - 1}
          onClick={() => { const id = goNext(); if (id) navigate(`/case/${id}`) }}
        >
          Next
        </Button>
      </div>

      {/* Case list */}
      <div className="flex-1 overflow-y-auto">
        {queue.map((cv, i) => {
          const isActive = i === currentIndex
          const urgency = cv.scores.urgencyScore
          const priorityColor = urgency >= 80 ? 'border-l-red-500' : urgency >= 60 ? 'border-l-orange-500' : urgency >= 40 ? 'border-l-yellow-500' : 'border-l-emerald-500'
          const stage = STAGE_SHORT[cv.caseData.currentStage] || cv.caseData.currentStage
          const gapDays = cv.operational.treatmentGapDays
          const contactDays = cv.operational.lastContactDate ? daysSince(cv.operational.lastContactDate) : null
          const riskFlags = cv.operational.currentRiskFlags.slice(0, 2)

          return (
            <div
              key={cv.caseData.id}
              className={`px-3 py-2.5 cursor-pointer border-b border-border/20 border-l-2 transition-all ${priorityColor} ${
                isActive ? 'bg-primary/10' : 'hover:bg-accent/30'
              }`}
              onClick={() => {
                setCurrentIndex(i)
                navigate(`/case/${cv.caseData.id}`)
              }}
            >
              {/* Row 1: Avatar + Name */}
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${getInitialColor(cv.client.fullName)}`}>
                  {getInitials(cv.client.fullName)}
                </div>
                <p className={`text-xs truncate ${isActive ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                  {cv.client.fullName}
                </p>
              </div>

              {/* Row 2: Stage + Gap */}
              <div className="flex items-center justify-between ml-8 mt-0.5">
                <span className="text-[10px] text-muted-foreground">{stage}</span>
                {gapDays < 999 && (
                  <span className={`text-[10px] font-medium ${gapDays > 21 ? 'text-red-400' : gapDays > 14 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                    {gapDays}d gap
                  </span>
                )}
              </div>

              {/* Row 3: Last contact + tasks */}
              <div className="flex items-center justify-between ml-8 mt-0.5">
                <span className="text-[10px] text-muted-foreground/60">
                  {contactDays !== null ? `Contact ${contactDays}d ago` : 'No contact'}
                </span>
                {cv.operational.outstandingTasks > 0 && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {cv.operational.outstandingTasks} task{cv.operational.outstandingTasks !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Row 4: Risk flags */}
              {riskFlags.length > 0 && (
                <div className="flex gap-1 ml-8 mt-1">
                  {riskFlags.map((flag, j) => (
                    <span
                      key={j}
                      className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20"
                    >
                      {FLAG_LABELS[flag] || flag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
