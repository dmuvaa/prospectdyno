-- ProspectDyno foundation schema
-- Sprint 1: workspaces, auth profiles, ICPs, usage, jobs, audit

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Workspaces
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  company_name text,
  website text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_name_not_empty check (char_length(trim(name)) > 0),
  constraint workspaces_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);

create or replace function public.is_workspace_member(_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = _workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_role(_workspace_id uuid, _roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = _workspace_id
      and user_id = auth.uid()
      and role = any (_roles)
  );
$$;

create or replace function public.create_workspace(workspace_name text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace public.workspaces;
  base_slug text;
  final_slug text;
  suffix int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(trim(workspace_name)) = 0 then
    raise exception 'Workspace name is required';
  end if;

  base_slug := trim(both '-' from lower(regexp_replace(workspace_name, '[^a-zA-Z0-9]+', '-', 'g')));
  if base_slug = '' then
    base_slug := 'workspace';
  end if;

  final_slug := base_slug;

  while exists (select 1 from public.workspaces where slug = final_slug) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix::text;
  end loop;

  insert into public.workspaces (name, slug, created_by)
  values (trim(workspace_name), final_slug, auth.uid())
  returning * into new_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace.id, auth.uid(), 'owner');

  return new_workspace;
end;
$$;

-- ---------------------------------------------------------------------------
-- ICPs
-- ---------------------------------------------------------------------------

create table public.icps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  original_prompt text not null,
  interpretation jsonb not null default '{}'::jsonb,
  criteria jsonb not null default '{}'::jsonb,
  custom_criteria jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index icps_workspace_id_idx on public.icps (workspace_id);
create index icps_workspace_status_idx on public.icps (workspace_id, status);

create trigger icps_set_updated_at
before update on public.icps
for each row execute function public.set_updated_at();

create table public.icp_versions (
  id uuid primary key default gen_random_uuid(),
  icp_id uuid not null references public.icps (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version integer not null,
  original_prompt text not null,
  interpretation jsonb not null,
  criteria jsonb not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (icp_id, version)
);

create index icp_versions_workspace_id_idx on public.icp_versions (workspace_id);

-- ---------------------------------------------------------------------------
-- Jobs, usage, audit
-- ---------------------------------------------------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  job_type text not null,
  entity_type text,
  entity_id uuid,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  attempts integer not null default 0,
  error text,
  cost numeric(12, 6) not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_workspace_status_idx on public.jobs (workspace_id, status);
create index jobs_workspace_created_idx on public.jobs (workspace_id, created_at desc);

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  quantity integer not null default 1,
  unit_cost numeric(12, 6) not null default 0,
  total_cost numeric(12, 6) not null default 0,
  credits integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create index usage_events_workspace_created_idx
  on public.usage_events (workspace_id, created_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_workspace_created_idx
  on public.audit_logs (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.icps enable row level security;
alter table public.icp_versions enable row level security;
alter table public.jobs enable row level security;
alter table public.usage_events enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_self_or_teammates"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.workspace_members me
    join public.workspace_members teammate
      on teammate.workspace_id = me.workspace_id
    where me.user_id = auth.uid()
      and teammate.user_id = profiles.id
  )
);

create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "workspaces_select_member"
on public.workspaces
for select
to authenticated
using (public.is_workspace_member(id));

create policy "workspaces_update_admin"
on public.workspaces
for update
to authenticated
using (public.has_workspace_role(id, array['owner', 'admin']))
with check (public.has_workspace_role(id, array['owner', 'admin']));

create policy "workspaces_delete_owner"
on public.workspaces
for delete
to authenticated
using (public.has_workspace_role(id, array['owner']));

create policy "workspace_members_select"
on public.workspace_members
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "workspace_members_insert_admin"
on public.workspace_members
for insert
to authenticated
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "workspace_members_update_admin"
on public.workspace_members
for update
to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "workspace_members_delete_admin"
on public.workspace_members
for delete
to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "icps_select"
on public.icps
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "icps_insert"
on public.icps
for insert
to authenticated
with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']));

create policy "icps_update"
on public.icps
for update
to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']));

create policy "icps_delete"
on public.icps
for delete
to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "icp_versions_select"
on public.icp_versions
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "icp_versions_insert"
on public.icp_versions
for insert
to authenticated
with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']));

create policy "jobs_select"
on public.jobs
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "usage_events_select"
on public.usage_events
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "usage_events_insert"
on public.usage_events
for insert
to authenticated
with check (
  public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])
  and (user_id is null or user_id = auth.uid())
);

create policy "audit_logs_select"
on public.audit_logs
for select
to authenticated
using (public.is_workspace_member(workspace_id));

-- Writes to jobs, usage, and audit logs go through the service-role client.

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, text[]) to authenticated;
grant execute on function public.create_workspace(text) to authenticated;
