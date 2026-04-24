---
description: BJB v8 personal-injury intake qualification rubric. Use whenever scoring, routing, or reasoning about intake leads — the 17-category verdict taxonomy, 40+ signal flags, value tiers, and jurisdiction rules. Invoke on any task involving intake lead classification, qualification decision trees, or routing between in-house and referral-out queues.
---

# Intake Qualification Rubric (BJB v8)

Source: Claude Intake Audit v8 FINAL (Apr 24, 2026) — rule-engine + attorney-agent deep-dive on 4,945 intake records.

## 17 verdict categories

Every intake lead gets exactly one of these verdicts:

| Verdict | Meaning | Typical sign rate | Avg value |
|---|---|---|---|
| `PURSUE - HARD` | In-house state + strong injury + liability signals → priority re-engagement | 35% | $167K |
| `PURSUE - CALLBACK URGENT` | Unresponsive + strong signals → 7-touch aggressive outreach | 22% | $63K |
| `PURSUE - CALLBACK SOFT` | Some signal → one clarifying contact | 10% | $9K |
| `WATCH - INJURY MAY DEVELOP` | Liability clear, injury not yet reported → 2-4 week callback | 15% | $9K |
| `VERIFY REPRESENTED` | Prior counsel may be failing → ethics-safe check-in | 8% | $153K |
| `REFER OUT — RECALL CANDIDATE` | In-house state + signals but was referred out | 25% | $91K |
| `REFER OUT — STRONG CASE` | Out-of-state; high value; notify referral partner urgently | 30% | $276K |
| `REFER OUT — WATCH` | Out-of-state; watch for injury development | 10% | $15K |
| `REFER OUT — CALLBACK PARTNER` | Out-of-state; callback routed to partner | 18% | $163K |
| `REFER OUT — CONFIRM PARTNER` | Out-of-state; confirm partner is engaging | 8% | $175K |
| `REFER OUT — NON-INJURY` | Real matter but outside firm scope (landlord, estate, employment) | N/A | refer |
| `REFERRED OUT - CORRECT` | Existing referral was appropriate | 8% | $10K |
| `NON-CORE SPECIALTY — IN-HOUSE` | In-scope state, case type firm handles secondarily | varies | — |
| `NON-CORE SPECIALTY — REFER` | Out-of-scope case type, refer to specialist | varies | — |
| `NOT ENOUGH DETAILS` | Cannot determine without more info; callback to gather | — | — |
| `CORRECTLY REJECTED` | No injury, no liability, or truly non-actionable | 0% | $0 |

## Value tiers

- **CATASTROPHIC** — wrongful death, paralysis, or surgery + hospitalization
- **HIGH** — surgery, hospitalization, fracture, concussion, commercial defendant, multi-vehicle
- **MEDIUM** — 2+ medium green flags or confirmed herniation
- **LOW** — any green flag
- **MINIMAL** — no diagnostic signal

## Boss directives (hard constraints)

1. **In-house states:** NJ, NY, PA only. Other states → refer out regardless of case strength.
2. **Injury-focus only.** Estate, employment, landlord-tenant, consumer, defense → `REFER OUT — NON-INJURY`.
3. **Sub-$25K soft-tissue IS accepted.** Wide net. Don't reject on low value alone.
4. **SOL-expired** → `CORRECTLY REJECTED`.
5. **Already represented** → `VERIFY REPRESENTED` or `REFERRED OUT - CORRECT`.

## Green signal flags (40+) — closed set

Only use these exact strings. Do not invent, pluralize, or reword.

```
ambulance, hospitalized, er_visit, fracture, surgery_recommended,
surgery_performed, concussion_tbi, herniation, imaging_mri_ct, pt_chiro,
prescription_meds, commercial_defendant, uber_lyft, police_report, witness,
minor_victim, rear_ended, red_light_run, dog_bite, slip_fall_detail,
sloped_sidewalk, wet_floor, negligent_security, product_defect,
inadequate_maintenance, long_narrative, multi_vehicle, multi_defendant,
policy_limit_high, high_bills_damages, lost_wages, permanent_impairment,
scarring, nerve_damage, leg_pain_down, neck_pain_severe, back_pain_severe,
ongoing_treatment, uim_available, pip_available
```

## Red signal flags — closed set

```
no_injury, property_only, client_at_fault, self_inflicted, non_pi_theme,
sol_expired, intentional_assault, uninsured_defendant_no_uim,
already_represented, thin_med_mal, traffic_ticket_only, consumer_complaint,
billing_dispute, defense_matter
```

## Inference hints

- "shooting pain down my leg" → `leg_pain_down`
- Detailed chronological fact pattern → `long_narrative`
- Ambulance to ER → `ambulance` + `er_visit` (add `hospitalized` only if admitted overnight or >~6 hrs observation)
- CT/MRI mentioned → `imaging_mri_ct`
- Company name / ladder rack / work truck / logo → `commercial_defendant`
- Police called + report exists → `police_report`
- Independent third party confirmed facts → `witness`

## Decision tree

1. Non-injury matter? → `REFER OUT — NON-INJURY`.
2. SOL expired? → `CORRECTLY REJECTED`.
3. Already represented by other firm? → `VERIFY REPRESENTED` (failing counsel signals) or `REFERRED OUT - CORRECT`.
4. State ∈ {NJ, NY, PA}?
   - Strong injury + liability + reachable → `PURSUE - HARD`.
   - Strong signals + unreachable → `PURSUE - CALLBACK URGENT`.
   - Some signal + reachable → `PURSUE - CALLBACK SOFT`.
   - Liability clear, injury pending → `WATCH - INJURY MAY DEVELOP`.
   - In-scope state, non-core case type → `NON-CORE SPECIALTY — IN-HOUSE`.
   - Insufficient info → `NOT ENOUGH DETAILS`.
   - No injury / no liability → `CORRECTLY REJECTED`.
5. Other state?
   - Strong case → `REFER OUT — STRONG CASE`.
   - Watch posture → `REFER OUT — WATCH`.
   - Needs partner callback → `REFER OUT — CALLBACK PARTNER`.
   - Partner already engaged, verify → `REFER OUT — CONFIRM PARTNER`.
   - Was referred, revisit → `REFER OUT — RECALL CANDIDATE`.
   - Out-of-specialty → `NON-CORE SPECIALTY — REFER`.

## JSON output shape (when scoring)

Every scoring output is a strict JSON object matching the schema in `functions/src/scoring/intakeRubric.ts` (Zod schema `IntakeVerdictSchema`).

Required fields: `verdict`, `value_tier`, `opportunity_score`, `confidence`, `est_value_range`, `state`, `case_type`, `reasoning_bullets` (exactly 5, prefixed `[DECISION] [FIT] [SIGNAL] [RISK] [ACTION]`), `narrative`, `key_liability_facts`, `key_damages_facts`, `weaknesses_risks`, `recommended_next_action`, `green_signals`, `red_signals`, `process_scores`.

## Critical rules (apply to all scoring tasks)

1. Every `evidence_quote` must be a verbatim substring of the transcript — never paraphrase.
2. Signal lists are closed sets — do not invent new signal names.
3. Ambiguous → `NOT ENOUGH DETAILS` + lower confidence + empty evidence quote, not guessing.
4. Temperature 0 for deterministic scoring.
5. Output must be a single JSON object — no prose, no markdown, no code fences.

## Golden-set test cases

Located in `functions/src/scoring/goldens/` (to be populated). Initial golden case:
- `maria-santos-intake.json` — expected verdict `PURSUE - HARD`, tier `HIGH`, state `NJ`, case type `MVA`, opportunity score ~88, est value `$75K-$250K`.

## Process quality dimensions (separate from verdict)

- `information_capture` — DOL, state, case type, narrative, injuries, ER, police #, witnesses, other-party insurance, PIP, prior rep, SOL
- `compliance` — recording disclosure, no unauthorized legal advice, no pre-sig fee talk, conflict check, prior-rep check
- `empathy` — warmth, acknowledgment, pacing
- `call_progression` — flow, dead air, clear next steps

Each requires one verbatim `evidence_quote`. Score 0 with empty quote if no evidence.
