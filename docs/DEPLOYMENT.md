# Deployment Runbook

Reverse-engineered from the live AWS infrastructure and git history (no original
deployment notes survived — see caveat at the bottom). Treat resource names/IDs
below as current as of 2026-09-16; re-verify before relying on them long after.

## Architecture

```
Browser
  │
  ▼
CloudFront (dsswk2puqvh3r.cloudfront.net)
  │  serves static SvelteKit build
  ▼
S3 bucket: ai-scribe-frontend-giles (ap-southeast-2)

Browser fetch (Bearer <API_KEY>)
  │
  ▼
App Runner service (4bptyd6pq3.ap-southeast-2.awsapprunner.com)
  │  Express backend, runtime nodejs22
  │  reads config from Secrets Manager at startup
  ▼
Secrets Manager: prod/ai-scribe/Supabase-and-OpenAI (ap-southeast-2)
  │
  ├─► Supabase (auth + Postgres + Storage)
  └─► OpenAI (Whisper transcription + GPT-4o extraction/SOAP)
```

The backend has no persistent multi-user auth — it signs in once at startup as a
single Supabase **service account** ([serviceAccount.ts](../backend/src/infrastructure/supabase/serviceAccount.ts))
and gates all API access behind one static bearer token (`API_KEY`, checked in
[apiKey.ts](../backend/src/api/middleware/apiKey.ts)). This is a single-tenant
prototype auth model, not per-user auth — worth knowing before extending it.

## Prerequisites

- AWS CLI configured. The `giles-davis-cli` IAM user only has CloudFront/S3
  read-write; it does **not** have `secretsmanager:*` or `apprunner:*` — those
  steps below must be done in the AWS console (or widen the IAM policy first).
- Node 22, npm.
- `gh` CLI authenticated as `giles-davis-au` for GitHub operations.

## Secrets

Everything the backend needs at runtime lives in one Secrets Manager secret,
as a flat JSON object:

```
Console: https://ap-southeast-2.console.aws.amazon.com/secretsmanager/secret?name=prod%2Fai-scribe%2FSupabase-and-OpenAI&region=ap-southeast-2
```

Required keys (see [secrets.ts](../backend/src/infrastructure/aws/secrets.ts)):
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `OPENAI_API_KEY`,
`SERVICE_ACCOUNT_EMAIL`, `SERVICE_ACCOUNT_PASSWORD`, `API_KEY`.

Locally (non-production), the same shape comes from `backend/.env` instead —
see `backend/.env.example`.

**Config is cached in memory for the life of the process** (`_config` singleton
in `secrets.ts`), so editing the secret alone does nothing until the App Runner
service restarts (see below).

### Rotating the static API key

1. `openssl rand -hex 32` for a new value.
2. Update `API_KEY` in the Secrets Manager secret above (edit the JSON, only
   that field).
3. Force an App Runner redeploy so the new secret is picked up (below).
4. Update `frontend/.env.production`'s `VITE_API_KEY` to match, rebuild, and
   redeploy the frontend (below) — the frontend bakes this in at build time,
   it is not read at runtime.

## Backend deployment (App Runner)

- Service URL: `https://4bptyd6pq3.ap-southeast-2.awsapprunner.com`
- Config: [backend/apprunner.yaml](../backend/apprunner.yaml) — runtime
  `nodejs22`, build = `npm install && npm run build`, run = `npm run start`,
  port 3000.
- Env vars set directly in `apprunner.yaml` (not secret): `NODE_ENV`,
  `AWS_SECRET_NAME`, `FRONTEND_URL` (must match the CloudFront domain, for CORS
  — see [app.ts](../backend/src/app.ts)).
- **Whether App Runner auto-deploys on push to `main` is not confirmed** — the
  CLI user can't query the service config (`apprunner:ListServices` denied).
  Check the service's "Deployment trigger" setting in the console; if it's
  manual, trigger a deployment from there (or `aws apprunner start-deployment`
  once IAM allows it) after any secret rotation or `apprunner.yaml` change.

## Frontend deployment (S3 + CloudFront)

There is no deploy script in the repo — this has always been a manual build +
sync. From `frontend/`:

```bash
npm run build
aws s3 sync build/ s3://ai-scribe-frontend-giles --delete
aws cloudfront create-invalidation --distribution-id E2YUJB2IQCESXX --paths "/*"
```

- Bucket: `ai-scribe-frontend-giles` (ap-southeast-2)
- CloudFront distribution: `E2YUJB2IQCESXX` → `dsswk2puqvh3r.cloudfront.net`
- Build-time env: `frontend/.env.production` (`VITE_API_BASE_URL`,
  `VITE_API_KEY`) — SvelteKit with `adapter-static`, so these are baked into
  the static bundle, not read at runtime. Changing either requires a rebuild
  and re-sync, not just an env change.

⚠️ `frontend/.env.production` is currently committed to git with a real
`VITE_API_KEY` value in plaintext. If you haven't already rotated and fixed
this, do that before treating this file as a template.

## CI (Buildkite)

Runs on pushes/PRs — visible in commit history (`trigger status check` style
commits) but **the pipeline definition is not in this repo**; it's configured
directly in the Buildkite UI against this GitHub repo. Currently it appears to
run backend Jest tests only (`backend/package.json`'s `test` script); no
evidence it triggers the App Runner or S3/CloudFront deploys above — those are
still manual per this runbook.

## Local development

```bash
# backend
cd backend && cp .env.example .env   # fill in values
npm install
npm run dev        # tsx watch, http://localhost:3000

# frontend
cd frontend && cp .env.example .env.local   # fill in values
npm install
npm run dev         # vite dev, http://localhost:5173
```

## Known gaps

- No infrastructure-as-code (App Runner, S3, CloudFront, Secrets Manager were
  all set up by hand) — a redeploy-from-scratch is undocumented.
- Frontend deploy is a manual local `sync` + `invalidation`, not CI-driven.
- `giles-davis-cli` IAM user lacks permissions to inspect or manage
  Secrets Manager / App Runner — console access (or a broader policy) is
  required for those steps.
- App Runner's auto-deploy setting is unverified (see above).
- **No rate limiting anywhere in the backend.** The single static `API_KEY`
  gates every route including `POST /sessions/:id/audio`
  ([upload.ts](../backend/src/api/middleware/upload.ts)), which accepts up to
  50MB per request and triggers one OpenAI Whisper call plus two GPT-4o calls.
  Anyone with the key can script repeated uploads with no built-in throttle.
  **Mitigation: set a hard spend limit / usage alert on the OpenAI account**
  (platform.openai.com → Billing → Limits) — this is the only real backstop
  against a runaway bill, since the app itself won't stop them.
- **Supabase is on the Free tier, no card on file** — so it structurally can't
  produce a surprise invoice, but it can break the app: 1GB file storage cap
  and 5GB/month egress, both shared across every session ever processed by the
  single service account. At the 50MB per-upload ceiling, roughly **20
  malicious uploads exhaust the entire storage quota**, after which Supabase's
  soft-enforcement kicks in (grace period, then blocked uploads / read-only DB
  until the next billing cycle) — a denial-of-service risk against the live
  demo, not a financial one. Same static key also allows reading every session
  ever created via `GET /sessions` (no per-user scoping), which is a data
  exposure risk independent of tier.
- **AWS App Runner is no longer accepting new customers as of 2026-04-30**
  (per an in-console banner). Existing services keep running unaffected, no
  action needed now — but if this deployment is ever rebuilt from scratch, AWS
  is steering new users to **Amazon ECS Express Mode** instead.

## Why this document exists

This project was originally built in a Claude Code **terminal** session back
in March. Terminal sessions and this app's sessions don't share transcript
history, and no separate deployment notes were kept — so when picking this
project back up, none of the actual "how we set this up" conversation was
recoverable, only a short distilled memory summary (stack + a few key
decisions, no deployment steps). This runbook was reconstructed by reading the
live AWS resources and repo history directly, precisely so that gap doesn't
recur. Keep it updated when the deployment process changes.
