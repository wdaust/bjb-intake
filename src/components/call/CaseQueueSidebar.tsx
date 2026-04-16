import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useQueue } from '@/lib/QueueContext'

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
    <div className="w-64 border-r border-border/50 bg-card/50 flex flex-col h-full">
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
          const priorityColor = urgency >= 80 ? 'bg-red-500' : urgency >= 60 ? 'bg-orange-500' : urgency >= 40 ? 'bg-yellow-500' : 'bg-emerald-500'

          return (
            <div
              key={cv.caseData.id}
              className={`px-3 py-2 cursor-pointer border-b border-border/30 transition-colors ${
                isActive ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-accent/50'
              }`}
              onClick={() => {
                setCurrentIndex(i)
                navigate(`/case/${cv.caseData.id}`)
              }}
            >
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${priorityColor}`} />
                <p className={`text-xs truncate ${isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {cv.client.fullName}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground/60 ml-3.5 truncate">
                {cv.caseData.matterId}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
