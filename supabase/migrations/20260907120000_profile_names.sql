-- Store first/last names from Supabase Auth metadata on signup.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

update public.profiles
set
  first_name = coalesce(
    first_name,
    nullif(split_part(coalesce(full_name, ''), ' ', 1), '')
  ),
  last_name = coalesce(
    last_name,
    nullif(trim(regexp_replace(coalesce(full_name, ''), '^\S+\s*', '')), '')
  )
where full_name is not null
  and (first_name is null or last_name is null);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata_first_name text;
  metadata_last_name text;
  metadata_full_name text;
begin
  metadata_first_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), '');
  metadata_last_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), '');
  metadata_full_name := nullif(
    trim(
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        concat_ws(' ', metadata_first_name, metadata_last_name)
      )
    ),
    ''
  );

  insert into public.profiles (id, first_name, last_name, full_name)
  values (new.id, metadata_first_name, metadata_last_name, metadata_full_name)
  on conflict (id) do update
  set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    full_name = excluded.full_name;

  return new;
end;
$$;
