alter table public.deletion_logs
drop constraint if exists deletion_logs_entity_type_check;

alter table public.deletion_logs
add constraint deletion_logs_entity_type_check
check (entity_type in ('client', 'branch', 'area', 'asset', 'service_type', 'work_order', 'user', 'invoice'));

create or replace function public.delete_invoice_admin(p_invoice_id uuid, p_reason text)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.invoices%rowtype;
  file_paths text[];
begin
  if not public.has_role(array['admin']::public.user_role[]) then
    raise exception 'Solo un administrador puede eliminar facturas';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Debes registrar un motivo de al menos 5 caracteres';
  end if;

  select * into target from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'No se encontró la factura'; end if;
  if exists (select 1 from public.payments where invoice_id = p_invoice_id) then
    raise exception 'No se puede eliminar una factura con pagos. Corrige o elimina primero los pagos registrados';
  end if;

  select coalesce(array_agg(distinct path), array[]::text[]) into file_paths
  from (
    select file_path as path from public.invoice_documents where invoice_id = p_invoice_id
    union all
    select target.pdf_path where target.pdf_path is not null
  ) files
  where path is not null;

  delete from public.invoice_documents where invoice_id = p_invoice_id;
  delete from public.invoices where id = p_invoice_id;

  insert into public.deletion_logs (entity_type, entity_id, entity_label, reason, record_snapshot, deleted_by)
  values ('invoice', p_invoice_id, target.invoice_number, trim(p_reason), to_jsonb(target), auth.uid());

  return file_paths;
end;
$$;

revoke all on function public.delete_invoice_admin(uuid, text) from public;
grant execute on function public.delete_invoice_admin(uuid, text) to authenticated;
