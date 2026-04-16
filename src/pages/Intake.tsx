import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getSession, getScriptWithQuestions, getSessionResponses, saveResponse, completeSession } from '@/db/queries'

interface Question {
  id: string
  order: number
  text: string
  helpText: string | null
  type: string
  options: unknown
  required: number
}

export function Intake() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [scriptName, setScriptName] = useState('')
  const [questionList, setQuestionList] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    async function load() {
      if (!sessionId) return
      const session = await getSession(sessionId)
      if (!session) return

      if (session.status === 'completed') {
        setCompleted(true)
        setLoading(false)
        return
      }

      const { script, questions } = await getScriptWithQuestions(session.scriptId)
      setScriptName(script.name)
      setQuestionList(questions)

      // Load existing responses
      const existing = await getSessionResponses(sessionId)
      const answerMap: Record<string, string> = {}
      for (const r of existing) {
        answerMap[r.questionId] = r.value ?? ''
      }
      setAnswers(answerMap)

      // Resume at first unanswered question
      const firstUnanswered = questions.findIndex(q => !answerMap[q.id])
      setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0)

      setLoading(false)
    }
    load()
  }, [sessionId])

  const currentQuestion = questionList[currentIndex]
  const currentAnswer = currentQuestion ? (answers[currentQuestion.id] ?? '') : ''
  const isFirst = currentIndex === 0
  const isLast = currentIndex === questionList.length - 1
  const answeredCount = questionList.filter(q => answers[q.id]?.trim()).length

  const setCurrentAnswer = useCallback((value: string) => {
    if (!currentQuestion) return
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }))
  }, [currentQuestion])

  async function handleSaveAndMove(direction: 'next' | 'prev') {
    if (!sessionId || !currentQuestion) return

    // Save current answer if it has content
    if (currentAnswer.trim()) {
      setSaving(true)
      await saveResponse(sessionId, currentQuestion.id, currentAnswer.trim())
      setSaving(false)
    }

    if (direction === 'next') {
      if (isLast) {
        // Complete the session
        const callerName = answers[questionList[0]?.id] ?? undefined
        await completeSession(sessionId, callerName)
        setCompleted(true)
      } else {
        setCurrentIndex(i => i + 1)
      }
    } else {
      setCurrentIndex(i => Math.max(0, i - 1))
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading intake session...</p>
  }

  if (completed) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <div className="rounded-lg border bg-card p-8">
          <h1 className="text-2xl font-bold tracking-tight mb-2">Intake Complete</h1>
          <p className="text-muted-foreground mb-6">
            All questions have been answered and the session has been saved.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate('/')}>
              Back to Home
            </Button>
            <Button onClick={() => navigate('/admin/sessions')}>
              View Sessions
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!currentQuestion) return null

  const options = Array.isArray(currentQuestion.options) ? currentQuestion.options as string[] : []

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{scriptName}</h1>
          <p className="text-sm text-muted-foreground">
            {answeredCount} of {questionList.length} answered
          </p>
        </div>
        <Badge variant="secondary">
          Question {currentIndex + 1} of {questionList.length}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg leading-snug">{currentQuestion.text}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentQuestion.helpText && (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
              {currentQuestion.helpText}
            </p>
          )}

          {currentQuestion.type === 'text' && (
            <div className="space-y-2">
              <Label htmlFor="answer">Answer</Label>
              <Input
                id="answer"
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder="Type your answer..."
                autoFocus
              />
            </div>
          )}

          {currentQuestion.type === 'textarea' && (
            <div className="space-y-2">
              <Label htmlFor="answer">Answer</Label>
              <Textarea
                id="answer"
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder="Type your answer..."
                rows={4}
                autoFocus
              />
            </div>
          )}

          {currentQuestion.type === 'date' && (
            <div className="space-y-2">
              <Label htmlFor="answer">Date</Label>
              <Input
                id="answer"
                type="date"
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {currentQuestion.type === 'select' && options.length > 0 && (
            <div className="space-y-2">
              <Label>Select an option</Label>
              <Select value={currentAnswer} onValueChange={(v) => { if (v) setCurrentAnswer(v) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            disabled={isFirst || saving}
            onClick={() => handleSaveAndMove('prev')}
          >
            Previous
          </Button>
          <Button
            disabled={saving || (currentQuestion.required === 1 && !currentAnswer.trim())}
            onClick={() => handleSaveAndMove('next')}
          >
            {saving ? 'Saving...' : isLast ? 'Complete Intake' : 'Next Question'}
          </Button>
        </CardFooter>
      </Card>

      {/* Progress bar */}
      <div className="flex gap-1.5">
        {questionList.map((q, i) => (
          <div
            key={q.id}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i === currentIndex
                ? 'bg-primary'
                : answers[q.id]?.trim()
                ? 'bg-primary/40'
                : 'bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
