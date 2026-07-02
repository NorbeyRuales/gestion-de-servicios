-- Reemplaza la RPC legacy para que ninguna llamada antigua devuelva un UUID suelto.
drop function if exists public.create_invoice_from_orders(jsonb);

create or replace function public.create_invoice_from_orders(payload jsonb)
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
  order_id uuid;
  selected_orders jsonb;
begin
  if not public.has_role(array['admin', 'billing']::public.user_role[]) then
    raise exception 'No tienes permiso para crear facturas';
  end if;

  target_client_id := (payload ->> 'client_id')::uuid;
  target_branch_id := nullif(payload ->> 'billing_branch_id', '')::uuid;
  target_issue_date := coalesce(nullif(payload ->> 'issue_date', '')::date, current_date);
  target_due_date := nullif(payload ->> 'due_date', '')::date;
  target_discount := coalesce(nullif(payload ->> 'discount_total', '')::numeric, 0);
  selected_orders := coalesce(payload -> 'work_order_ids', '[]'::jsonb);

  if jsonb_array_length(selected_orders) = 0 then
    raise exception 'Selecciona al menos una orden terminada para facturar';
  end if;

  if target_due_date is not null and target_due_date < target_issue_date then
    raise exception 'La fecha de vencimiento no puede ser anterior a la fecha de emisión';
  end if;

  if target_discount < 0 then
    raise exception 'El descuento no puede ser negativo';
  end if;

  target_id := gen_random_uuid();
  target_number := 'FAC-' || to_char(target_issue_date, 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');

  insert into public.invoices (
    id, invoice_number, client_id, billing_branch_id, issue_date, due_date, discount_total, notes
  ) values (
    target_id,
    target_number,
    target_client_id,
    target_branch_id,
    target_issue_date,
    target_due_date,
    target_discount,
    nullif(trim(payload ->> 'notes'), '')
  );

  for order_id in select value::text::uuid from jsonb_array_elements(selected_orders) loop
    insert into public.invoice_work_orders (invoice_id, work_order_id)
    values (target_id, order_id);
  end loop;

  perform public.recalculate_invoice(target_id);

  return jsonb_build_object(
    'id', target_id,
    'invoice_number', target_number
  );
end;
$$;

revoke all on function public.create_invoice_from_orders(jsonb) from public;
grant execute on function public.create_invoice_from_orders(jsonb) to authenticated;
