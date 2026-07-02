create table public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  item_type public.work_item_type not null,
  description text not null check (char_length(trim(description)) >= 2),
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  subtotal numeric(16,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoice_line_items_invoice_idx on public.invoice_line_items(invoice_id);
create trigger invoice_line_items_updated_at before update on public.invoice_line_items
for each row execute function public.set_updated_at();

alter table public.invoice_line_items enable row level security;
create policy authenticated_read_invoice_line_items on public.invoice_line_items
for select to authenticated using (public.current_user_role() is not null);
create policy billing_write_invoice_line_items on public.invoice_line_items
for all to authenticated
using (public.has_role(array['admin','billing']::public.user_role[]))
with check (public.has_role(array['admin','billing']::public.user_role[]));

create or replace function public.recalculate_invoice(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  totals record;
  paid numeric(16,2);
  invoice_total numeric(16,2);
  current_status public.invoice_status;
begin
  select
    coalesce(sum(i.subtotal) filter (where i.item_type = 'material'), 0) materials,
    coalesce(sum(i.subtotal) filter (where i.item_type = 'spare_part'), 0) spare_parts,
    coalesce(sum(i.subtotal) filter (where i.item_type = 'labor'), 0) labor,
    coalesce(sum(i.subtotal) filter (where i.item_type = 'transport'), 0) transport,
    coalesce(sum(i.subtotal) filter (where i.item_type in ('rental', 'other')), 0) other
  into totals
  from (
    select item.item_type, item.subtotal
    from public.invoice_work_orders link
    join public.work_order_items item on item.work_order_id = link.work_order_id
    where link.invoice_id = p_invoice_id
    union all
    select item_type, subtotal
    from public.invoice_line_items
    where invoice_id = p_invoice_id
  ) i;

  update public.invoices
  set materials_total = totals.materials,
      spare_parts_total = totals.spare_parts,
      labor_total = totals.labor,
      transport_total = totals.transport,
      other_total = totals.other,
      grand_total = greatest(totals.materials + totals.spare_parts + totals.labor + totals.transport + totals.other - discount_total, 0)
  where id = p_invoice_id;

  select grand_total, status into invoice_total, current_status from public.invoices where id = p_invoice_id;
  if current_status <> 'void' then
    select coalesce(sum(amount), 0) into paid from public.payments where invoice_id = p_invoice_id;
    update public.invoices set status = case
      when paid <= 0 then 'pending'::public.invoice_status
      when paid < invoice_total then 'partial'::public.invoice_status
      else 'paid'::public.invoice_status
    end where id = p_invoice_id;
  end if;
end;
$$;

create or replace function public.trigger_recalculate_invoice_line_item()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_invoice(old.invoice_id);
    return old;
  end if;
  perform public.recalculate_invoice(new.invoice_id);
  return new;
end;
$$;

create trigger recalculate_invoice_line_items
after insert or update or delete on public.invoice_line_items
for each row execute function public.trigger_recalculate_invoice_line_item();

create or replace function public.create_manual_invoice(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  target_number text;
  target_client_id uuid;
  target_branch_id uuid;
  target_issue_date date;
  target_due_date date;
  target_discount numeric(16,2);
  items jsonb;
  item jsonb;
  calculated_subtotal numeric(16,2) := 0;
begin
  if not public.has_role(array['admin', 'billing']::public.user_role[]) then
    raise exception 'No tienes permiso para crear facturas';
  end if;

  target_client_id := (payload ->> 'client_id')::uuid;
  target_branch_id := nullif(payload ->> 'billing_branch_id', '')::uuid;
  target_issue_date := coalesce(nullif(payload ->> 'issue_date', '')::date, current_date);
  target_due_date := nullif(payload ->> 'due_date', '')::date;
  target_discount := coalesce(nullif(payload ->> 'discount_total', '')::numeric, 0);
  items := coalesce(payload -> 'items', '[]'::jsonb);

  if not exists (select 1 from public.clients where id = target_client_id) then raise exception 'No se encontró el cliente'; end if;
  if target_branch_id is not null and not exists (select 1 from public.branches where id = target_branch_id and client_id = target_client_id) then raise exception 'La sede de cobro no pertenece al cliente'; end if;
  if target_due_date is not null and target_due_date < target_issue_date then raise exception 'La fecha de vencimiento no puede ser anterior a la fecha de emisión'; end if;
  if jsonb_array_length(items) = 0 then raise exception 'Agrega al menos un concepto a la factura'; end if;

  for item in select value from jsonb_array_elements(items) entry(value) loop
    if coalesce(item ->> 'item_type', '') not in ('material','spare_part','labor','transport','rental','other') then raise exception 'Tipo de concepto no válido'; end if;
    if char_length(trim(coalesce(item ->> 'description', ''))) < 2 then raise exception 'Todos los conceptos deben tener una descripción'; end if;
    if coalesce((item ->> 'quantity')::numeric, 0) <= 0 then raise exception 'La cantidad debe ser mayor que cero'; end if;
    if coalesce((item ->> 'unit_price')::numeric, -1) < 0 then raise exception 'El valor unitario no puede ser negativo'; end if;
    calculated_subtotal := calculated_subtotal + round((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric, 2);
  end loop;

  if target_discount < 0 or target_discount > calculated_subtotal then raise exception 'El descuento debe estar entre cero y el subtotal'; end if;

  target_id := gen_random_uuid();
  target_number := 'FAC-' || to_char(target_issue_date, 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
  insert into public.invoices (id, invoice_number, client_id, billing_branch_id, issue_date, due_date, discount_total, notes)
  values (target_id, target_number, target_client_id, target_branch_id, target_issue_date, target_due_date, target_discount, nullif(trim(payload ->> 'notes'), ''));

  for item in select value from jsonb_array_elements(items) entry(value) loop
    insert into public.invoice_line_items (invoice_id, item_type, description, quantity, unit_price)
    values (target_id, (item ->> 'item_type')::public.work_item_type, trim(item ->> 'description'), (item ->> 'quantity')::numeric, (item ->> 'unit_price')::numeric);
  end loop;

  perform public.recalculate_invoice(target_id);
  return jsonb_build_object('id', target_id, 'invoice_number', target_number);
end;
$$;

revoke all on function public.create_manual_invoice(jsonb) from public;
grant execute on function public.create_manual_invoice(jsonb) to authenticated;
