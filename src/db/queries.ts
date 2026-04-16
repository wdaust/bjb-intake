import { db } from './index'
import { scripts, questions, sessions, responses } from './schema'
import { eq, asc, desc, count } from 'drizzle-orm'

// Scripts
export async function getScripts() {
  return db.select().from(scripts).orderBy(asc(scripts.name))
}

export async function getScriptWithQuestions(scriptId: string) {
  const [script] = await db.select().from(scripts).where(eq(scripts.id, scriptId))
  const qs = await db.select().from(questions).where(eq(questions.scriptId, scriptId)).orderBy(asc(questions.order))
  return { script, questions: qs }
}

export async function getQuestionCount(scriptId: string) {
  const [result] = await db.select({ count: count() }).from(questions).where(eq(questions.scriptId, scriptId))
  return result.count
}

// Sessions
export async function createSession(scriptId: string, operatorName?: string) {
  const [session] = await db.insert(sessions).values({
    scriptId,
    operatorName,
    status: 'in_progress',
  }).returning()
  return session
}

export async function getSession(sessionId: string) {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId))
  return session
}

export async function completeSession(sessionId: string, callerName?: string) {
  const [session] = await db.update(sessions)
    .set({ status: 'completed', completedAt: new Date(), callerName })
    .where(eq(sessions.id, sessionId))
    .returning()
  return session
}

export async function getSessions() {
  return db.select().from(sessions).orderBy(desc(sessions.createdAt))
}

// Responses
export async function saveResponse(sessionId: string, questionId: string, value: string) {
  // Upsert: check if response exists for this session+question
  const existing = await db.select().from(responses)
    .where(eq(responses.sessionId, sessionId))

  const match = existing.find(r => r.questionId === questionId)

  if (match) {
    const [updated] = await db.update(responses)
      .set({ value })
      .where(eq(responses.id, match.id))
      .returning()
    return updated
  }

  const [created] = await db.insert(responses).values({
    sessionId,
    questionId,
    value,
  }).returning()
  return created
}

export async function getSessionResponses(sessionId: string) {
  return db.select().from(responses)
    .where(eq(responses.sessionId, sessionId))
    .orderBy(asc(responses.createdAt))
}
