create or replace function public.refresh_asset_last_maintenance(p_asset_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.assets
  set last_maintenance_date = (
    select max(coalesce(wo.completion_date::date, wo.scheduled_date, wo.created_at::date))
    from public.work_orders wo
    where wo.asset_id = p_asset_id
      and wo.status in ('completed', 'invoiced')
  )
  where id = p_asset_id;
$$;

create or replace function public.sync_asset_last_maintenance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.asset_id is not null then perform public.refresh_asset_last_maintenance(old.asset_id); end if;
    return old;
  end if;

  if old.asset_id is not null and old.asset_id is distinct from new.asset_id then
    perform public.refresh_asset_last_maintenance(old.asset_id);
  end if;
  if new.asset_id is not null then perform public.refresh_asset_last_maintenance(new.asset_id); end if;
  return new;
end;
$$;

create trigger sync_asset_last_maintenance_after
after insert or update of asset_id, status, completion_date, scheduled_date or delete
on public.work_orders
for each row execute function public.sync_asset_last_maintenance();

-- Inicializa la fecha para equipos que ya tienen trabajos registrados.
update public.assets a
set last_maintenance_date = history.last_date
from (
  select asset_id, max(coalesce(completion_date::date, scheduled_date, created_at::date)) as last_date
  from public.work_orders
  where asset_id is not null and status in ('completed', 'invoiced')
  group by asset_id
) history
where a.id = history.asset_id;
