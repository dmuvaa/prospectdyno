# ProspectDyno

AI-powered prospect intelligence. Describe an ideal customer, import or discover companies, then review evidence-backed opportunities.

## Layout

```text
app/                 pages, API routes
components/
lib/                 server actions, API auth, metering, job runner
packages/
  ai/
  engine/            CSV, Apify, website analysis
  shared/
  supabase/
supabase/            migrations
worker.ts            BullMQ worker with database-polling fallback
```

## Setup

Requires Node.js 24 LTS.

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. Apply migrations:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

3. Add `http://localhost:3000/auth/callback` to Auth redirect URLs.
4. Set `OPENAI_API_KEY` (or `OPENROUTER_API_KEY`). CSV and website-list searches work without Apify.
5. Optional: set `REDIS_URL` to enable BullMQ delivery. Without it, `pnpm worker` polls Supabase job state.
6. Optional: set `WORKER_SECRET` before exposing `/api/jobs/process`.
7. Run:

```bash
pnpm install
pnpm dev
```

Worker:

```bash
pnpm worker
```

## Product loop

ICP → search (CSV / domains / Apify) → job queue → normalization → provenance → website analysis → AI qualification → opportunity feed → lists / campaigns / CSV export / message drafts.

Authenticated JSON API under `/api/v1/*` supports session cookies and workspace-scoped `pd_` API keys: search, companies, opportunities, lists, campaigns, usage.

## Operational Notes

- Supabase is the source of record for workspace data, job status, storage artifacts, audit logs, usage events, credit transactions, API keys, and campaign state.
- Redis/BullMQ is used for queue delivery when `REDIS_URL` is configured; jobs remain claimable from Supabase for worker fallback and recovery.
- API keys are hashed before storage and only shown once at creation.
- Private Supabase Storage buckets are used for crawl artifacts, reports, CSV imports, and exports.
