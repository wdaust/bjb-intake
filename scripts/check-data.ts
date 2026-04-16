import pg from 'pg'
import 'dotenv/config'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function main() {
  // Check what matters look like
  const { rows: matters } = await pool.query(`
    SELECT m.sf_id, m.name, m.display_name, m.status, m.case_type, m.practice_area,
           m.matter_stage, m.pi_status, m.matter_state, m.open_date,
           m.statute_of_limitations, m.incident_date, m.client_id,
           c.first_name, c.last_name, c.phone, c.email, c.mailing_state, c.birthdate,
           atty.name as attorney_name
    FROM sf_matters m
    LEFT JOIN sf_contacts c ON m.client_id = c.sf_id
    LEFT JOIN sf_users atty ON m.principal_attorney_id = atty.sf_id
    WHERE m.status NOT IN ('Closed', 'Resolved')
    ORDER BY m.open_date DESC
    LIMIT 5
  `)
  console.log('=== MATTERS (5 sample) ===')
  console.log(JSON.stringify(matters, null, 2))

  // Check distinct case types and stages
  const { rows: types } = await pool.query(`SELECT DISTINCT case_type, COUNT(*) as cnt FROM sf_matters GROUP BY case_type ORDER BY cnt DESC LIMIT 10`)
  console.log('\n=== CASE TYPES ===')
  console.log(JSON.stringify(types, null, 2))

  const { rows: stages } = await pool.query(`SELECT DISTINCT matter_stage, COUNT(*) as cnt FROM sf_matters GROUP BY matter_stage ORDER BY cnt DESC LIMIT 10`)
  console.log('\n=== MATTER STAGES ===')
  console.log(JSON.stringify(stages, null, 2))

  const { rows: statuses } = await pool.query(`SELECT DISTINCT pi_status, COUNT(*) as cnt FROM sf_matters WHERE pi_status IS NOT NULL GROUP BY pi_status ORDER BY cnt DESC LIMIT 10`)
  console.log('\n=== PI STATUSES ===')
  console.log(JSON.stringify(statuses, null, 2))

  // Check injuries
  const { rows: injuries } = await pool.query(`SELECT * FROM sf_injuries LIMIT 3`)
  console.log('\n=== INJURIES (3 sample) ===')
  console.log(JSON.stringify(injuries, null, 2))

  // Check damages/providers
  const { rows: damages } = await pool.query(`SELECT * FROM sf_damages LIMIT 3`)
  console.log('\n=== DAMAGES (3 sample) ===')
  console.log(JSON.stringify(damages, null, 2))

  // Check team members
  const { rows: team } = await pool.query(`SELECT tm.role_name, u.name, tm.matter_id FROM sf_team_members tm LEFT JOIN sf_users u ON tm.user_id = u.sf_id LIMIT 5`)
  console.log('\n=== TEAM MEMBERS (5 sample) ===')
  console.log(JSON.stringify(team, null, 2))

  // Counts
  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM sf_matters) as matters,
      (SELECT COUNT(*) FROM sf_contacts) as contacts,
      (SELECT COUNT(*) FROM sf_injuries) as injuries,
      (SELECT COUNT(*) FROM sf_damages) as damages,
      (SELECT COUNT(*) FROM sf_tasks) as tasks,
      (SELECT COUNT(*) FROM sf_events) as events,
      (SELECT COUNT(*) FROM sf_team_members) as team_members,
      (SELECT COUNT(*) FROM sf_users) as users
  `)
  console.log('\n=== RECORD COUNTS ===')
  console.log(JSON.stringify(counts.rows[0], null, 2))

  await pool.end()
}

main().catch(console.error)
