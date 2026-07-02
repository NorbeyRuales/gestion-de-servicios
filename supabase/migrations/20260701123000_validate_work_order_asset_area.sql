-- Evita relacionar una orden con un área diferente a la ubicación registrada del equipo.
create or replace function public.validate_work_order_asset_area()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  registered_area uuid;
begin
  if new.asset_id is null then return new; end if;
  select area_id into registered_area from public.assets where id = new.asset_id;
  if registered_area is not null and new.area_id is distinct from registered_area then
    raise exception 'El área de la orden debe coincidir con el área registrada del equipo';
  end if;
  return new;
end;
$$;

create trigger validate_work_order_asset_area_before
before insert or update of asset_id, area_id on public.work_orders
for each row execute function public.validate_work_order_asset_area();
