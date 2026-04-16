import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { getCaseById } from '@/data/mockData'
import { useState } from 'react'
import type { CapturedCallData, CaseDirection, TaskItem } from '@/types'

const DIRECTION_LABELS: Record<CaseDirection, string> = {
  continue_treatment_optimization: 'Continue Treatment Optimization',
  closer_monitoring: 'Closer Monitoring Needed',
  urgent_re_engagement: 'Urgent Re-Engagement',
  next_level_care: 'Next-Level Care Consideration',
  demand_readiness_review: 'Demand-Readiness Review',
  litigation_review: 'Litigation Review',
  cut_review: 'Cut Review',
  transfer_review: 'Transfer Review',
  escalate_for_review: 'Escalate for Review',
  unresolved: 'Unresolved — Additional Facts Needed',
}

function generateNoteText(
  clientName: string,
  data: CapturedCallData,
  direction: CaseDirection,
  tasks: TaskItem[]
): string {
  const lines: string[] = []
  lines.push(`Successful contact with ${clientName}.`)
  lines.push('')

  if (data.treatmentStatus) {
    const statusMap: Record<string, string> = {
      actively_treating: 'Client is currently in active treatment.',
      stopped_treating: 'Client has stopped treating.',
      never_started: 'Client has never started treatment.',
      inconsistent: 'Client has been treating inconsistently.',
      unclear: 'Treatment status remains unclear.',
      evasive: 'Client was evasive about treatment status.',
    }
    lines.push(statusMap[data.treatmentStatus] || `Treatment status: ${data.treatmentStatus}`)
  }

  if (data.lastAppointmentDate) lines.push(`Last appointment: ${data.lastAppointmentDate}`)
  if (data.nextAppointmentStatus) {
    const apptMap: Record<string, string> = {
      scheduled: `Next appointment is scheduled${data.nextAppointmentDate ? ` for ${data.nextAppointmentDate}` : ''}.`,
      not_scheduled: 'No next appointment is currently scheduled.',
      waiting_callback: 'Client is waiting for a callback from provider.',
      referral_not_scheduled: 'Referral has been made but not yet scheduled.',
      finished_no_next: 'Client has finished with current provider and has no next step.',
      not_sure: 'Client is unsure about next appointment.',
    }
    lines.push(apptMap[data.nextAppointmentStatus] || `Next appointment: ${data.nextAppointmentStatus}`)
  }

  if (data.symptomDirection) {
    const sympMap: Record<string, string> = {
      better: 'Client reports symptoms have improved.',
      worse: 'Client reports symptoms have worsened.',
      same: 'Client reports symptoms are about the same.',
      fluctuates: 'Client reports symptoms fluctuate.',
      resolved: 'Client reports symptoms have resolved.',
      hard_to_describe: 'Client had difficulty describing current symptom status.',
    }
    lines.push(sympMap[data.symptomDirection] || `Symptoms: ${data.symptomDirection}`)
  }
  if (data.symptomDetails) lines.push(`Symptom details: ${data.symptomDetails}`)

  if (data.barrierType) {
    lines.push(`Barrier identified: ${data.barrierType.replace(/_/g, ' ')}`)
    if (data.barrierDetails) lines.push(`Barrier details: ${data.barrierDetails}`)
  }

  if (data.progressionQuality) {
    lines.push(`Treatment progression: ${data.progressionQuality.replace(/_/g, ' ')}`)
  }

  lines.push('')
  lines.push(`Current assessment: ${DIRECTION_LABELS[direction]}`)

  if (tasks.length > 0) {
    lines.push('')
    lines.push('Actions created:')
    for (const t of tasks) {
      lines.push(`- ${t.description} (${t.urgency} priority)`)
    }
  }

  if (data.notes) {
    lines.push('')
    lines.push(`Additional notes: ${data.notes}`)
  }

  return lines.join('\n')
}

export function PostCallSummary() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const cv = getCaseById(caseId || '')

  const state = (location.state || {}) as {
    capturedData?: CapturedCallData
    tasks?: TaskItem[]
    direction?: CaseDirection
  }

  const capturedData = state.capturedData || {}
  const tasks = state.tasks || []
  const direction = state.direction || 'unresolved'

  const [note, setNote] = useState(() =>
    generateNoteText(
      cv?.client.fullName || 'Client',
      capturedData,
      direction,
      tasks
    )
  )
  const [saved, setSaved] = useState(false)

  if (!cv) {
    return <p className="text-muted-foreground">Case not found.</p>
  }

  const whatWeLearned = [
    { label: 'Treatment Status', value: capturedData.treatmentStatus?.replace(/_/g, ' ') },
    { label: 'Last Appointment', value: capturedData.lastAppointmentDate },
    { label: 'Next Appointment', value: capturedData.nextAppointmentStatus?.replace(/_/g, ' ') },
    { label: 'Symptoms', value: capturedData.symptomDirection?.replace(/_/g, ' ') },
    { label: 'Barrier', value: capturedData.barrierType?.replace(/_/g, ' ') },
    { label: 'Progression', value: capturedData.progressionQuality?.replace(/_/g, ' ') },
    { label: 'Engagement', value: capturedData.engagementLevel },
    { label: 'Emotional State', value: capturedData.clientEmotionalState },
  ].filter((item) => item.value)

  const whatChanged: string[] = []
  if (capturedData.treatmentStatus) whatChanged.push('Treatment status clarified')
  if (capturedData.nextAppointmentDate) whatChanged.push('Next appointment confirmed')
  if (capturedData.nextAppointmentStatus === 'not_scheduled') whatChanged.push('No next appointment — gap identified')
  if (capturedData.barrierType) whatChanged.push(`Barrier discovered: ${capturedData.barrierType.replace(/_/g, ' ')}`)
  if (capturedData.symptomDirection === 'worse') whatChanged.push('Worsening symptoms reported')
  if (capturedData.symptomDirection === 'better' || capturedData.symptomDirection === 'resolved') whatChanged.push('Symptom improvement reported')
  if (direction !== 'unresolved' && direction !== 'continue_treatment_optimization') whatChanged.push(`Direction updated: ${DIRECTION_LABELS[direction]}`)
  if (tasks.length > 0) whatChanged.push(`${tasks.length} task(s) created`)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Post-Call Summary</h1>
          <p className="text-sm text-muted-foreground">{cv.client.fullName} — {cv.caseData.matterId}</p>
        </div>
        <Badge variant="secondary">Call Complete</Badge>
      </div>

      {/* What We Learned */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What We Learned</CardTitle>
        </CardHeader>
        <CardContent>
          {whatWeLearned.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {whatWeLearned.map((item, i) => (
                <div key={i} className="flex justify-between py-1 border-b border-dashed">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium capitalize">{item.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data captured during this call. Return to the guided call to complete the session.</p>
          )}
        </CardContent>
      </Card>

      {/* What Changed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What Changed</CardTitle>
        </CardHeader>
        <CardContent>
          {whatChanged.length > 0 ? (
            <ul className="list-disc list-inside space-y-1 text-sm">
              {whatChanged.map((change, i) => (
                <li key={i}>{change}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No significant changes detected.</p>
          )}
        </CardContent>
      </Card>

      {/* Directional Assessment */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Current Directional Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-semibold">{DIRECTION_LABELS[direction]}</p>
        </CardContent>
      </Card>

      {/* Tasks / Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Actions Created</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map((task, i) => (
                <div key={i} className="flex items-center justify-between rounded border p-3 text-sm">
                  <div>
                    <p className="font-medium">{task.description}</p>
                    {task.contextNote && <p className="text-xs text-muted-foreground">{task.contextNote}</p>}
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge variant={task.urgency === 'high' || task.urgency === 'critical' ? 'destructive' : 'secondary'}>
                      {task.urgency}
                    </Badge>
                    {task.owner && <span className="text-xs text-muted-foreground">{task.owner}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tasks created. Consider whether follow-up actions are needed.</p>
          )}
        </CardContent>
      </Card>

      {/* Generated Note */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Call Note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={12}
            className="text-sm font-mono"
          />
          <div className="flex gap-3">
            <Button onClick={() => setSaved(true)} disabled={saved}>
              {saved ? 'Saved' : 'Save to Litify'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              Back to Caseload
            </Button>
          </div>
          {saved && (
            <p className="text-sm text-green-600">Note saved successfully. (Demo — not actually sent to Litify)</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
