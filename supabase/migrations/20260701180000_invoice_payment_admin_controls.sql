alter table public.invoices
  add column if not exists void_reason text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles(id) on delete set null;

alter table public.payments
  add column if not exists updated_at timestamptz not null default now();

create trigger payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('invoice', 'payment')),
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changes jsonb not null default '{}'::jsonb,
  performed_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
alter table public.audit_logs enable row level security;

create policy admin_read_audit_logs on public.audit_logs
for select to authenticated
using (public.has_role(array['admin']::public.user_role[]));

create or replace function public.audit_financial_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  target_type text;
  payload jsonb;
  reason text;
begin
  target_id := case when tg_op = 'DELETE' then old.id else new.id end;
  target_type := case when tg_table_name = 'invoices' then 'invoice' else 'payment' end;
  reason := nullif(current_setting('app.change_reason', true), '');
  payload := case
    when tg_op = 'INSERT' then jsonb_build_object('new', to_jsonb(new))
    when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
    else jsonb_build_object('old', to_jsonb(old))
  end;
  if reason is not null then payload := payload || jsonb_build_object('reason', reason); end if;

  insert into public.audit_logs (entity_type, entity_id, action, changes, performed_by)
  values (target_type, target_id, lower(tg_op), payload, auth.uid());
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger audit_invoices_after
after insert or update or delete on public.invoices
for each row execute function public.audit_financial_change();

create trigger audit_payments_after
after insert or update or delete on public.payments
for each row execute function public.audit_financial_change();

-- Una orden puede conservar vínculos históricos con facturas anuladas.
alter table public.invoice_work_orders
  drop constraint if exists invoice_work_orders_work_order_id_key;

create or replace function public.validate_invoice_work_order()
returns trigger language plpgsql set search_path = '' as $$
declare
  order_client uuid;
  order_status public.work_order_status;
  invoice_client uuid;
  calculated_amount numeric(16,2);
begin
  select client_id, status into order_client, order_status
  from public.work_orders where id = new.work_order_id for update;
  select client_id into invoice_client from public.invoices where id = new.invoice_id;

  if order_status <> 'completed' then
    raise exception 'Solo se pueden facturar órdenes terminadas';
  end if;
  if order_client <> invoice_client then
    raise exception 'La orden y la factura deben pertenecer al mismo cliente';
  end if;
  if exists (
    select 1
    from public.invoice_work_orders iwo
    join public.invoices i on i.id = iwo.invoice_id
    where iwo.work_order_id = new.work_order_id
      and iwo.id <> new.id
      and i.status <> 'void'
  ) then
    raise exception 'La orden ya pertenece a una factura activa';
  end if;

  select coalesce(sum(subtotal), 0) into calculated_amount
  from public.work_order_items where work_order_id = new.work_order_id;
  new.amount = calculated_amount;
  return new;
end;
$$;

create or replace function public.void_invoice(p_invoice_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.invoices%rowtype;
begin
  if not public.has_role(array['admin']::public.user_role[]) then
    raise exception 'Solo un administrador puede anular facturas';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Debes registrar un motivo de anulación';
  end if;

  select * into target from public.invoices where id = p_invoice_id for update;
  if target.id is null then raise exception 'La factura no existe'; end if;
  if target.status = 'void' then raise exception 'La factura ya está anulada'; end if;
  if exists (select 1 from public.payments where invoice_id = p_invoice_id) then
    raise exception 'Elimina primero los pagos registrados en la factura';
  end if;

  perform set_config('app.change_reason', trim(p_reason), true);
  update public.invoices
  set status = 'void', void_reason = trim(p_reason), voided_at = now(), voided_by = auth.uid()
  where id = p_invoice_id;

  update public.work_orders wo
  set status = 'completed'
  from public.invoice_work_orders iwo
  where iwo.invoice_id = p_invoice_id and iwo.work_order_id = wo.id;

  return jsonb_build_object('id', p_invoice_id, 'status', 'void');
end;
$$;

create or replace function public.update_payment_admin(p_payment_id uuid, payload jsonb, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated public.payments%rowtype;
begin
  if not public.has_role(array['admin']::public.user_role[]) then
    raise exception 'Solo un administrador puede corregir pagos';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Debes registrar el motivo de la corrección';
  end if;
  perform set_config('app.change_reason', trim(p_reason), true);

  update public.payments set
    payment_date = coalesce(nullif(payload ->> 'payment_date', '')::date, payment_date),
    amount = coalesce(nullif(payload ->> 'amount', '')::numeric, amount),
    payment_method = coalesce(nullif(payload ->> 'payment_method', '')::public.payment_method, payment_method),
    received_at_branch_id = nullif(payload ->> 'received_at_branch_id', '')::uuid,
    reference = nullif(trim(payload ->> 'reference'), ''),
    notes = nullif(trim(payload ->> 'notes'), '')
  where id = p_payment_id
  returning * into updated;

  if updated.id is null then raise exception 'El pago no existe'; end if;
  return jsonb_build_object('id', updated.id, 'invoice_id', updated.invoice_id);
end;
$$;

create or replace function public.delete_payment_admin(p_payment_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted public.payments%rowtype;
begin
  if not public.has_role(array['admin']::public.user_role[]) then
    raise exception 'Solo un administrador puede eliminar pagos';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Debes registrar el motivo de la eliminación';
  end if;
  perform set_config('app.change_reason', trim(p_reason), true);

  delete from public.payments where id = p_payment_id returning * into deleted;
  if deleted.id is null then raise exception 'El pago no existe'; end if;
  return jsonb_build_object('id', deleted.id, 'invoice_id', deleted.invoice_id);
end;
$$;

revoke all on function public.void_invoice(uuid, text) from public;
revoke all on function public.update_payment_admin(uuid, jsonb, text) from public;
revoke all on function public.delete_payment_admin(uuid, text) from public;
grant execute on function public.void_invoice(uuid, text) to authenticated;
grant execute on function public.update_payment_admin(uuid, jsonb, text) to authenticated;
grant execute on function public.delete_payment_admin(uuid, text) to authenticated;
