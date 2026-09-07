-- Product entities: companies, searches, intelligence, opportunities, lists

alter table public.workspaces
  add column if not exists credit_balance integer not null default 250;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  domain text,
  normalized_domain text,
  website text,
  country text,
  city text,
  industry text,
  description text,
  employee_count integer,
  status text not null default 'NEW'
    check (status in (
      'NEW','RESEARCHING','QUALIFIED','SAVED','CONTACTED','REPLIED',
      'INTERESTED','MEETING','CUSTOMER','NOT_INTERESTED','SUPPRESSED'
    )),
  notes text,
  tags text[] not null default '{}',
  source text not null default 'manual',
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index companies_workspace_status_idx on public.companies (workspace_id, status);
create unique index companies_workspace_domain_uidx
  on public.companies (workspace_id, normalized_domain)
  where normalized_domain is not null;

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  name text,
  title text,
  seniority text,
  email text,
  phone text,
  source text,
  confidence text check (confidence in ('high', 'medium', 'low')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_workspace_company_idx on public.contacts (workspace_id, company_id);

create trigger contacts_set_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

create table public.searches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  icp_id uuid references public.icps (id) on delete set null,
  name text not null,
  provider text not null default 'csv'
    check (provider in ('apify', 'csv', 'website', 'manual')),
  original_request text,
  strategy jsonb not null default '{}'::jsonb,
  input jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'running', 'completed', 'failed', 'cancelled')),
  result_count integer not null default 0,
  opportunity_count integer not null default 0,
  cost numeric(12, 6) not null default 0,
  error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index searches_workspace_created_idx on public.searches (workspace_id, created_at desc);

create trigger searches_set_updated_at
before update on public.searches
for each row execute function public.set_updated_at();

create table public.search_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  search_id uuid not null references public.searches (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (search_id, company_id)
);

create table public.website_audits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  website_score integer,
  seo_score integer,
  performance_score integer,
  ux_score integer,
  conversion_score integer,
  technical_score integer,
  summary jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index website_audits_company_idx on public.website_audits (company_id, created_at desc);

create table public.evidence_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  opportunity_id uuid,
  claim text not null,
  evidence text,
  source_url text,
  source_type text,
  extracted_text text,
  confidence text check (confidence in ('high', 'medium', 'low')),
  created_at timestamptz not null default now()
);

create index evidence_records_company_idx on public.evidence_records (company_id);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  search_id uuid references public.searches (id) on delete set null,
  icp_id uuid references public.icps (id) on delete set null,
  fit_score integer not null default 0,
  intent_score integer not null default 0,
  opportunity_score integer not null default 0,
  contactability_score integer not null default 0,
  confidence_score integer not null default 0,
  why jsonb not null default '[]'::jsonb,
  recommended_service text,
  recommended_angle text,
  recommended_contact text,
  report jsonb not null default '{}'::jsonb,
  status text not null default 'NEW'
    check (status in (
      'NEW','RESEARCHING','QUALIFIED','SAVED','CONTACTED','REPLIED',
      'INTERESTED','MEETING','CUSTOMER','NOT_INTERESTED','SUPPRESSED'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index opportunities_workspace_score_idx
  on public.opportunities (workspace_id, opportunity_score desc);

create trigger opportunities_set_updated_at
before update on public.opportunities
for each row execute function public.set_updated_at();

alter table public.evidence_records
  add constraint evidence_records_opportunity_id_fkey
  foreign key (opportunity_id) references public.opportunities (id) on delete set null;

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger lists_set_updated_at
before update on public.lists
for each row execute function public.set_updated_at();

create table public.list_members (
  list_id uuid not null references public.lists (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  primary key (list_id, company_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  opening_line text,
  angle text,
  cta text,
  body text not null,
  evidence jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.suppression_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text,
  domain text,
  reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index suppression_records_workspace_idx on public.suppression_records (workspace_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.searches enable row level security;
alter table public.search_results enable row level security;
alter table public.website_audits enable row level security;
alter table public.evidence_records enable row level security;
alter table public.opportunities enable row level security;
alter table public.lists enable row level security;
alter table public.list_members enable row level security;
alter table public.messages enable row level security;
alter table public.suppression_records enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'companies',
    'contacts',
    'searches',
    'search_results',
    'website_audits',
    'evidence_records',
    'opportunities',
    'lists',
    'list_members',
    'messages',
    'suppression_records'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',
      t || '_select',
      t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.has_workspace_role(workspace_id, array[''owner'',''admin'',''member'']))',
      t || '_insert',
      t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.has_workspace_role(workspace_id, array[''owner'',''admin'',''member''])) with check (public.has_workspace_role(workspace_id, array[''owner'',''admin'',''member'']))',
      t || '_update',
      t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.has_workspace_role(workspace_id, array[''owner'',''admin'']))',
      t || '_delete',
      t
    );
  end loop;
end $$;

create policy "jobs_insert"
on public.jobs
for insert
to authenticated
with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']));

create policy "jobs_update"
on public.jobs
for update
to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']));
