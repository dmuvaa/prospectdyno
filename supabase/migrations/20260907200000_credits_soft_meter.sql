-- Credits are a meter, not a kill switch. Deduct what is left and keep the work running.
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
  current_balance integer;
  charged integer;
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

  select credit_balance into current_balance
  from public.workspaces
  where id = _workspace_id
  for update;

  if current_balance is null then
    raise exception 'Workspace not found';
  end if;

  charged := least(_credits, greatest(current_balance, 0));

  update public.workspaces
  set credit_balance = credit_balance - charged
  where id = _workspace_id
  returning credit_balance into updated_balance;

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
    charged,
    coalesce(_metadata, '{}'::jsonb) || jsonb_build_object('requested_credits', _credits),
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
    -charged,
    updated_balance,
    _event_type,
    coalesce(_metadata, '{}'::jsonb),
    _idempotency_key
  );

  return usage_row;
end;
$$;

alter table public.workspaces
  alter column credit_balance set default 5000;

update public.workspaces
set credit_balance = credit_balance + 5000;

grant execute on function public.consume_workspace_credits(uuid, integer, text, text, uuid, numeric, numeric, jsonb)
to authenticated, service_role;
