create table public.asset_code_counters (
  prefix text primary key check (prefix ~ '^[A-Z0-9]{2}$'),
  last_number integer not null check (last_number > 0)
);

alter table public.asset_code_counters enable row level security;
revoke all on table public.asset_code_counters from anon, authenticated;

insert into public.asset_code_counters (prefix, last_number)
select matches[1], max(matches[2]::integer)
from (
  select regexp_match(upper(internal_code), '^([A-Z0-9]{2})-([0-9]+)$') as matches
  from public.assets
) existing
where matches is not null
group by matches[1]
on conflict (prefix) do update
set last_number = greatest(public.asset_code_counters.last_number, excluded.last_number);

create or replace function public.asset_code_prefix(p_category text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text;
begin
  normalized := upper(translate(trim(coalesce(p_category, '')), 'ÁÉÍÓÚÜÑ', 'AEIOUUN'));
  normalized := regexp_replace(normalized, '[^A-Z0-9]', '', 'g');
  if char_length(normalized) = 0 then return 'EQ'; end if;
  if char_length(normalized) = 1 then return normalized || 'X'; end if;
  return left(normalized, 2);
end;
$$;

create or replace function public.assign_asset_internal_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_prefix text;
  next_number integer;
  candidate text;
begin
  if nullif(trim(new.internal_code), '') is not null then
    new.internal_code := upper(trim(new.internal_code));
    return new;
  end if;

  target_prefix := public.asset_code_prefix(new.category);
  loop
    insert into public.asset_code_counters (prefix, last_number)
    values (target_prefix, 1)
    on conflict (prefix) do update
    set last_number = public.asset_code_counters.last_number + 1
    returning last_number into next_number;

    candidate := target_prefix || '-' || lpad(next_number::text, 3, '0');
    exit when not exists (select 1 from public.assets where internal_code = candidate);
  end loop;

  new.internal_code := candidate;
  return new;
end;
$$;

drop trigger if exists assign_asset_internal_code_before_insert on public.assets;
create trigger assign_asset_internal_code_before_insert
before insert on public.assets
for each row execute function public.assign_asset_internal_code();

revoke all on function public.asset_code_prefix(text) from public;
