import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { getCaseByIdLive } from '@/data/liveData'
import { getNode, getStartNode } from '@/data/callFlowNodes'
import type { CallNode, CapturedCallData, CaseDirection, CallStage, TaskItem, FullCaseView } from '@/types'

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

const DIRECTION_LABELS: Record<CaseDirection, string> = {
  continue_treatment_optimization: 'Continue Treatment',
  closer_monitoring: 'Closer Monitoring',
  urgent_re_engagement: 'Urgent Re-Engagement',
  next_level_care: 'Next-Level Care',
  demand_readiness_review: 'Demand Review',
  litigation_review: 'Litigation Review',
  cut_review: 'Cut Review',
  transfer_review: 'Transfer Review',
  escalate_for_review: 'Escalate',
  unresolved: 'Unresolved',
}

const DIRECTION_COLORS: Record<string, string> = {
  continue_treatment_optimization: 'bg-green-100 text-green-800 border-green-300',
  closer_monitoring: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  urgent_re_engagement: 'bg-orange-100 text-orange-800 border-orange-300',
  next_level_care: 'bg-blue-100 text-blue-800 border-blue-300',
  demand_readiness_review: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  litigation_review: 'bg-purple-100 text-purple-800 border-purple-300',
  cut_review: 'bg-red-100 text-red-800 border-red-300',
  transfer_review: 'bg-amber-100 text-amber-800 border-amber-300',
  escalate_for_review: 'bg-pink-100 text-pink-800 border-pink-300',
  unresolved: 'bg-gray-100 text-gray-800 border-gray-300',
}

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
  const [currentDirection, setCurrentDirection] = useState<CaseDirection>('unresolved')
  const [directionWeights, setDirectionWeights] = useState<Record<string, number>>({})
  const [bestNextMove, setBestNextMove] = useState('Begin call and assess treatment status')
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

    // Calculate top direction
    const sorted = Object.entries(newWeights).sort(([, a], [, b]) => b - a)
    if (sorted.length > 0 && sorted[0][1] > 0) {
      setCurrentDirection(sorted[0][0] as CaseDirection)
    }

    // Apply task rules
    for (const tr of currentNode.taskRules) {
      if (tr.condition === 'always' || (tr.condition === 'if_answer' && tr.answerIds?.includes(answerId))) {
        setTasks((prev) => [...prev, { ...tr.task, id: `task-${Date.now()}`, status: 'pending' }])
      }
    }

    // Update best next move based on context
    updateBestNextMove(newData, answerId, currentNode)

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

  function updateBestNextMove(_data: CapturedCallData, answerId: string, node: CallNode) {
    if (node.stage === 'treatment_status') {
      if (answerId === 'stopped_treating' || answerId === 'never_started') {
        setBestNextMove('Identify barriers and determine if treatment can be re-engaged')
      } else if (answerId === 'actively_treating') {
        setBestNextMove('Confirm appointment continuity and symptom direction')
      } else if (answerId === 'inconsistent') {
        setBestNextMove('Identify barrier pattern and stabilize treatment')
      }
    } else if (node.stage === 'symptoms') {
      if (answerId === 'worse') {
        setBestNextMove('Assess whether current treatment is sufficient or escalation needed')
      } else if (answerId === 'better' || answerId === 'resolved') {
        setBestNextMove('Clarify whether treatment is complete or still expected')
      }
    } else if (node.stage === 'appointments') {
      if (answerId === 'not_scheduled') {
        setBestNextMove('Barrier identification mandatory — do not close without next-step clarity')
      }
    } else if (node.stage === 'barriers') {
      setBestNextMove('Resolve barrier and secure concrete next step')
    } else if (node.stage === 'direction') {
      setBestNextMove('Confirm case direction and prepare close-out')
    }
  }

  function handleBack() {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    const prevNode = getNode(prev.nodeId)
    if (prevNode) setCurrentNode(prevNode)
  }

  if (!cv) {
    return <p className="text-muted-foreground">Case not found.</p>
  }

  if (callComplete) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 py-8">
        <Card className="border-green-300 bg-green-50">
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold text-green-800 mb-2">Call Complete</h1>
            <p className="text-green-700 mb-6">Session data has been captured. Review the post-call summary.</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate(`/summary/${caseId}`, { state: { capturedData, tasks, direction: currentDirection } })}>
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
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-amber-900 uppercase tracking-wide mb-1">Empathy & Tone Coaching</p>
            <p className="text-sm text-amber-800">{currentNode.empathyGuidance}</p>
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

      {/* RIGHT COLUMN — Side Panels (Zones 6-9) */}
      <div className="col-span-4 space-y-4">
        {/* Zone 6: Data Capture Panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Data Captured</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <DataField label="Treatment Status" value={capturedData.treatmentStatus} />
            <DataField label="Last Appointment" value={capturedData.lastAppointmentDate} />
            <DataField label="Next Appointment" value={capturedData.nextAppointmentDate || capturedData.nextAppointmentStatus} />
            <DataField label="Symptoms" value={capturedData.symptomDirection} />
            <DataField label="Barrier" value={capturedData.barrierType} />
            <DataField label="Progression" value={capturedData.progressionQuality} />
            <DataField label="Engagement" value={capturedData.engagementLevel} />
          </CardContent>
        </Card>

        {/* Zone 7: Best Next Move */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-blue-900">Best Next Move</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-800">{bestNextMove}</p>
          </CardContent>
        </Card>

        {/* Zone 8: Directional Assessment */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Case Direction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {Object.entries(DIRECTION_LABELS).map(([key, label]) => {
                const weight = directionWeights[key] || 0
                const isTop = key === currentDirection && weight > 0
                return (
                  <div
                    key={key}
                    className={`rounded px-2 py-1 text-xs flex justify-between items-center border ${
                      isTop ? DIRECTION_COLORS[key] : 'bg-white border-transparent'
                    }`}
                  >
                    <span className={isTop ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
                    {weight > 0 && (
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-current rounded-full"
                          style={{ width: `${Math.min(weight * 20, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Zone 9: Quick Escalate */}
        <Button variant="destructive" size="sm" className="w-full" disabled>
          Quick Escalate
        </Button>

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

function DataField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={value ? 'font-medium' : 'text-muted-foreground/50'}>
        {value ? value.replace(/_/g, ' ') : '—'}
      </span>
    </div>
  )
}
