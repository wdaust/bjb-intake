import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { scripts, questions } from '../src/db/schema'
import 'dotenv/config'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql)

async function seed() {
  console.log('Seeding database...')

  // Clear existing data
  await db.delete(questions)
  await db.delete(scripts)

  // Create PI Auto Accident script
  const [script] = await db.insert(scripts).values({
    name: 'PI Auto Accident',
    description: 'Standard intake script for personal injury auto accident cases. Covers caller info, accident details, injuries, insurance, and medical treatment.',
  }).returning()

  console.log(`Created script: ${script.name} (${script.id})`)

  // Insert questions
  const questionData = [
    {
      order: 1,
      text: "What is the caller's full legal name?",
      helpText: 'Confirm spelling. Ask for any aliases or maiden names.',
      type: 'text',
      required: 1,
    },
    {
      order: 2,
      text: 'What is the best phone number to reach you?',
      helpText: 'Get primary and alternate numbers if available.',
      type: 'text',
      required: 1,
    },
    {
      order: 3,
      text: 'What is your date of birth?',
      helpText: 'Needed for conflict checks and medical records.',
      type: 'date',
      required: 1,
    },
    {
      order: 4,
      text: 'When did the accident occur?',
      helpText: 'Get the exact date. Note if they are unsure. Check statute of limitations.',
      type: 'date',
      required: 1,
    },
    {
      order: 5,
      text: 'Where did the accident happen?',
      helpText: 'Get the street/intersection, city, and state. Note if it was a highway.',
      type: 'text',
      required: 1,
    },
    {
      order: 6,
      text: 'Were you the driver, passenger, or pedestrian?',
      helpText: 'If passenger, note which vehicle they were in.',
      type: 'select',
      options: ['Driver', 'Passenger', 'Pedestrian', 'Cyclist', 'Other'],
      required: 1,
    },
    {
      order: 7,
      text: 'Briefly describe how the accident happened.',
      helpText: 'Let the caller tell their story. Note key details: who hit whom, direction of impact, road conditions, traffic signals.',
      type: 'textarea',
      required: 1,
    },
    {
      order: 8,
      text: 'Was a police report filed?',
      helpText: 'If yes, ask for the report number and which department responded.',
      type: 'select',
      options: ['Yes', 'No', 'Not sure'],
      required: 1,
    },
    {
      order: 9,
      text: 'What injuries did you sustain?',
      helpText: 'List all injuries mentioned. Ask specifically about head, neck, back, and any broken bones.',
      type: 'textarea',
      required: 1,
    },
    {
      order: 10,
      text: 'Have you received medical treatment?',
      helpText: 'If yes, get the hospital/doctor name and dates of treatment. Note if they went by ambulance.',
      type: 'select',
      options: ['Yes - Emergency Room', 'Yes - Urgent Care', 'Yes - Primary Doctor', 'Yes - Other', 'No - Not yet', 'No - Declined treatment'],
      required: 1,
    },
    {
      order: 11,
      text: "Do you have the other driver's insurance information?",
      helpText: 'Get the insurance company name and policy number if available. Also ask about their own insurance carrier.',
      type: 'select',
      options: ['Yes - have full info', 'Yes - partial info', 'No - hit and run', 'No - not exchanged yet'],
      required: 1,
    },
    {
      order: 12,
      text: 'Have you spoken with any other attorneys about this case?',
      helpText: 'Important for conflict check. If yes, get the firm name. Ask if they signed anything.',
      type: 'select',
      options: ['No', 'Yes - consulted but did not retain', 'Yes - currently represented'],
      required: 1,
    },
  ]

  for (const q of questionData) {
    await db.insert(questions).values({
      scriptId: script.id,
      order: q.order,
      text: q.text,
      helpText: q.helpText,
      type: q.type,
      options: q.options ?? null,
      required: q.required,
    })
  }

  console.log(`Inserted ${questionData.length} questions`)
  console.log('Seed complete!')
}

seed().catch(console.error)
