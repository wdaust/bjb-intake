import { pgTable, uuid, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core'

export const scripts = pgTable('scripts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const questions = pgTable('questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  scriptId: uuid('script_id').references(() => scripts.id, { onDelete: 'cascade' }).notNull(),
  order: integer('order').notNull(),
  text: text('text').notNull(),
  helpText: text('help_text'),
  type: text('type').notNull().default('text'), // text, textarea, select, date, radio, checkbox
  options: jsonb('options'), // for select/radio/checkbox: ["Option A", "Option B"]
  required: integer('required').notNull().default(1), // 1 = required, 0 = optional
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  scriptId: uuid('script_id').references(() => scripts.id).notNull(),
  operatorName: text('operator_name'),
  callerName: text('caller_name'),
  status: text('status').notNull().default('in_progress'), // in_progress, completed, abandoned
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
})

export const responses = pgTable('responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  questionId: uuid('question_id').references(() => questions.id).notNull(),
  value: text('value'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
