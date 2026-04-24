CREATE TABLE IF NOT EXISTS "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text,
	"matter_id" text,
	"cm_user_id" text NOT NULL,
	"scheduled_ts" timestamp with time zone NOT NULL,
	"duration_min" integer DEFAULT 30,
	"kind" text DEFAULT 'intro_call',
	"status" text DEFAULT 'pending' NOT NULL,
	"reminders_enabled" boolean DEFAULT true,
	"reminder_log" jsonb,
	"calendar_event_id" text,
	"calendar_provider" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "call_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"call_id" text NOT NULL,
	"call_type" text NOT NULL,
	"rubric_version" text NOT NULL,
	"verdict" text,
	"value_tier" text,
	"opportunity_score" integer,
	"confidence" text,
	"overall_score" integer,
	"scores" jsonb NOT NULL,
	"raw_llm_output" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "call_transcripts" (
	"id" text PRIMARY KEY NOT NULL,
	"call_id" text NOT NULL,
	"provider" text NOT NULL,
	"segments" jsonb NOT NULL,
	"full_text" text,
	"language" text DEFAULT 'en',
	"created_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calls" (
	"id" text PRIMARY KEY NOT NULL,
	"call_type" text NOT NULL,
	"lead_id" text,
	"matter_id" text,
	"cm_user_id" text,
	"client_name" text,
	"client_phone" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"duration_sec" integer,
	"audio_file_ref" text,
	"audio_file_hash" text,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engagement_agreements" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"template_version" text NOT NULL,
	"provider" text DEFAULT 'dropbox_sign',
	"provider_envelope_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"signer_ip" text,
	"signer_email" text,
	"signer_phone" text,
	"signed_pdf_storage_key" text,
	"audit_trail_storage_key" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "injuries" (
	"id" text PRIMARY KEY NOT NULL,
	"matter_id" text,
	"lead_id" text,
	"body_region" text NOT NULL,
	"severity" text,
	"er_admitted" boolean,
	"er_facility" text,
	"icd10_codes" text[],
	"current_phase" text DEFAULT 'conservative',
	"next_action" text,
	"mmi_date" date,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"state" text NOT NULL,
	"case_type" text,
	"source" text,
	"intake_date" timestamp with time zone DEFAULT now(),
	"sla_deadline" timestamp with time zone,
	"status" text DEFAULT 'new' NOT NULL,
	"verdict" text,
	"value_tier" text,
	"opportunity_score" integer,
	"est_value_range" text,
	"assigned_to" text,
	"incident_date" date,
	"incident_state" text,
	"incident_venue" text,
	"incident_narrative" text,
	"er_visit" boolean,
	"er_facility" text,
	"police_report" text,
	"witnesses" jsonb,
	"defendant_description" text,
	"commercial_defendant" boolean,
	"client_insurance" text,
	"client_pip_bool" boolean,
	"prior_representation" boolean,
	"converted_matter_id" text,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "treatment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"injury_id" text NOT NULL,
	"matter_id" text,
	"modality" text NOT NULL,
	"status" text DEFAULT 'recommended' NOT NULL,
	"provider_name" text,
	"scheduled_date" date,
	"completed_date" date,
	"outcome" text,
	"outcome_notes" text,
	"findings" jsonb,
	"decline_reason" text,
	"depends_on" text[],
	"litify_damage_id" text,
	"auto_extracted_from_call_id" text,
	"auto_extracted_confidence" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_status_intake_date_idx" ON "leads" ("status", "intake_date" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_sla_idx" ON "leads" ("sla_deadline") WHERE "status" IN ('new', 'contacted');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calls_lead_id_idx" ON "calls" ("lead_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calls_matter_id_idx" ON "calls" ("matter_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_scores_call_id_idx" ON "call_scores" ("call_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_transcripts_call_id_idx" ON "call_transcripts" ("call_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "injuries_matter_id_idx" ON "injuries" ("matter_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "injuries_lead_id_idx" ON "injuries" ("lead_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treatment_events_injury_id_idx" ON "treatment_events" ("injury_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_cm_user_id_idx" ON "appointments" ("cm_user_id", "scheduled_ts");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_lead_id_idx" ON "appointments" ("lead_id");
