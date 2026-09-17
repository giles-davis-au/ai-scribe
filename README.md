# AI Scribe

By [Giles Davis](https://www.linkedin.com/in/gilesbdavis/)

An ambient clinical scribe prototype: record a conversation, and it automatically
transcribes it, extracts key clinical details, and generates a structured SOAP note.

**Live demo:** https://dsswk2puqvh3r.cloudfront.net
*(Demo only — please don't record or enter real patient or personal health
information; use a sample conversation instead.)*

## Context

This was built as a self-directed learning exercise ahead of starting with
[Lyrebird Health](https://www.lyrebirdhealth.com/), to explore the end-to-end
flow of an AI ambient medical scribe — audio capture, transcription, clinical
fact extraction, and note generation — as a single, working pipeline.

It's a prototype, not a production-hardened application. The focus was on
getting the full flow working end-to-end, not on production security, scale,
or reliability. It should not be assumed to meet production standards in any
of those areas — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the known
gaps (auth model, rate limiting, cost controls, etc.) if that level of detail
is useful.

Cost exposure is bounded by a hard, enforced spend limit on the OpenAI account
rather than in-application rate limiting; Supabase's free tier (no billing
method attached) additionally means there's no possibility of a surprise
invoice from that side, though its usage caps aren't a deliberate
rate-limiting control.

## Architecture

```
Browser
  │
  ▼
CloudFront ──serves static SvelteKit build── S3

Browser fetch (Bearer <API_KEY>)
  │
  ▼
App Runner (Express/TypeScript backend)
  │
  ├─► Supabase (auth + Postgres + Storage)
  └─► OpenAI (Whisper transcription + GPT-4o clinical extraction/SOAP generation)
```

**Flow:** a recording is uploaded to the backend, stored in Supabase Storage,
transcribed with OpenAI's Whisper, then GPT-4o extracts structured clinical
facts from the transcript and drafts a SOAP note — all persisted against the
session and returned to the frontend.

## Tech stack

- **Backend:** Node.js, TypeScript, Express, Zod
- **Frontend:** SvelteKit (static adapter)
- **Data/auth:** Supabase (Postgres, Storage, Auth)
- **AI:** OpenAI Whisper (transcription), GPT-4o (clinical extraction + SOAP notes)
- **Infrastructure:** AWS App Runner (backend), S3 + CloudFront (frontend), Secrets Manager (config)
- **Testing:** Jest unit tests for the backend (`backend/src/**/*.test.ts`). CI was set up via
  Buildkite during development but isn't actively maintained for this demo.

## Running locally

```bash
# backend
cd backend && cp .env.example .env   # fill in values
npm install
npm run dev        # http://localhost:3000

# frontend
cd frontend && cp .env.example .env.local   # fill in values
npm install
npm run dev         # http://localhost:5173
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full deployment runbook —
architecture in more detail, secrets/key rotation, and known limitations.
