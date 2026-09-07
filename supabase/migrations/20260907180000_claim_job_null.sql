-- claim_next_job / claim_job return a composite row of NULLs when nothing is claimed.
-- PostgREST serializes that as {"id":null,...}, which the worker treated as a real job.

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

  if claimed.id is null then
    return null;
  end if;

  return claimed;
end;
$$;

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

  if claimed.id is null then
    return null;
  end if;

  return claimed;
end;
$$;
