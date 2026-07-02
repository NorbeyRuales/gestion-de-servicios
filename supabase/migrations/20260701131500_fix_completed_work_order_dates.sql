-- Evita que una orden marcada como terminada falle si no se envía fecha de finalización
-- y la fecha de inicio está en el futuro. También devuelve un mensaje claro cuando
-- la finalización se captura manualmente antes del inicio.
create or replace function public.save_work_order(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  target_code text;
  target_status public.work_order_status;
  item jsonb;
  target_start_date timestamptz;
  target_completion_date timestamptz;
begin
  if not public.has_role(array['admin', 'technician']::public.user_role[]) then
    raise exception 'No tienes permiso para guardar órdenes de trabajo';
  end if;

  target_id := nullif(payload ->> 'id', '')::uuid;
  target_status := coalesce(nullif(payload ->> 'status', '')::public.work_order_status, 'pending');
  target_start_date := nullif(payload ->> 'start_date', '')::timestamptz;
  target_completion_date := nullif(payload ->> 'completion_date', '')::timestamptz;

  if target_status in ('completed', 'invoiced') and nullif(trim(payload ->> 'work_performed'), '') is null then
    raise exception 'Debes registrar el trabajo realizado antes de terminar la orden';
  end if;

  if target_status = 'completed' and target_completion_date is null then
    target_completion_date := case
      when target_start_date is not null and target_start_date > now() then target_start_date
      else now()
    end;
  end if;

  if target_start_date is not null and target_completion_date is not null and target_completion_date < target_start_date then
    raise exception 'La fecha de finalización no puede ser anterior a la fecha de inicio';
  end if;

  if target_id is null then
    target_id := gen_random_uuid();
    target_code := 'OT-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.work_order_code_seq')::text, 6, '0');

    insert into public.work_orders (
      id, code, client_id, execution_branch_id, area_id, asset_id, service_type_id,
      reported_problem, work_performed, observations, pending_items, status,
      assigned_to, scheduled_date, start_date, completion_date
    ) values (
      target_id,
      target_code,
      (payload ->> 'client_id')::uuid,
      (payload ->> 'execution_branch_id')::uuid,
      nullif(payload ->> 'area_id', '')::uuid,
      nullif(payload ->> 'asset_id', '')::uuid,
      (payload ->> 'service_type_id')::uuid,
      nullif(trim(payload ->> 'reported_problem'), ''),
      nullif(trim(payload ->> 'work_performed'), ''),
      nullif(trim(payload ->> 'observations'), ''),
      nullif(trim(payload ->> 'pending_items'), ''),
      target_status,
      nullif(payload ->> 'assigned_to', '')::uuid,
      nullif(payload ->> 'scheduled_date', '')::date,
      target_start_date,
      target_completion_date
    );
  else
    select code, status into target_code, target_status from public.work_orders where id = target_id for update;
    if not found then raise exception 'La orden no existe'; end if;
    if target_status = 'invoiced' then raise exception 'No se puede modificar una orden facturada'; end if;

    target_status := coalesce(nullif(payload ->> 'status', '')::public.work_order_status, target_status);

    if target_status in ('completed', 'invoiced') and nullif(trim(payload ->> 'work_performed'), '') is null then
      raise exception 'Debes registrar el trabajo realizado antes de terminar la orden';
    end if;

    if target_status = 'completed' and target_completion_date is null then
      target_completion_date := case
        when target_start_date is not null and target_start_date > now() then target_start_date
        else now()
      end;
    elsif target_status not in ('completed', 'invoiced') then
      target_completion_date := null;
    end if;

    if target_start_date is not null and target_completion_date is not null and target_completion_date < target_start_date then
      raise exception 'La fecha de finalización no puede ser anterior a la fecha de inicio';
    end if;

    update public.work_orders set
      client_id = (payload ->> 'client_id')::uuid,
      execution_branch_id = (payload ->> 'execution_branch_id')::uuid,
      area_id = nullif(payload ->> 'area_id', '')::uuid,
      asset_id = nullif(payload ->> 'asset_id', '')::uuid,
      service_type_id = (payload ->> 'service_type_id')::uuid,
      reported_problem = nullif(trim(payload ->> 'reported_problem'), ''),
      work_performed = nullif(trim(payload ->> 'work_performed'), ''),
      observations = nullif(trim(payload ->> 'observations'), ''),
      pending_items = nullif(trim(payload ->> 'pending_items'), ''),
      status = target_status,
      assigned_to = nullif(payload ->> 'assigned_to', '')::uuid,
      scheduled_date = nullif(payload ->> 'scheduled_date', '')::date,
      start_date = target_start_date,
      completion_date = target_completion_date
    where id = target_id;

    delete from public.work_order_items where work_order_id = target_id;
  end if;

  for item in select value from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) loop
    if coalesce((item ->> 'quantity')::numeric, 0) <= 0 then raise exception 'La cantidad de cada ítem debe ser mayor que cero'; end if;
    if coalesce((item ->> 'unit_price')::numeric, 0) < 0 then raise exception 'El valor unitario no puede ser negativo'; end if;
    insert into public.work_order_items (work_order_id, item_type, description, quantity, unit_price)
    values (
      target_id,
      (item ->> 'item_type')::public.work_item_type,
      trim(item ->> 'description'),
      (item ->> 'quantity')::numeric,
      (item ->> 'unit_price')::numeric
    );
  end loop;

  return target_id;
end;
$$;

revoke all on function public.save_work_order(jsonb) from public;
grant execute on function public.save_work_order(jsonb) to authenticated;
