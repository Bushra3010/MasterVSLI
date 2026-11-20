# MasterVLSI — Training Institute ERP

Next.js 16 (App Router, Node.js runtime) · Supabase (Postgres, Auth, RLS, Storage) · Cloudflare Workers (via OpenNext) + Cloudflare Cron.

```
web/              Next.js app (UI, server actions, API routes for webhooks/cron/export)
supabase/         SQL migration (schema, RLS, triggers, functions) + seed
workers/cron/     Cloudflare Worker that triggers the daily validity/expiry job
```

## Modules

| Module | Where | What it does |
|---|---|---|
| Dashboard | `/dashboard` | Totals, active / on hold / expiring, fees collected vs pending, attendance by source, drives |
| Students | `/students`, `/students/new`, `/students/[id]` | Full profile (personal, contact, address, family, spouse, education, course, professional, access, fees, applications, letters) |
| Three-way attendance | `/attendance` + `/api/webhooks/{zoom,teamviewer,biometric}` | Zoom live, TeamViewer/recorded and biometric punches go into one `attendance_records` table; daily report, irregular students (< 75%), CSV/Excel export, print/PDF |
| Fees, vendors, sub-vendors | `/fees` | Student fee → vendor allocations → installments collected through sub-vendors; record payments, overdue tracking |
| Validity & expiry | `/validity` + `/api/cron/expiry` | 30/15/7/1-day reminders, auto-disable on expiry, renewal restores access |
| Access control | `/access` | One hold/activate switch flips Zoom, TeamViewer, biometric, placements and portal; per-channel overrides; audit trail |
| Placements | `/placements`, `/portal/drives` | Admin creates a drive → students answer Yes/No → "Yes" rows auto-append to a Google Sheet tab for that drive |
| Letters & certificates | `/documents`, `/verify/[serial]` | 11 templates (student + staff), unique serial numbers, QR code linking to a public verification page |
| Student portal | `/portal` | Own profile, notices, attendance, fees, drives, letters, document uploads, password change |
| Student documents | profile → Documents, `/portal/documents` | Upload resume / photo / ID proof / certificates (PDF, image, Word, ≤ 5 MB) to private Supabase Storage; staff verify; files open only for staff or their owner |
| Settings | `/settings` | Courses, batches, vendors & sub-vendors, staff (needed for staff letters) |
| Mobile app | `/manifest.webmanifest` | Installable from the phone browser ("Add to Home screen") |

## Run locally

```bash
cd web
npm install
npm run dev
```

With no Supabase env vars the app runs in **demo mode**: an in-memory seeded dataset (24 students, 4 drives, vendors, attendance) and a persona picker on the login page. Demo data resets when the server restarts.

## Connect Supabase

1. Create a Supabase project, then apply the schema:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push        # runs supabase/migrations/*
   ```
   (or paste both files in `supabase/migrations/` — schema, then grants — and `supabase/seed.sql` into the SQL editor). The grants file matters: newer Supabase projects don't give signed-in users table access by default.
2. Copy `web/.env.example` to `web/.env.local` and fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Create your user in Supabase Auth and promote it: `update profiles set role = 'admin' where id = '<user id>';`

Access rules live in the database (RLS): staff/admin can read and write everything; a student can read only their own rows and can answer drives only while their placement access is enabled.

## Integrations

| Source | Endpoint | Auth |
|---|---|---|
| Zoom (`meeting.participant_joined/left`) | `POST /api/webhooks/zoom` | `ZOOM_WEBHOOK_SECRET` (signature + URL validation handled) |
| Recorded classes / TeamViewer bridge | `POST /api/webhooks/teamviewer` `{student_ref, recording_id, watched_minutes, watched_at}` | `x-api-key: TEAMVIEWER_API_KEY` |
| Biometric devices / bridge | `POST /api/webhooks/biometric` `{punches:[{device_id, user_code, timestamp}]}` | `x-api-key: BIOMETRIC_API_KEY` |
| Google Sheets | called on each "Yes" and by "Sync to Google Sheet" | `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEET_ID` (share the sheet with the service account email) |
| Daily expiry job | `POST /api/cron/expiry` | `Authorization: Bearer CRON_SECRET` |

Students are matched by `student_access.external_ref` (Zoom email, TeamViewer ID, biometric code), falling back to enrollment number or email. Punches for a blocked channel are rejected with 403.

## Deploy to Cloudflare

```bash
cd web
npx wrangler login
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # repeat for CRON_SECRET, ZOOM_WEBHOOK_SECRET, BIOMETRIC_API_KEY, TEAMVIEWER_API_KEY, GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_SHEET_ID
npm run deploy                                      # opennextjs-cloudflare build + deploy
```

`NEXT_PUBLIC_*` values are inlined at build time, so set them in `.env.local` / CI before `npm run deploy`. Then deploy the cron worker:

```bash
cd workers/cron && npm install
npx wrangler secret put CRON_SECRET
npm run deploy      # runs daily at 06:00 IST
```

## Expiry reminder emails

The daily job records each 30/15/7/1-day reminder and each expiry, shows them to admins (Validity page) and to the student (portal notices), and emails them through [Resend](https://resend.com) when `RESEND_API_KEY` and `NOTIFY_FROM` are set (`wrangler secret put` each). Unsent reminders are retried on every run.

## Student portal logins

On a student's profile, **Create portal login** makes a Supabase login for the student's email and shows a one-time temporary password to hand over. The student changes it under **Account**.

## Tests

`web/scripts/e2e.py` drives every module through real form posts against a local demo-mode server (59 checks):

```bash
cd web
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= CRON_SECRET=e2e-secret npx next dev -p 3100
python3 scripts/e2e.py http://localhost:3100
```
