import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { getCaseByIdLive } from '@/data/liveData'
import { getNode, getStartNode } from '@/data/callFlowNodes'
import type { CallNode, CapturedCallData, CallStage, TaskItem, FullCaseView } from '@/types'

const STAGE_LABELS: Record<CallStage, string> = {
  opening: 'Opening',
  treatment_status: 'Treatment Status',
  symptoms: 'Symptoms',
  appointments: 'Appointments',
  barriers: 'Barriers',
  progression: 'Progression',
  direction: 'Case Direction',
  next_step: 'Next Step',
  closeout: 'Close-Out',
}

const STAGE_ORDER: CallStage[] = [
  'opening', 'treatment_status', 'symptoms', 'appointments',
  'barriers', 'progression', 'direction', 'next_step', 'closeout',
]

export function GuidedCall() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const [cv, setCv] = useState<FullCaseView | null>(null)

  useEffect(() => {
    getCaseByIdLive(caseId || '').then(data => setCv(data || null))
  }, [caseId])

  const [currentNode, setCurrentNode] = useState<CallNode>(getStartNode())
  const [history, setHistory] = useState<{ nodeId: string; answerId: string }[]>([])
  const [capturedData, setCapturedData] = useState<CapturedCallData>({})
  const [directionWeights, setDirectionWeights] = useState<Record<string, number>>({})
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [freeTextInput, setFreeTextInput] = useState('')
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [callComplete, setCallComplete] = useState(false)

  const handleAnswer = useCallback((answerId: string) => {
    if (!currentNode) return

    // Record history
    setHistory((prev) => [...prev, { nodeId: currentNode.nodeId, answerId }])

    // Apply field updates
    const newData = { ...capturedData }
    for (const fu of currentNode.fieldUpdates) {
      const val = typeof fu.value === 'function' ? fu.value(answerId) : fu.value
      ;(newData as Record<string, unknown>)[fu.field] = val
    }
    setCapturedData(newData)

    // Apply direction updates
    const newWeights = { ...directionWeights }
    const answerDirectionUpdates = currentNode.directionUpdates
    for (const du of answerDirectionUpdates) {
      newWeights[du.direction] = (newWeights[du.direction] || 0) + du.weight
    }
    setDirectionWeights(newWeights)

    // Apply task rules
    for (const tr of currentNode.taskRules) {
      if (tr.condition === 'always' || (tr.condition === 'if_answer' && tr.answerIds?.includes(answerId))) {
        setTasks((prev) => [...prev, { ...tr.task, id: `task-${Date.now()}`, status: 'pending' }])
      }
    }

    // Navigate to next node
    const nextNodeId = currentNode.nextNodeMap[answerId] || currentNode.nextNodeMap['default']
    if (nextNodeId === 'COMPLETE') {
      setCallComplete(true)
      return
    }

    const nextNode = getNode(nextNodeId || '')
    if (nextNode) {
      setCurrentNode(nextNode)
      setShowFollowUp(false)
    }
  }, [currentNode, capturedData, directionWeights])

  function handleBack() {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    const prevNode = getNode(prev.nodeId)
    if (prevNode) setCurrentNode(prevNode)
  }

  if (!cv) {
    return <p className="text-muted-foreground">Loading case data...</p>
  }

  if (callComplete) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 py-8">
        <Card className="border-emerald-500/30 bg-emerald-500/10">
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold text-emerald-400 mb-2">Call Complete</h1>
            <p className="text-emerald-300/80 mb-6">Session data has been captured. Review the post-call summary.</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate(`/summary/${caseId}`, { state: { capturedData, tasks, direction: 'unresolved' } })}>
                View Post-Call Summary
              </Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                Back to Caseload
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentStageIndex = STAGE_ORDER.indexOf(currentNode.stage)

  // Interpolate client name into prompt
  const promptText = currentNode.promptText
    .replace('[Client Name]', cv.client.preferredName || cv.client.fullName.split(' ')[0])
    .replace('[Client First Name]', cv.client.preferredName || cv.client.fullName.split(' ')[0])
    .replace('[CM Name]', cv.caseData.caseManagerAssigned)
    .replace('[Firm]', 'Brandon J. Broderick')
    .replace('[Firm/Firm Team]', 'Brandon J. Broderick')

  return (
    <div className="grid grid-cols-12 gap-4 max-w-[1400px] mx-auto">
      {/* Header bar */}
      <div className="col-span-12 flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/case/${caseId}`)}>
            &larr; Exit Call
          </Button>
          <div>
            <span className="font-semibold">{cv.client.fullName}</span>
            <span className="text-muted-foreground text-sm ml-2">{cv.caseData.matterId}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{STAGE_LABELS[currentNode.stage]}</Badge>
          <Badge variant="outline">Step {history.length + 1}</Badge>
        </div>
      </div>

      {/* Stage progress bar */}
      <div className="col-span-12 flex gap-1">
        {STAGE_ORDER.map((stage, i) => (
          <div
            key={stage}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < currentStageIndex ? 'bg-primary/40' : i === currentStageIndex ? 'bg-primary' : 'bg-muted'
            }`}
            title={STAGE_LABELS[stage]}
          />
        ))}
      </div>

      {/* LEFT COLUMN — Main Call Interface (Zones 1-5) */}
      <div className="col-span-8 space-y-4">
        {/* Zone 1: Current Prompt */}
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-5">
            <p className="text-lg leading-relaxed">&ldquo;{promptText}&rdquo;</p>
          </CardContent>
        </Card>

        {/* Zone 2: Purpose of This Step */}
        <div className="rounded-lg bg-muted/50 px-4 py-2.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Purpose of This Step</p>
          <p className="text-sm">{currentNode.purposeText}</p>
        </div>

        {/* Zone 3: Answer Buttons */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Client Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {currentNode.answerOptions.map((opt) => (
                <Button
                  key={opt.id}
                  variant="outline"
                  className="h-auto py-3 px-4 text-left justify-start whitespace-normal"
                  onClick={() => handleAnswer(opt.id)}
                >
                  <div>
                    <p className="font-medium text-sm">{opt.label}</p>
                    {opt.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    )}
                  </div>
                </Button>
              ))}
            </div>
            {history.length > 0 && (
              <Button variant="ghost" size="sm" className="mt-3" onClick={handleBack}>
                &larr; Go Back
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Zone 4: Empathy/Tone Coaching */}
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-1">Empathy & Tone Coaching</p>
            <p className="text-sm text-amber-300/80">{currentNode.empathyGuidance}</p>
          </CardContent>
        </Card>

        {/* Zone 5: Follow-Up Probes */}
        {currentNode.followUpProbes.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setShowFollowUp(!showFollowUp)}
            >
              {showFollowUp ? 'Hide' : 'Show'} Follow-Up Probes ({currentNode.followUpProbes.length})
            </Button>
            {showFollowUp && (
              <Card className="mt-2">
                <CardContent className="p-4 space-y-2">
                  {currentNode.followUpProbes.map((probe, i) => (
                    <p key={i} className="text-sm text-muted-foreground">&bull; &ldquo;{probe}&rdquo;</p>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Free-text notes */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Additional Notes</p>
          <Textarea
            value={freeTextInput}
            onChange={(e) => setFreeTextInput(e.target.value)}
            placeholder="Capture any additional details..."
            rows={2}
            className="text-sm"
          />
        </div>
      </div>

      {/* RIGHT COLUMN — Call Notes */}
      <div className="col-span-4 space-y-3">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Call Notes</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3">
            {/* Quick tags */}
            <div className="flex flex-wrap gap-1.5">
              {['Appt confirmed', 'Barrier identified', 'Needs follow-up', 'Escalation needed', 'Provider issue', 'Client improving'].map(tag => (
                <button
                  key={tag}
                  className="text-[10px] px-2 py-1 rounded-full border border-border/50 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                  onClick={() => setFreeTextInput(prev => prev + (prev ? '\n' : '') + `[${tag}] `)}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Notes textarea */}
            <Textarea
              value={freeTextInput}
              onChange={(e) => setFreeTextInput(e.target.value)}
              placeholder="Type call notes here. Use quick tags above for common entries..."
              className="flex-1 min-h-[200px] text-sm resize-none"
            />

            {/* Escalate button */}
            <Button variant="destructive" size="sm" className="w-full" disabled>
              Quick Escalate
            </Button>
          </CardContent>
        </Card>

        {/* Tasks Created */}
        {tasks.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tasks Created ({tasks.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {tasks.map((t) => (
                <div key={t.id} className="text-xs p-2 rounded bg-muted">
                  <p className="font-medium">{t.description}</p>
                  <p className="text-muted-foreground">{t.urgency} priority</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

