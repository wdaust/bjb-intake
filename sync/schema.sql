-- Case Advancement OS — Litify Data Tables
-- Synced from Salesforce via SOQL queries

-- Matters (cases)
CREATE TABLE IF NOT EXISTS sf_matters (
  sf_id TEXT PRIMARY KEY,
  name TEXT,
  display_name TEXT,
  status TEXT,
  case_type TEXT,
  practice_area TEXT,
  matter_stage TEXT,
  pi_status TEXT,
  matter_state TEXT,
  client_id TEXT,
  principal_attorney_id TEXT,
  originating_attorney_id TEXT,
  open_date DATE,
  close_date DATE,
  complaint_filed_date DATE,
  incident_date DATE,
  retention_date DATE,
  statute_of_limitations DATE,
  venue TEXT,
  gross_recovery BIGINT,
  net_recovery BIGINT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Contacts (clients)
CREATE TABLE IF NOT EXISTS sf_contacts (
  sf_id TEXT PRIMARY KEY,
  account_id TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  mobile_phone TEXT,
  mailing_street TEXT,
  mailing_city TEXT,
  mailing_state TEXT,
  mailing_postal_code TEXT,
  birthdate DATE,
  preferred_language TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Users (attorneys, case managers, MMLs)
CREATE TABLE IF NOT EXISTS sf_users (
  sf_id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  title TEXT,
  department TEXT,
  is_active BOOLEAN,
  attorney_type TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Matter Team Members (who is assigned to each case)
CREATE TABLE IF NOT EXISTS sf_team_members (
  sf_id TEXT PRIMARY KEY,
  matter_id TEXT,
  user_id TEXT,
  role_name TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Injuries
CREATE TABLE IF NOT EXISTS sf_injuries (
  sf_id TEXT PRIMARY KEY,
  matter_id TEXT,
  body_part TEXT,
  area_affected TEXT,
  diagnosis TEXT,
  injury_date DATE,
  current_status TEXT,
  is_diagnosed BOOLEAN,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Damages (treatment/provider records)
CREATE TABLE IF NOT EXISTS sf_damages (
  sf_id TEXT PRIMARY KEY,
  matter_id TEXT,
  provider_name TEXT,
  type TEXT,
  amount_billed BIGINT,
  amount_paid BIGINT,
  service_start_date DATE,
  service_end_date DATE,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Tasks (follow-ups, contact history)
CREATE TABLE IF NOT EXISTS sf_tasks (
  sf_id TEXT PRIMARY KEY,
  subject TEXT,
  what_id TEXT,
  who_id TEXT,
  status TEXT,
  priority TEXT,
  type TEXT,
  activity_date DATE,
  is_closed BOOLEAN,
  completed_date TIMESTAMPTZ,
  description TEXT,
  matter_id TEXT,
  owner_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Events (appointments, calls)
CREATE TABLE IF NOT EXISTS sf_events (
  sf_id TEXT PRIMARY KEY,
  subject TEXT,
  what_id TEXT,
  who_id TEXT,
  type TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  duration_minutes INT,
  location TEXT,
  is_all_day BOOLEAN,
  description TEXT,
  matter_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Matter Stage Activities
CREATE TABLE IF NOT EXISTS sf_stage_activities (
  sf_id TEXT PRIMARY KEY,
  matter_id TEXT,
  stage_status TEXT,
  stage_order INT,
  days_status_active INT,
  date_status_changed DATE,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Intakes
CREATE TABLE IF NOT EXISTS sf_intakes (
  sf_id TEXT PRIMARY KEY,
  name TEXT,
  display_name TEXT,
  status TEXT,
  case_type TEXT,
  client_id TEXT,
  matter_id TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  incident_date DATE,
  open_date DATE,
  converted_date DATE,
  is_converted BOOLEAN,
  qualified BOOLEAN,
  case_state TEXT,
  practice_area TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Call flow nodes (persisted from Flow Builder)
CREATE TABLE IF NOT EXISTS call_flow_nodes (
  node_id TEXT PRIMARY KEY,
  node_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- View: Full case view for the app
CREATE OR REPLACE VIEW v_case_manager_caseload AS
SELECT
  m.sf_id AS matter_sf_id,
  m.display_name AS matter_name,
  m.name AS matter_id,
  m.status,
  m.case_type,
  m.practice_area,
  m.matter_stage,
  m.pi_status,
  m.matter_state,
  m.incident_date,
  m.open_date,
  m.retention_date,
  m.statute_of_limitations,
  m.venue,
  c.sf_id AS client_sf_id,
  c.first_name || ' ' || c.last_name AS client_name,
  c.first_name AS client_first_name,
  c.phone AS client_phone,
  c.email AS client_email,
  c.mailing_state AS client_state,
  c.birthdate AS client_dob,
  -- Attorney (principal)
  atty.name AS attorney_name,
  -- Injury count
  (SELECT COUNT(*) FROM sf_injuries i WHERE i.matter_id = m.sf_id) AS injury_count,
  -- Provider count (from damages)
  (SELECT COUNT(DISTINCT d.provider_name) FROM sf_damages d WHERE d.matter_id = m.sf_id) AS provider_count,
  -- Last treatment date (most recent damage service end date)
  (SELECT MAX(d.service_end_date) FROM sf_damages d WHERE d.matter_id = m.sf_id) AS last_treatment_date,
  -- Open task count
  (SELECT COUNT(*) FROM sf_tasks t WHERE t.matter_id = m.sf_id AND t.is_closed = false) AS open_task_count,
  -- Last contact (most recent closed task or event)
  (SELECT MAX(COALESCE(t.completed_date, t.activity_date::timestamptz)) FROM sf_tasks t WHERE t.matter_id = m.sf_id AND t.is_closed = true) AS last_contact_date
FROM sf_matters m
LEFT JOIN sf_contacts c ON m.client_id = c.sf_id
LEFT JOIN sf_users atty ON m.principal_attorney_id = atty.sf_id
WHERE m.status NOT IN ('Closed', 'Resolved')
ORDER BY m.open_date DESC;
