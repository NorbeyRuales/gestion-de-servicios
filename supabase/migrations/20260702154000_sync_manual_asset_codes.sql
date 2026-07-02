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
  manual_match text[];
begin
  if nullif(trim(new.internal_code), '') is not null then
    new.internal_code := upper(trim(new.internal_code));
    manual_match := regexp_match(new.internal_code, '^([A-Z0-9]{2})-([0-9]+)$');
    if manual_match is not null then
      insert into public.asset_code_counters (prefix, last_number)
      values (manual_match[1], manual_match[2]::integer)
      on conflict (prefix) do update
      set last_number = greatest(public.asset_code_counters.last_number, excluded.last_number);
    end if;
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
