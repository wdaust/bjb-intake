# Deploy & credential rotation runbook

The browser no longer talks to Neon directly. All DB access goes through
**Firebase Callable Functions** (`functions/src/index.ts`), which verify
the user's Firebase ID token before running any query.

This runbook is the first-time deploy **and** the credential rotation
that closes the old public-credential exposure.

---

## One-time prerequisites

1. **Upgrade Firebase project to Blaze plan.** Callable Functions require
   pay-as-you-go billing.
   [Console → Usage and billing → Modify plan](https://console.firebase.google.com/project/bjb-intake/usage/details)

2. Make sure the Firebase CLI is logged into the right account:
   ```sh
   firebase login
   firebase use bjb-intake
   ```

## Deploy the Functions

From the repo root:

```sh
# 1. Set the Neon URL as a Firebase secret — this is the server-side,
#    full-privilege connection string. It is NOT bundled into the
#    browser; only Functions can read it.
firebase functions:secrets:set DATABASE_URL
# (paste the current postgresql://... URL when prompted)

# 2. Build + deploy
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

On success the Functions show up in the Firebase console. Smoke-test:

```sh
# Tail logs while you exercise the app:
firebase functions:log --only listCases
```

## Deploy the web app

```sh
npm run build
firebase deploy --only hosting
```

The client auto-discovers `https://us-central1-bjb-intake.cloudfunctions.net/*`
from the config in `src/lib/firebase.ts` — nothing in `.env` is needed
for the browser.

---

## Credential rotation (the point of this change)

Do these in order, **after** the Functions deploy is live and the app is
confirmed working against them.

### 1. Neon: rotate the user that the app uses

In the Neon console:

1. Create a **new role** (e.g. `app_prod`) with a new password and the
   same privileges as the current role.
2. Copy its connection string.
3. Update the Firebase secret:
   ```sh
   firebase functions:secrets:set DATABASE_URL
   # paste the NEW connection string
   firebase deploy --only functions   # required to rebind the secret
   ```
4. Update the sync worker's env wherever it runs (Railway / Fly /
   Cloud Run / local cron) with the new `DATABASE_URL`.
5. Update local `.env` (for `scripts/seed.ts`, `scripts/check-data.ts`,
   `drizzle-kit`) with the new `DATABASE_URL`.
6. **Revoke the old role** in Neon. The old password is burned and can
   never be used again — even the copies sitting in the old deployed
   `dist/` bundles on past Firebase Hosting releases are now inert.

### 2. Firebase admin password

The string `BJBadmin2026!` is in git history via `scripts/create-admin.ts`.
Rotate it:

1. Firebase console → Authentication → `admin@bjb.com` → **Reset password**.
2. Generate a new strong password, store it in 1Password / your secrets
   manager — **do not** put it back in the repo.
3. Optional: delete `scripts/create-admin.ts` entirely. The admin user
   already exists; the script would throw `auth/email-already-in-use`
   anyway. If you want it kept for future onboarding, refactor it to
   read `process.env.ADMIN_PASSWORD`.

### 3. Verify the old credentials are dead

```sh
# Old VITE_ var should be in zero files:
grep -R "VITE_DATABASE_URL" --include="*.ts" --include="*.tsx" . || echo "clean"

# Build output should not contain the Neon host or SDK:
grep -c "neon.tech\|@neondatabase" dist/assets/*.js
# → 0
```

---

## Local development

The browser app now expects Firebase Functions to be reachable. Two
options for local dev:

### Option A — hit the deployed Functions (simplest)

Just `npm run dev`. As long as you're signed in to the app, your browser
calls go straight to the real `us-central1-bjb-intake.cloudfunctions.net`
endpoints. DB reads are real.

### Option B — Functions emulator (fully offline)

```sh
# Terminal 1: start the emulator (Functions + Auth)
firebase emulators:start --only functions,auth

# Terminal 2: run Vite with the emulator flag
VITE_FUNCTIONS_EMULATOR=1 npm run dev
```

You'll need to create a local test user in the Auth emulator UI
(http://127.0.0.1:4000) and pass `DATABASE_URL` to the emulated Function:

```sh
# Either:
firebase functions:secrets:access DATABASE_URL  # copies live secret
# …or set it in functions/.env.local for the emulator only.
```

---

## Remaining P0 fixes that are NOT done by this change

- **Firestore security rules** — still none. Add `firestore.rules`,
  deploy with `firebase deploy --only firestore:rules`.
- **Responses unique constraint** — `saveResponse` race still exists.
  Apply once against Neon:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS responses_session_question_uidx
    ON responses (session_id, question_id);
  ```
  Then change the `queries.ts` upsert to `INSERT ... ON CONFLICT ... DO
  UPDATE`. (Note: `src/db/queries.ts` was deleted in this change; re-add
  the logic server-side if/when call-script responses come back.)
- **Schema split between Drizzle and `sf_*`** — Drizzle still doesn't
  model the real tables. Follow-up task.
