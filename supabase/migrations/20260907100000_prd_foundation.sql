-- PRD foundation hardening: durable jobs, metering, provenance, agents,
-- campaigns, API keys, status history, notifications, and storage policies.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Existing table hardening
-- ---------------------------------------------------------------------------

alter table public.jobs
  add column if not exists locked_by text,
  add column if not exists locked_at timestamptz,
  add column if not exists run_after timestamptz not null default now(),
  add column if not exists max_attempts integer not null default 3;

create index if not exists jobs_pending_claim_idx
  on public.jobs (run_after, created_at)
  where status = 'pending';

alter table public.messages
  add column if not exists prompt_version text,
  add column if not exists provider text,
  add column if not exists model text,
  add column if not exists token_usage jsonb not null default '{}'::jsonb,
  add column if not exists cost numeric(12, 6) not null default 0,
  add column if not exists approval_status text not null default 'draft'
    check (approval_status in ('draft', 'approved', 'rejected', 'sent')),
  add column if not exists generated_by uuid references public.profiles (id) on delete set null,
  add column if not exists edited_by uuid references public.profiles (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists messages_set_updated_at on public.messages;
create trigger messages_set_updated_at
before update on public.messages
for each row execute function public.set_updated_at();

alter table public.contacts
  add column if not exists normalized_email text;

create unique index if not exists contacts_workspace_email_uidx
  on public.contacts (workspace_id, normalized_email)
  where normalized_email is not null;

alter table public.suppression_records
  add column if not exists normalized_email text,
  add column if not exists normalized_domain text;

create unique index if not exists suppression_records_workspace_email_uidx
  on public.suppression_records (workspace_id, normalized_email)
  where normalized_email is not null;

create unique index if not exists suppression_records_workspace_domain_uidx
  on public.suppression_records (workspace_id, normalized_domain)
  where normalized_domain is not null;

drop policy if exists "audit_logs_insert" on public.audit_logs;
create policy "audit_logs_insert"
on public.audit_logs
for insert
to authenticated
with check (
  workspace_id is null
  or public.is_workspace_member(workspace_id)
);

-- ---------------------------------------------------------------------------
-- Normalization and source provenance
-- ---------------------------------------------------------------------------

create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  domain text not null,
  normalized_domain text not null,
  company_id uuid references public.companies (id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (workspace_id, normalized_domain)
);

create index if not exists domains_workspace_company_idx
  on public.domains (workspace_id, company_id);

create table if not exists public.company_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  provider text not null,
  provider_record_id text,
  source_url text,
  raw jsonb not null default '{}'::jsonb,
  confidence text check (confidence in ('high', 'medium', 'low')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (workspace_id, provider, provider_record_id)
);

create index if not exists company_sources_company_idx
  on public.company_sources (workspace_id, company_id);

create table if not exists public.contact_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  provider text not null,
  provider_record_id text,
  source_url text,
  raw jsonb not null default '{}'::jsonb,
  confidence text check (confidence in ('high', 'medium', 'low')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (workspace_id, provider, provider_record_id)
);

create index if not exists contact_sources_contact_idx
  on public.contact_sources (workspace_id, contact_id);

create table if not exists public.google_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  place_id text not null,
  name text,
  rating numeric(3, 2),
  review_count integer,
  categories text[] not null default '{}',
  address text,
  phone text,
  website text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, place_id)
);

drop trigger if exists google_profiles_set_updated_at on public.google_profiles;
create trigger google_profiles_set_updated_at
before update on public.google_profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Research, enrichment, scoring, and agent observability
-- ---------------------------------------------------------------------------

create table if not exists public.research_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  icp_id uuid references public.icps (id) on delete set null,
  budget jsonb not null default '{}'::jsonb,
  input jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_jobs_workspace_status_idx
  on public.research_jobs (workspace_id, status, created_at desc);

drop trigger if exists research_jobs_set_updated_at on public.research_jobs;
create trigger research_jobs_set_updated_at
before update on public.research_jobs
for each row execute function public.set_updated_at();

create table if not exists public.research_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  research_job_id uuid references public.research_jobs (id) on delete set null,
  company_id uuid references public.companies (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  structured_output jsonb not null default '{}'::jsonb,
  raw_model_response text,
  provider text,
  model text,
  prompt_version text,
  token_usage jsonb not null default '{}'::jsonb,
  cost numeric(12, 6) not null default 0,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists research_reports_company_idx
  on public.research_reports (workspace_id, company_id, created_at desc);

create table if not exists public.seo_audits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  website_audit_id uuid references public.website_audits (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  checks jsonb not null default '{}'::jsonb,
  score integer,
  created_at timestamptz not null default now()
);

create table if not exists public.technology_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  technologies jsonb not null default '[]'::jsonb,
  source text,
  confidence text check (confidence in ('high', 'medium', 'low')),
  created_at timestamptz not null default now()
);

create table if not exists public.enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  provider text not null,
  operation text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  confidence text check (confidence in ('high', 'medium', 'low')),
  cost numeric(12, 6) not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists enrichment_runs_workspace_status_idx
  on public.enrichment_runs (workspace_id, status, created_at desc);

drop trigger if exists enrichment_runs_set_updated_at on public.enrichment_runs;
create trigger enrichment_runs_set_updated_at
before update on public.enrichment_runs
for each row execute function public.set_updated_at();

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  score_type text not null,
  score integer not null check (score between 0 and 100),
  weights jsonb not null default '{}'::jsonb,
  version text not null default 'v1',
  explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists scores_workspace_entity_idx
  on public.scores (workspace_id, company_id, opportunity_id, created_at desc);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  agent_type text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  provider text,
  model text,
  tokens integer not null default 0,
  cost numeric(12, 6) not null default 0,
  duration_ms integer,
  status text not null default 'running'
    check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists agent_runs_workspace_type_idx
  on public.agent_runs (workspace_id, agent_type, created_at desc);

create table if not exists public.agent_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_run_id uuid not null references public.agent_runs (id) on delete cascade,
  step_type text not null,
  tool_name text,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  duration_ms integer,
  cost numeric(12, 6) not null default 0,
  status text not null default 'completed'
    check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists agent_steps_run_idx
  on public.agent_steps (workspace_id, agent_run_id, created_at);

-- ---------------------------------------------------------------------------
-- Credits, usage, and status history
-- ---------------------------------------------------------------------------

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  amount integer not null,
  balance_after integer not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists credit_transactions_workspace_created_idx
  on public.credit_transactions (workspace_id, created_at desc);

create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  entity_type text not null check (entity_type in ('company', 'opportunity', 'campaign_lead')),
  entity_id uuid not null,
  old_status text,
  new_status text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists status_history_entity_idx
  on public.status_history (workspace_id, entity_type, entity_id, created_at desc);

create or replace function public.track_company_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.status_history (
      workspace_id,
      entity_type,
      entity_id,
      old_status,
      new_status,
      changed_by
    )
    values (
      new.workspace_id,
      'company',
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists companies_status_history on public.companies;
create trigger companies_status_history
after insert or update of status on public.companies
for each row execute function public.track_company_status_change();

create or replace function public.track_opportunity_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.status_history (
      workspace_id,
      entity_type,
      entity_id,
      old_status,
      new_status,
      changed_by
    )
    values (
      new.workspace_id,
      'opportunity',
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists opportunities_status_history on public.opportunities;
create trigger opportunities_status_history
after insert or update of status on public.opportunities
for each row execute function public.track_opportunity_status_change();

create or replace function public.consume_workspace_credits(
  _workspace_id uuid,
  _credits integer,
  _event_type text,
  _idempotency_key text,
  _user_id uuid default null,
  _unit_cost numeric default 0,
  _total_cost numeric default 0,
  _metadata jsonb default '{}'::jsonb
)
returns public.usage_events
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.usage_events;
  updated_balance integer;
  usage_row public.usage_events;
begin
  select * into existing
  from public.usage_events
  where idempotency_key = _idempotency_key;

  if found then
    return existing;
  end if;

  if _credits < 0 then
    raise exception 'Credits must be non-negative';
  end if;

  update public.workspaces
  set credit_balance = credit_balance - _credits
  where id = _workspace_id
    and credit_balance >= _credits
  returning credit_balance into updated_balance;

  if updated_balance is null then
    raise exception 'Insufficient credits';
  end if;

  insert into public.usage_events (
    workspace_id,
    user_id,
    event_type,
    quantity,
    unit_cost,
    total_cost,
    credits,
    metadata,
    idempotency_key
  )
  values (
    _workspace_id,
    _user_id,
    _event_type,
    1,
    _unit_cost,
    _total_cost,
    _credits,
    coalesce(_metadata, '{}'::jsonb),
    _idempotency_key
  )
  returning * into usage_row;

  insert into public.credit_transactions (
    workspace_id,
    user_id,
    amount,
    balance_after,
    reason,
    metadata,
    idempotency_key
  )
  values (
    _workspace_id,
    _user_id,
    -_credits,
    updated_balance,
    _event_type,
    coalesce(_metadata, '{}'::jsonb),
    _idempotency_key
  );

  return usage_row;
end;
$$;

grant execute on function public.consume_workspace_credits(uuid, integer, text, text, uuid, numeric, numeric, jsonb)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Atomic job claiming
-- ---------------------------------------------------------------------------

create or replace function public.claim_next_job(
  _worker_id text default null,
  _job_types text[] default null
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.jobs;
begin
  with next_job as (
    select id
    from public.jobs
    where status = 'pending'
      and attempts < max_attempts
      and run_after <= now()
      and (_job_types is null or job_type = any (_job_types))
    order by created_at asc
    for update skip locked
    limit 1
  )
  update public.jobs jobs
  set
    status = 'running',
    locked_by = coalesce(_worker_id, 'worker'),
    locked_at = now(),
    started_at = coalesce(jobs.started_at, now()),
    attempts = jobs.attempts + 1,
    updated_at = now()
  from next_job
  where jobs.id = next_job.id
  returning jobs.* into claimed;

  return claimed;
end;
$$;

grant execute on function public.claim_next_job(text, text[]) to service_role;

create or replace function public.claim_job(
  _job_id uuid,
  _worker_id text default null
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.jobs;
begin
  update public.jobs
  set
    status = 'running',
    locked_by = coalesce(_worker_id, 'worker'),
    locked_at = now(),
    started_at = coalesce(started_at, now()),
    attempts = attempts + 1,
    updated_at = now()
  where id = _job_id
    and status = 'pending'
    and attempts < max_attempts
    and run_after <= now()
  returning * into claimed;

  return claimed;
end;
$$;

grant execute on function public.claim_job(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Campaigns, messaging, inbox, integrations, API keys, notifications
-- ---------------------------------------------------------------------------

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  icp_id uuid references public.icps (id) on delete set null,
  list_id uuid references public.lists (id) on delete set null,
  name text not null,
  objective text,
  channel text not null default 'export'
    check (channel in ('email', 'crm', 'csv', 'api', 'manual', 'export')),
  tone text,
  cta text,
  daily_limit integer,
  business_hours jsonb not null default '{}'::jsonb,
  suppression_rules jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_workspace_status_idx
  on public.campaigns (workspace_id, status, created_at desc);

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

create table if not exists public.campaign_leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  status text not null default 'NEW'
    check (status in (
      'NEW','RESEARCHING','QUALIFIED','CONTACTED','REPLIED','INTERESTED',
      'MEETING','OPPORTUNITY','CUSTOMER','NOT_INTERESTED','SUPPRESSED'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, company_id)
);

create index if not exists campaign_leads_campaign_idx
  on public.campaign_leads (workspace_id, campaign_id, status);

drop trigger if exists campaign_leads_set_updated_at on public.campaign_leads;
create trigger campaign_leads_set_updated_at
before update on public.campaign_leads
for each row execute function public.set_updated_at();

create table if not exists public.sequences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists sequences_set_updated_at on public.sequences;
create trigger sequences_set_updated_at
before update on public.sequences
for each row execute function public.set_updated_at();

create table if not exists public.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  sequence_id uuid not null references public.sequences (id) on delete cascade,
  step_number integer not null,
  delay_days integer not null default 0,
  subject text,
  body_template text not null,
  created_at timestamptz not null default now(),
  unique (sequence_id, step_number)
);

create table if not exists public.message_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  message_id uuid references public.messages (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  event_type text not null,
  provider text,
  provider_event_id text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider, provider_event_id)
);

create index if not exists message_events_message_idx
  on public.message_events (workspace_id, message_id, created_at desc);

create table if not exists public.replies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  body text not null,
  classification text,
  confidence integer check (confidence between 0 and 100),
  recommended_action text,
  raw jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists replies_workspace_received_idx
  on public.replies (workspace_id, received_at desc);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null,
  label text,
  status text not null default 'not_configured'
    check (status in ('not_configured', 'connected', 'error', 'disabled')),
  credentials_ref text,
  scopes text[] not null default '{}',
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, label)
);

drop trigger if exists integrations_set_updated_at on public.integrations;
create trigger integrations_set_updated_at
before update on public.integrations
for each row execute function public.set_updated_at();

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists api_keys_workspace_idx
  on public.api_keys (workspace_id, created_at desc);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  provider text not null,
  event_type text not null,
  provider_event_id text,
  signature_valid boolean,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (workspace_id, user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Storage metadata and private buckets
-- ---------------------------------------------------------------------------

create table if not exists public.storage_artifacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  bucket text not null,
  object_path text not null,
  artifact_type text not null,
  entity_type text,
  entity_id uuid,
  content_type text,
  byte_size bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, object_path)
);

create index if not exists storage_artifacts_workspace_entity_idx
  on public.storage_artifacts (workspace_id, entity_type, entity_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('crawl-artifacts', 'crawl-artifacts', false, 52428800),
  ('reports', 'reports', false, 52428800),
  ('csv-imports', 'csv-imports', false, 52428800),
  ('exports', 'exports', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "workspace storage select" on storage.objects;
create policy "workspace storage select"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('crawl-artifacts', 'reports', 'csv-imports', 'exports')
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "workspace storage insert" on storage.objects;
create policy "workspace storage insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('crawl-artifacts', 'reports', 'csv-imports', 'exports')
  and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin', 'member'])
);

drop policy if exists "workspace storage update" on storage.objects;
create policy "workspace storage update"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('crawl-artifacts', 'reports', 'csv-imports', 'exports')
  and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin', 'member'])
)
with check (
  bucket_id in ('crawl-artifacts', 'reports', 'csv-imports', 'exports')
  and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin', 'member'])
);

-- ---------------------------------------------------------------------------
-- RLS for new tables
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'domains',
    'company_sources',
    'contact_sources',
    'google_profiles',
    'research_jobs',
    'research_reports',
    'seo_audits',
    'technology_profiles',
    'enrichment_runs',
    'scores',
    'agent_runs',
    'agent_steps',
    'credit_transactions',
    'status_history',
    'campaigns',
    'campaign_leads',
    'sequences',
    'sequence_steps',
    'message_events',
    'replies',
    'integrations',
    'api_keys',
    'notifications',
    'storage_artifacts'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',
      t || '_select',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.has_workspace_role(workspace_id, array[''owner'',''admin'',''member'']))',
      t || '_insert',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.has_workspace_role(workspace_id, array[''owner'',''admin'',''member''])) with check (public.has_workspace_role(workspace_id, array[''owner'',''admin'',''member'']))',
      t || '_update',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.has_workspace_role(workspace_id, array[''owner'',''admin'']))',
      t || '_delete',
      t
    );
  end loop;
end $$;

drop policy if exists webhook_events_select on public.webhook_events;
create policy webhook_events_select
on public.webhook_events
for select
to authenticated
using (workspace_id is not null and public.is_workspace_member(workspace_id));

drop policy if exists api_keys_select on public.api_keys;
drop policy if exists api_keys_insert on public.api_keys;
drop policy if exists api_keys_update on public.api_keys;
drop policy if exists api_keys_delete on public.api_keys;

create policy api_keys_select
on public.api_keys
for select
to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy api_keys_insert
on public.api_keys
for insert
to authenticated
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy api_keys_update
on public.api_keys
for update
to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy api_keys_delete
on public.api_keys
for delete
to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']));
