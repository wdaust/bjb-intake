import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { testScenarios, type TestScenario } from '@/data/testScenarios'
import { getNode, getStartNode } from '@/data/callFlowNodes'
import type { CallNode, CapturedCallData, TaskItem } from '@/types'

type TestState = 'selecting' | 'running' | 'complete'

export function TestMode() {
  const [testState, setTestState] = useState<TestState>('selecting')
  const [scenario, setScenario] = useState<TestScenario | null>(null)
  const [currentNode, setCurrentNode] = useState<CallNode>(getStartNode())
  const [stepIndex, setStepIndex] = useState(0)
  const [nodesVisited, setNodesVisited] = useState<string[]>([])
  const [capturedData, setCapturedData] = useState<CapturedCallData>({})
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [testLog, setTestLog] = useState<{ step: number; node: string; answer: string; expected: boolean; note: string }[]>([])

  function startScenario(s: TestScenario) {
    setScenario(s)
    setTestState('running')
    setCurrentNode(getStartNode())
    setStepIndex(0)
    setNodesVisited(['opening_greeting'])
    setCapturedData({})
    setTasks([])
    setTestLog([])
  }

  function handleAnswer(answerId: string) {
    if (!scenario || !currentNode) return

    const expected = scenario.expectedAnswers[stepIndex]
    const isExpected = expected?.answerId === answerId

    // Log the step
    setTestLog(prev => [...prev, {
      step: stepIndex + 1,
      node: currentNode.nodeName,
      answer: currentNode.answerOptions.find(o => o.id === answerId)?.label || answerId,
      expected: isExpected,
      note: isExpected
        ? expected.explanation
        : `Expected: ${expected?.answerId || 'end'} — Got: ${answerId}`,
    }])

    // Apply field updates
    const newData = { ...capturedData }
    for (const fu of currentNode.fieldUpdates) {
      const val = typeof fu.value === 'function' ? fu.value(answerId) : fu.value
      ;(newData as Record<string, unknown>)[fu.field] = val
    }
    setCapturedData(newData)

    // Apply task rules
    for (const tr of currentNode.taskRules) {
      if (tr.condition === 'always' || (tr.condition === 'if_answer' && tr.answerIds?.includes(answerId))) {
        setTasks(prev => [...prev, { ...tr.task, id: `task-${Date.now()}`, status: 'pending' }])
      }
    }

    // Navigate
    const nextNodeId = currentNode.nextNodeMap[answerId] || currentNode.nextNodeMap['default']
    if (nextNodeId === 'COMPLETE') {
      setTestState('complete')
      return
    }

    const nextNode = getNode(nextNodeId || '')
    if (nextNode) {
      setCurrentNode(nextNode)
      setNodesVisited(prev => [...prev, nextNode.nodeId])
      setStepIndex(prev => prev + 1)
    } else {
      setTestState('complete')
    }
  }

  function autoRun() {
    if (!scenario) return
    // Reset
    let node = getStartNode()
    const log: typeof testLog = []
    const visited: string[] = ['opening_greeting']
    const data: CapturedCallData = {}
    const createdTasks: TaskItem[] = []

    for (let i = 0; i < scenario.expectedAnswers.length; i++) {
      const expected = scenario.expectedAnswers[i]
      if (node.nodeId !== expected.nodeId) {
        log.push({ step: i + 1, node: node.nodeName, answer: `MISMATCH — expected node ${expected.nodeId}, at ${node.nodeId}`, expected: false, note: 'Node path diverged' })
        break
      }

      const answerId = expected.answerId
      log.push({
        step: i + 1,
        node: node.nodeName,
        answer: node.answerOptions.find(o => o.id === answerId)?.label || answerId,
        expected: true,
        note: expected.explanation,
      })

      // Apply
      for (const fu of node.fieldUpdates) {
        const val = typeof fu.value === 'function' ? fu.value(answerId) : fu.value
        ;(data as Record<string, unknown>)[fu.field] = val
      }
      for (const tr of node.taskRules) {
        if (tr.condition === 'always' || (tr.condition === 'if_answer' && tr.answerIds?.includes(answerId))) {
          createdTasks.push({ ...tr.task, id: `task-${i}`, status: 'pending' })
        }
      }

      const nextId = node.nextNodeMap[answerId]
      if (!nextId || nextId === 'COMPLETE') break

      const next = getNode(nextId)
      if (!next) break
      node = next
      visited.push(node.nodeId)
    }

    setTestLog(log)
    setNodesVisited(visited)
    setCapturedData(data)
    setTasks(createdTasks)
    setTestState('complete')
    setScenario(scenario)
  }

  // ============ SELECTING ============
  if (testState === 'selecting') {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Test Mode</h1>
          <p className="text-sm text-muted-foreground">
            Select a scenario to test the guided call flow. Each scenario represents a different case type and expected path through the decision tree.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {testScenarios.map(s => (
            <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => startScenario(s)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{s.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">{s.description}</p>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-[10px]">{s.expectedAnswers.length} steps</Badge>
                  <Badge variant="outline" className="text-[10px]">{s.expectedDirection}</Badge>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={(e) => { e.stopPropagation(); startScenario(s) }}>
                    Manual Walk-Through
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setScenario(s); setTimeout(autoRun, 0) }}>
                    Auto-Run
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // ============ RUNNING ============
  if (testState === 'running' && scenario) {
    const expected = scenario.expectedAnswers[stepIndex]
    const promptText = currentNode.promptText
      .replace('[Client First Name]', scenario.caseData.client.preferredName || 'Client')
      .replace('[Client Name]', scenario.caseData.client.preferredName || 'Client')
      .replace('[CM Name]', scenario.caseData.caseData.caseManagerAssigned)
      .replace('[Firm]', 'Brandon J. Broderick')
      .replace('[Firm/Firm Team]', 'Brandon J. Broderick')

    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Testing: {scenario.name}</h1>
            <p className="text-xs text-muted-foreground">Step {stepIndex + 1} of {scenario.expectedAnswers.length} — {currentNode.nodeName}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setTestState('selecting')}>Exit Test</Button>
        </div>

        {/* Expected path hint */}
        {expected && (
          <div className="rounded-lg bg-blue-50 border-blue-200 border px-4 py-2">
            <p className="text-xs font-medium text-blue-900">Expected Answer</p>
            <p className="text-sm text-blue-800">
              <strong>{expected.answerId}</strong> — {expected.explanation}
            </p>
          </div>
        )}

        {/* Prompt */}
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-5">
            <p className="text-lg leading-relaxed">&ldquo;{promptText}&rdquo;</p>
          </CardContent>
        </Card>

        {/* Empathy coaching */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-amber-900">Empathy Coaching</p>
            <p className="text-sm text-amber-800">{currentNode.empathyGuidance}</p>
          </CardContent>
        </Card>

        {/* Answer buttons with expected highlighted */}
        <div className="grid grid-cols-2 gap-2">
          {currentNode.answerOptions.map(opt => (
            <Button
              key={opt.id}
              variant="outline"
              className={`h-auto py-3 px-4 text-left justify-start whitespace-normal ${
                expected?.answerId === opt.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => handleAnswer(opt.id)}
            >
              <div>
                <p className="font-medium text-sm">
                  {opt.label}
                  {expected?.answerId === opt.id && <span className="ml-2 text-blue-600 text-xs">(expected)</span>}
                </p>
                {opt.description && <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>}
              </div>
            </Button>
          ))}
        </div>

        {/* Log so far */}
        {testLog.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Test Log</CardTitle></CardHeader>
            <CardContent>
              {testLog.map((entry, i) => (
                <div key={i} className={`text-xs py-1 border-b flex items-center gap-2 ${entry.expected ? '' : 'bg-red-50'}`}>
                  <span className={`inline-block w-5 h-5 rounded-full text-center leading-5 text-white text-[10px] ${entry.expected ? 'bg-green-500' : 'bg-red-500'}`}>
                    {entry.expected ? '✓' : '✗'}
                  </span>
                  <span className="font-medium">{entry.node}</span>
                  <span className="text-muted-foreground">→ {entry.answer}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ============ COMPLETE ============
  if (testState === 'complete' && scenario) {
    const passCount = testLog.filter(e => e.expected).length
    const totalSteps = testLog.length
    const allPassed = passCount === totalSteps

    // Governance check
    const requiredFields = ['treatmentStatus', 'symptomDirection', 'nextAppointmentStatus']
    const missingFields = requiredFields.filter(f => !(capturedData as Record<string, unknown>)[f])
    const governancePassed = missingFields.length === 0 || scenario.id === 'voicemail' || scenario.id === 'angry-client'

    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Test Results: {scenario.name}</h1>
          <Button variant="outline" onClick={() => setTestState('selecting')}>Back to Scenarios</Button>
        </div>

        {/* Overall result */}
        <Card className={allPassed && governancePassed ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}>
          <CardContent className="p-6 text-center">
            <p className={`text-3xl font-bold ${allPassed && governancePassed ? 'text-green-700' : 'text-orange-700'}`}>
              {allPassed && governancePassed ? 'PASS' : 'REVIEW NEEDED'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {passCount}/{totalSteps} steps matched expected path
            </p>
          </CardContent>
        </Card>

        {/* Step log */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Step-by-Step Results</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {testLog.map((entry, i) => (
              <div key={i} className={`flex items-center gap-3 text-sm py-1.5 border-b ${entry.expected ? '' : 'bg-red-50'}`}>
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs ${entry.expected ? 'bg-green-500' : 'bg-red-500'}`}>
                  {entry.expected ? '✓' : '✗'}
                </span>
                <span className="font-medium w-48">{entry.node}</span>
                <span>{entry.answer}</span>
                <span className="text-xs text-muted-foreground ml-auto">{entry.note}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Nodes visited */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Nodes Visited ({nodesVisited.length})</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {nodesVisited.map((nid, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">{nid}</Badge>
            ))}
          </CardContent>
        </Card>

        {/* Data captured */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Data Captured</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {Object.entries(capturedData).filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b py-1">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium">{String(v).replace(/_/g, ' ')}</span>
              </div>
            ))}
            {Object.entries(capturedData).filter(([, v]) => v).length === 0 && (
              <p className="text-muted-foreground">No data captured (e.g., voicemail scenario)</p>
            )}
          </CardContent>
        </Card>

        {/* Governance check */}
        <Card className={governancePassed ? 'border-green-200' : 'border-red-200'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Governance Check
              <Badge variant={governancePassed ? 'default' : 'destructive'}>
                {governancePassed ? 'PASS' : 'FAIL'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {governancePassed ? (
              <p className="text-green-700">All required fields captured (or scenario is non-contact).</p>
            ) : (
              <div>
                <p className="text-red-700 mb-1">Missing required fields:</p>
                {missingFields.map(f => (
                  <Badge key={f} variant="destructive" className="mr-1 text-xs">{f}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks created */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Tasks Created ({tasks.length})</CardTitle></CardHeader>
          <CardContent>
            {tasks.length > 0 ? (
              <div className="space-y-1.5">
                {tasks.map((t, i) => (
                  <div key={i} className="text-sm p-2 rounded bg-muted flex justify-between">
                    <span>{t.description}</span>
                    <Badge variant="secondary">{t.urgency}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tasks created.</p>
            )}
          </CardContent>
        </Card>

        {/* Expected direction */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Expected Direction</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{scenario.expectedDirection}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
