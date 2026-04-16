/**
 * Litify → Neon sync for Case Advancement OS.
 * Pulls matters, contacts, users, team members, injuries, damages, tasks, events.
 */

import 'dotenv/config'
import { queryAll } from './sf-client.js'
import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
})

async function upsert(table: string, columns: string[], rows: unknown[][]): Promise<number> {
  if (rows.length === 0) return 0

  const placeholders = rows.map((row, ri) =>
    `(${row.map((_, ci) => `$${ri * columns.length + ci + 1}`).join(', ')})`
  ).join(', ')

  const updateSet = columns
    .filter(c => c !== 'sf_id')
    .map(c => `${c} = EXCLUDED.${c}`)
    .join(', ')

  const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES ${placeholders}
    ON CONFLICT (sf_id) DO UPDATE SET ${updateSet}, synced_at = now()
  `

  const values = rows.flat()
  await pool.query(sql, values)
  return rows.length
}

// Batch upsert in groups of 100
async function batchUpsert(table: string, columns: string[], rows: unknown[][]): Promise<number> {
  let total = 0
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
    total += await upsert(table, columns, batch)
  }
  return total
}

// ============================================================
// Sync Objects
// ============================================================

async function syncUsers() {
  console.log('[SYNC] Users...')
  const records = await queryAll<Record<string, unknown>>(`
    SELECT Id, Name, Email, Username, Title, Department, IsActive,
           Attorney_Type__c
    FROM User
    WHERE IsActive = true
  `)
  const rows = records.map(r => [
    r.Id, r.Name, r.Email, r.Title, r.Department, r.IsActive, r.Attorney_Type__c,
  ])
  const count = await batchUpsert('sf_users', [
    'sf_id', 'name', 'email', 'title', 'department', 'is_active', 'attorney_type',
  ], rows)
  console.log(`  → ${count} users`)
}

async function syncContacts() {
  console.log('[SYNC] Contacts...')
  const records = await queryAll<Record<string, unknown>>(`
    SELECT Id, AccountId, FirstName, LastName, Email, Phone, MobilePhone,
           MailingStreet, MailingCity, MailingState, MailingPostalCode, Birthdate
    FROM Contact
    ORDER BY LastModifiedDate DESC
    LIMIT 2000
  `)
  const rows = records.map(r => [
    r.Id, r.AccountId, r.FirstName, r.LastName, r.Email, r.Phone, r.MobilePhone,
    r.MailingStreet, r.MailingCity, r.MailingState, r.MailingPostalCode, r.Birthdate, null,
  ])
  const count = await batchUpsert('sf_contacts', [
    'sf_id', 'account_id', 'first_name', 'last_name', 'email', 'phone', 'mobile_phone',
    'mailing_street', 'mailing_city', 'mailing_state', 'mailing_postal_code', 'birthdate', 'preferred_language',
  ], rows)
  console.log(`  → ${count} contacts`)
}

async function syncMatters() {
  console.log('[SYNC] Matters...')
  const records = await queryAll<Record<string, unknown>>(`
    SELECT Id, Name, litify_pm__Display_Name__c, litify_pm__Status__c,
           litify_pm__Case_Type__c, litify_pm__Practice_Area2__c,
           litify_pm__Matter_Stage_Activity_Formula__c, PI_Status__c,
           litify_pm__Matter_State__c, litify_pm__Client__c,
           litify_pm__Principal_Attorney__c, litify_pm__Originating_Attorney__c,
           litify_pm__Open_Date__c, litify_pm__Close_Date__c,
           Complaint_Filed_Date__c,
           litify_pm__Statute_Of_Limitations__c,
           litify_pm__Gross_Recovery__c, litify_pm__Net_Recovery__c
    FROM litify_pm__Matter__c
    WHERE litify_pm__Status__c != 'Closed'
    ORDER BY litify_pm__Open_Date__c DESC
  `)
  const rows = records.map(r => [
    r.Id, r.Name, r.litify_pm__Display_Name__c, r.litify_pm__Status__c,
    r.litify_pm__Case_Type__c, r.litify_pm__Practice_Area2__c,
    r.litify_pm__Matter_Stage_Activity_Formula__c, r.PI_Status__c,
    r.litify_pm__Matter_State__c, r.litify_pm__Client__c,
    r.litify_pm__Principal_Attorney__c, r.litify_pm__Originating_Attorney__c,
    r.litify_pm__Open_Date__c, r.litify_pm__Close_Date__c,
    r.Complaint_Filed_Date__c, null, // incident_date — from intakes
    null, // retention_date — not in SF
    r.litify_pm__Statute_Of_Limitations__c,
    null, // venue — not in SF
    r.litify_pm__Gross_Recovery__c ? Math.round(Number(r.litify_pm__Gross_Recovery__c) * 100) : null,
    r.litify_pm__Net_Recovery__c ? Math.round(Number(r.litify_pm__Net_Recovery__c) * 100) : null,
  ])
  const count = await batchUpsert('sf_matters', [
    'sf_id', 'name', 'display_name', 'status', 'case_type', 'practice_area',
    'matter_stage', 'pi_status', 'matter_state', 'client_id',
    'principal_attorney_id', 'originating_attorney_id',
    'open_date', 'close_date', 'complaint_filed_date', 'incident_date',
    'retention_date', 'statute_of_limitations', 'venue',
    'gross_recovery', 'net_recovery',
  ], rows)
  console.log(`  → ${count} matters`)
}

async function syncTeamMembers() {
  console.log('[SYNC] Team Members...')
  const records = await queryAll<Record<string, unknown>>(`
    SELECT Id, Name, litify_pm__Matter__c, litify_pm__User__c, Role_Name__c
    FROM litify_pm__Matter_Team_Member__c
    WHERE litify_pm__Matter__c != null
    LIMIT 2000
  `)
  const rows = records.map(r => [
    r.Id, r.litify_pm__Matter__c, r.litify_pm__User__c, r.Role_Name__c,
  ])
  const count = await batchUpsert('sf_team_members', [
    'sf_id', 'matter_id', 'user_id', 'role_name',
  ], rows)
  console.log(`  → ${count} team members`)
}

async function syncInjuries() {
  console.log('[SYNC] Injuries...')
  const records = await queryAll<Record<string, unknown>>(`
    SELECT Id, Name, litify_pm__Matter__c,
           litify_pm__Body_Part__c, litify_pm__Area_Affected__c,
           litify_pm__Diagnosis__c, litify_pm__Injury_Date__c,
           Current_Injury_Status__c, litify_pm__Is_Diagnosed__c
    FROM litify_pm__Injury__c
    WHERE litify_pm__Matter__c != null
    LIMIT 2000
  `)
  const rows = records.map(r => [
    r.Id, r.litify_pm__Matter__c, r.litify_pm__Body_Part__c, r.litify_pm__Area_Affected__c,
    r.litify_pm__Diagnosis__c, r.litify_pm__Injury_Date__c, r.Current_Injury_Status__c, r.litify_pm__Is_Diagnosed__c ?? false,
  ])
  const count = await batchUpsert('sf_injuries', [
    'sf_id', 'matter_id', 'body_part', 'area_affected',
    'diagnosis', 'injury_date', 'current_status', 'is_diagnosed',
  ], rows)
  console.log(`  → ${count} injuries`)
}

async function syncDamages() {
  console.log('[SYNC] Damages (providers/treatment)...')
  const records = await queryAll<Record<string, unknown>>(`
    SELECT Id, Name, litify_pm__Matter__c, litify_pm__Provider_Name__c,
           litify_pm__Type__c, litify_pm__Amount_Billed__c,
           litify_pm__Amount_Paid__c, litify_pm__Service_Start_Date__c, litify_pm__Service_End_Date__c
    FROM litify_pm__Damage__c
    WHERE litify_pm__Matter__c != null
    LIMIT 2000
  `)
  const rows = records.map(r => [
    r.Id, r.litify_pm__Matter__c, r.litify_pm__Provider_Name__c,
    r.litify_pm__Type__c,
    r.litify_pm__Amount_Billed__c ? Math.round(Number(r.litify_pm__Amount_Billed__c) * 100) : null,
    r.litify_pm__Amount_Paid__c ? Math.round(Number(r.litify_pm__Amount_Paid__c) * 100) : null,
    r.litify_pm__Service_Start_Date__c, r.litify_pm__Service_End_Date__c,
  ])
  const count = await batchUpsert('sf_damages', [
    'sf_id', 'matter_id', 'provider_name', 'type',
    'amount_billed', 'amount_paid', 'service_start_date', 'service_end_date',
  ], rows)
  console.log(`  → ${count} damages`)
}

async function syncTasks() {
  console.log('[SYNC] Tasks...')
  const records = await queryAll<Record<string, unknown>>(`
    SELECT Id, Subject, WhatId, WhoId, Status, Priority, Type,
           ActivityDate, IsClosed, CompletedDateTime, Description,
           litify_pm__Matter__c, OwnerId
    FROM Task
    WHERE litify_pm__Matter__c != null
    ORDER BY ActivityDate DESC
    LIMIT 2000
  `)
  const rows = records.map(r => [
    r.Id, r.Subject, r.WhatId, r.WhoId, r.Status, r.Priority, r.Type,
    r.ActivityDate, r.IsClosed ?? false, r.CompletedDateTime, r.Description,
    r.litify_pm__Matter__c, r.OwnerId,
  ])
  const count = await batchUpsert('sf_tasks', [
    'sf_id', 'subject', 'what_id', 'who_id', 'status', 'priority', 'type',
    'activity_date', 'is_closed', 'completed_date', 'description',
    'matter_id', 'owner_id',
  ], rows)
  console.log(`  → ${count} tasks`)
}

async function syncEvents() {
  console.log('[SYNC] Events...')
  const records = await queryAll<Record<string, unknown>>(`
    SELECT Id, Subject, WhatId, WhoId, Type, StartDateTime, EndDateTime,
           DurationInMinutes, Location, IsAllDayEvent, Description,
           litify_pm__Matter__c
    FROM Event
    WHERE litify_pm__Matter__c != null
    ORDER BY StartDateTime DESC
    LIMIT 2000
  `)
  const rows = records.map(r => [
    r.Id, r.Subject, r.WhatId, r.WhoId, r.Type,
    r.StartDateTime, r.EndDateTime, r.DurationInMinutes,
    r.Location, r.IsAllDayEvent ?? false, r.Description,
    r.litify_pm__Matter__c,
  ])
  const count = await batchUpsert('sf_events', [
    'sf_id', 'subject', 'what_id', 'who_id', 'type',
    'start_date', 'end_date', 'duration_minutes',
    'location', 'is_all_day', 'description', 'matter_id',
  ], rows)
  console.log(`  → ${count} events`)
}

async function syncIntakes() {
  console.log('[SYNC] Intakes...')
  const records = await queryAll<Record<string, unknown>>(`
    SELECT Id, Name, litify_pm__Display_Name__c, litify_pm__Status__c,
           litify_pm__Case_Type__c, litify_pm__Client__c, litify_pm__Matter__c,
           litify_pm__First_Name__c, litify_pm__Last_Name__c, litify_pm__Email__c, litify_pm__Phone__c,
           litify_pm__Incident_Date__c, litify_pm__Open_Date__c, litify_pm__Converted_Date__c,
           litify_pm__IsConverted__c, litify_pm__Qualified__c,
           litify_pm__Case_State__c, Practice_Area__c
    FROM litify_pm__Intake__c
    ORDER BY litify_pm__Open_Date__c DESC
    LIMIT 2000
  `)
  const rows = records.map(r => [
    r.Id, r.Name, r.litify_pm__Display_Name__c, r.litify_pm__Status__c,
    r.litify_pm__Case_Type__c, r.litify_pm__Client__c, r.litify_pm__Matter__c,
    r.litify_pm__First_Name__c, r.litify_pm__Last_Name__c, r.litify_pm__Email__c, r.litify_pm__Phone__c,
    r.litify_pm__Incident_Date__c, r.litify_pm__Open_Date__c, r.litify_pm__Converted_Date__c,
    r.litify_pm__IsConverted__c ?? false, r.litify_pm__Qualified__c ?? false,
    r.litify_pm__Case_State__c, r.Practice_Area__c,
  ])
  const count = await batchUpsert('sf_intakes', [
    'sf_id', 'name', 'display_name', 'status', 'case_type', 'client_id', 'matter_id',
    'first_name', 'last_name', 'email', 'phone',
    'incident_date', 'open_date', 'converted_date',
    'is_converted', 'qualified', 'case_state', 'practice_area',
  ], rows)
  console.log(`  → ${count} intakes`)
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('=== Case Advancement OS — Litify Sync ===')
  console.log(`Started at ${new Date().toISOString()}`)

  // Create tables
  const { readFileSync } = await import('fs')
  const { resolve } = await import('path')
  const schemaSQL = readFileSync(resolve(process.cwd(), 'sync/schema.sql'), 'utf-8')
  await pool.query(schemaSQL)
  console.log('[DB] Schema applied')

  // Sync in order (parents first) — each independent
  const syncs = [
    ['Users', syncUsers],
    ['Contacts', syncContacts],
    ['Matters', syncMatters],
    ['Team Members', syncTeamMembers],
    ['Injuries', syncInjuries],
    ['Damages', syncDamages],
    ['Tasks', syncTasks],
    ['Events', syncEvents],
    ['Intakes', syncIntakes],
  ] as const

  for (const [name, fn] of syncs) {
    try {
      await fn()
    } catch (err) {
      console.error(`[ERROR] ${name} sync failed:`, (err as Error).message)
    }
  }

  console.log(`\n=== Sync complete at ${new Date().toISOString()} ===`)
  await pool.end()
}

main().catch((err) => {
  console.error('Sync failed:', err)
  process.exit(1)
})
