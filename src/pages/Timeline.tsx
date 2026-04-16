import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getCaseById, getTimeline } from '@/data/mockData'

const TYPE_ICONS: Record<string, string> = {
  incident: '!',
  treatment_start: '+',
  appointment: 'A',
  referral: 'R',
  missed_appointment: 'X',
  diagnostic: 'D',
  contact: 'C',
  gap: 'G',
  milestone: 'M',
  issue: '!',
}

const TYPE_COLORS: Record<string, string> = {
  incident: 'bg-red-500',
  treatment_start: 'bg-green-500',
  appointment: 'bg-blue-500',
  referral: 'bg-purple-500',
  missed_appointment: 'bg-orange-500',
  diagnostic: 'bg-cyan-500',
  contact: 'bg-slate-500',
  gap: 'bg-red-400',
  milestone: 'bg-emerald-500',
  issue: 'bg-red-600',
}

const FLAG_COLORS: Record<string, string> = {
  warning: 'bg-orange-100 text-orange-800',
  info: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  danger: 'bg-red-100 text-red-800',
}

export function Timeline() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const cv = getCaseById(caseId || '')
  const events = getTimeline(caseId || '')

  if (!cv) {
    return <p className="text-muted-foreground">Case not found.</p>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/case/${caseId}`)}>
          &larr; Back to Case
        </Button>
        <div>
          <h1 className="text-xl font-bold">{cv.client.fullName} — Treatment Timeline</h1>
          <p className="text-sm text-muted-foreground">{cv.caseData.matterId}</p>
        </div>
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-4">
          {events.map((event, i) => (
            <div key={i} className="relative flex gap-4">
              {/* Icon circle */}
              <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold ${TYPE_COLORS[event.type] || 'bg-gray-400'}`}>
                {TYPE_ICONS[event.type] || '?'}
              </div>

              {/* Content */}
              <div className="flex-1 rounded-lg border bg-card p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{event.title}</span>
                    {event.flagType && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${FLAG_COLORS[event.flagType]}`}>
                        {event.flagType}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                {event.description && (
                  <p className="text-muted-foreground mt-1">{event.description}</p>
                )}
                {event.providerName && (
                  <Badge variant="secondary" className="mt-1.5 text-[10px]">
                    {event.providerName}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
