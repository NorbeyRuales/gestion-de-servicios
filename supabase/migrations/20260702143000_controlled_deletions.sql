create table public.deletion_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('client', 'branch', 'area', 'asset', 'service_type', 'work_order', 'user')),
  entity_id uuid not null,
  entity_label text not null,
  reason text not null check (char_length(trim(reason)) >= 5),
  record_snapshot jsonb not null,
  deleted_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index deletion_logs_created_at_idx on public.deletion_logs (created_at desc);

alter table public.deletion_logs enable row level security;

create policy admin_read_deletion_logs
on public.deletion_logs for select to authenticated
using (public.has_role(array['admin']::public.user_role[]));

create or replace function public.delete_unused_record(
  p_entity text,
  p_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot jsonb;
  target_label text;
  target_status public.work_order_status;
begin
  if not public.has_role(array['admin']::public.user_role[]) then
    raise exception 'Solo un administrador puede eliminar registros';
  end if;

  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Debes registrar un motivo de al menos 5 caracteres';
  end if;

  case p_entity
    when 'client' then
      select to_jsonb(target), target.name into snapshot, target_label
      from public.clients target where target.id = p_id for update;
      if snapshot is null then raise exception 'No se encontró el cliente'; end if;
      if (snapshot ->> 'is_active')::boolean then raise exception 'Desactiva el cliente antes de eliminarlo'; end if;
      if exists (select 1 from public.branches where client_id = p_id)
         or exists (select 1 from public.work_orders where client_id = p_id)
         or exists (select 1 from public.invoices where client_id = p_id) then
        raise exception 'No se puede eliminar el cliente porque tiene sedes, órdenes o facturas. Desactívalo para conservar el historial';
      end if;
      delete from public.clients where id = p_id;

    when 'branch' then
      select to_jsonb(target), target.name into snapshot, target_label
      from public.branches target where target.id = p_id for update;
      if snapshot is null then raise exception 'No se encontró la sede'; end if;
      if (snapshot ->> 'is_active')::boolean then raise exception 'Desactiva la sede antes de eliminarla'; end if;
      if exists (select 1 from public.areas where branch_id = p_id)
         or exists (select 1 from public.assets where branch_id = p_id)
         or exists (select 1 from public.work_orders where execution_branch_id = p_id)
         or exists (select 1 from public.invoices where billing_branch_id = p_id)
         or exists (select 1 from public.payments where received_at_branch_id = p_id) then
        raise exception 'No se puede eliminar la sede porque tiene información relacionada. Desactívala para conservar el historial';
      end if;
      delete from public.branches where id = p_id;

    when 'area' then
      select to_jsonb(target), target.name into snapshot, target_label
      from public.areas target where target.id = p_id for update;
      if snapshot is null then raise exception 'No se encontró el área'; end if;
      if (snapshot ->> 'is_active')::boolean then raise exception 'Desactiva el área antes de eliminarla'; end if;
      if exists (select 1 from public.assets where area_id = p_id)
         or exists (select 1 from public.work_orders where area_id = p_id) then
        raise exception 'No se puede eliminar el área porque tiene equipos u órdenes relacionadas';
      end if;
      delete from public.areas where id = p_id;

    when 'asset' then
      select to_jsonb(target), concat(target.internal_code, ' - ', target.name) into snapshot, target_label
      from public.assets target where target.id = p_id for update;
      if snapshot is null then raise exception 'No se encontró el equipo'; end if;
      if (snapshot ->> 'is_active')::boolean then raise exception 'Desactiva el equipo antes de eliminarlo'; end if;
      if exists (select 1 from public.work_orders where asset_id = p_id)
         or exists (select 1 from public.asset_photos where asset_id = p_id) then
        raise exception 'No se puede eliminar el equipo porque tiene órdenes o fotografías. Desactívalo para conservar el historial';
      end if;
      delete from public.assets where id = p_id;

    when 'service_type' then
      select to_jsonb(target), target.name into snapshot, target_label
      from public.service_types target where target.id = p_id for update;
      if snapshot is null then raise exception 'No se encontró el tipo de servicio'; end if;
      if (snapshot ->> 'is_active')::boolean then raise exception 'Desactiva el tipo de servicio antes de eliminarlo'; end if;
      if exists (select 1 from public.work_orders where service_type_id = p_id) then
        raise exception 'No se puede eliminar el tipo de servicio porque ya fue usado en órdenes. Desactívalo';
      end if;
      delete from public.service_types where id = p_id;

    when 'work_order' then
      select to_jsonb(target), target.code, target.status into snapshot, target_label, target_status
      from public.work_orders target where target.id = p_id for update;
      if snapshot is null then raise exception 'No se encontró la orden'; end if;
      if target_status not in ('pending', 'cancelled') then
        raise exception 'Solo se pueden eliminar órdenes pendientes o canceladas';
      end if;
      if exists (select 1 from public.invoice_work_orders where work_order_id = p_id) then
        raise exception 'No se puede eliminar una orden vinculada a una factura';
      end if;
      if exists (select 1 from public.work_order_photos where work_order_id = p_id) then
        raise exception 'Elimina primero las fotografías de la orden para evitar archivos huérfanos';
      end if;
      delete from public.work_orders where id = p_id;

    else
      raise exception 'Tipo de registro no permitido';
  end case;

  insert into public.deletion_logs (entity_type, entity_id, entity_label, reason, record_snapshot, deleted_by)
  values (p_entity, p_id, target_label, trim(p_reason), snapshot, auth.uid());

  return jsonb_build_object('entity', p_entity, 'id', p_id, 'label', target_label);
end;
$$;

revoke all on function public.delete_unused_record(text, uuid, text) from public;
grant execute on function public.delete_unused_record(text, uuid, text) to authenticated;
