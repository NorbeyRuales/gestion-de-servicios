create or replace function public.delete_unused_user(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles%rowtype;
begin
  if not public.has_role(array['admin']::public.user_role[]) then
    raise exception 'Solo un administrador puede eliminar usuarios';
  end if;
  if p_user_id = auth.uid() then raise exception 'No puedes eliminar tu propia cuenta'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Debes registrar un motivo de al menos 5 caracteres'; end if;

  select * into target from public.profiles where id = p_user_id for update;
  if not found then raise exception 'No se encontró el usuario'; end if;
  if target.is_active then raise exception 'Desactiva el usuario antes de eliminarlo'; end if;

  if exists (select 1 from public.work_orders where created_by = p_user_id or assigned_to = p_user_id)
     or exists (select 1 from public.work_order_photos where uploaded_by = p_user_id)
     or exists (select 1 from public.asset_photos where uploaded_by = p_user_id)
     or exists (select 1 from public.invoices where created_by = p_user_id)
     or exists (select 1 from public.payments where created_by = p_user_id)
     or exists (select 1 from public.payment_proofs where uploaded_by = p_user_id)
     or exists (select 1 from public.invoice_documents where generated_by = p_user_id)
     or exists (select 1 from public.audit_logs where performed_by = p_user_id)
     or exists (select 1 from public.deletion_logs where deleted_by = p_user_id) then
    raise exception 'No se puede eliminar porque el usuario tiene actividad registrada. Déjalo inactivo para conservar el historial';
  end if;

  delete from auth.users where id = p_user_id;
  insert into public.deletion_logs (entity_type, entity_id, entity_label, reason, record_snapshot, deleted_by)
  values ('user', p_user_id, target.full_name || ' (' || target.email || ')', trim(p_reason), to_jsonb(target), auth.uid());
end;
$$;

revoke all on function public.delete_unused_user(uuid, text) from public;
grant execute on function public.delete_unused_user(uuid, text) to authenticated;

create or replace function public.update_invoice_before_payment(p_invoice_id uuid, payload jsonb)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.invoices%rowtype;
  updated public.invoices%rowtype;
  target_branch uuid;
  target_issue_date date;
  target_due_date date;
  target_discount numeric(16,2);
  subtotal numeric(16,2);
begin
  if not public.has_role(array['admin', 'billing']::public.user_role[]) then
    raise exception 'No tienes permiso para editar facturas';
  end if;

  select * into target from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'No se encontró la factura'; end if;
  if target.status = 'void' then raise exception 'No se puede editar una factura anulada'; end if;
  if exists (select 1 from public.payments where invoice_id = p_invoice_id) then
    raise exception 'No se puede editar una factura con pagos registrados';
  end if;

  target_branch := nullif(payload ->> 'billing_branch_id', '')::uuid;
  target_issue_date := coalesce(nullif(payload ->> 'issue_date', '')::date, target.issue_date);
  target_due_date := nullif(payload ->> 'due_date', '')::date;
  target_discount := coalesce((payload ->> 'discount_total')::numeric, target.discount_total);
  subtotal := target.materials_total + target.spare_parts_total + target.labor_total + target.transport_total + target.other_total;

  if target_due_date is not null and target_due_date < target_issue_date then raise exception 'La fecha de vencimiento no puede ser anterior a la emisión'; end if;
  if target_discount < 0 or target_discount > subtotal then raise exception 'El descuento debe estar entre cero y el subtotal'; end if;
  if target_branch is not null and not exists (select 1 from public.branches where id = target_branch and client_id = target.client_id) then
    raise exception 'La sede de cobro no pertenece al cliente';
  end if;

  perform set_config('app.change_reason', 'Edición administrativa antes del primer pago', true);
  update public.invoices
  set billing_branch_id = target_branch,
      issue_date = target_issue_date,
      due_date = target_due_date,
      discount_total = target_discount,
      notes = nullif(trim(coalesce(payload ->> 'notes', '')), '')
  where id = p_invoice_id
  returning * into updated;

  perform public.recalculate_invoice(p_invoice_id);
  select * into updated from public.invoices where id = p_invoice_id;
  return updated;
end;
$$;

revoke all on function public.update_invoice_before_payment(uuid, jsonb) from public;
grant execute on function public.update_invoice_before_payment(uuid, jsonb) to authenticated;

create or replace function public.register_invoice_document(
  p_invoice_id uuid,
  p_file_path text,
  p_invoice_status public.invoice_status,
  p_grand_total numeric,
  p_paid_total numeric,
  p_balance_total numeric
)
returns public.invoice_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_invoice public.invoices%rowtype;
  next_version integer;
  current_paid numeric(16,2);
  current_balance numeric(16,2);
  created_document public.invoice_documents%rowtype;
begin
  if not public.has_role(array['admin', 'billing']::public.user_role[]) then raise exception 'No tienes permiso para archivar facturas'; end if;
  if nullif(trim(p_file_path), '') is null then raise exception 'La ruta del PDF es obligatoria'; end if;

  select * into target_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'No se encontró la factura'; end if;
  if target_invoice.status <> p_invoice_status or target_invoice.grand_total <> p_grand_total then
    raise exception 'La factura cambió mientras se generaba el PDF. Vuelve a intentarlo';
  end if;

  select coalesce(sum(amount), 0) into current_paid from public.payments where invoice_id = p_invoice_id;
  current_balance := greatest(target_invoice.grand_total - current_paid, 0);
  if p_paid_total < 0 or p_balance_total < 0
     or round(p_paid_total + p_balance_total, 2) <> round(p_grand_total, 2)
     or round(p_paid_total, 2) <> round(current_paid, 2)
     or round(p_balance_total, 2) <> round(current_balance, 2) then
    raise exception 'Los totales del PDF no coinciden con la factura';
  end if;

  select coalesce(max(version), 0) + 1 into next_version from public.invoice_documents where invoice_id = p_invoice_id;
  insert into public.invoice_documents (invoice_id, version, file_path, invoice_status, grand_total, paid_total, balance_total, generated_by)
  values (p_invoice_id, next_version, trim(p_file_path), p_invoice_status, p_grand_total, p_paid_total, p_balance_total, auth.uid())
  returning * into created_document;

  update public.invoices set pdf_path = created_document.file_path where id = p_invoice_id;
  update public.invoice_documents set created_at = clock_timestamp() where id = created_document.id returning * into created_document;
  return created_document;
end;
$$;
