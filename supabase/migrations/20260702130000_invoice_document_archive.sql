create table public.invoice_documents (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  version integer not null check (version > 0),
  file_path text not null unique,
  invoice_status public.invoice_status not null,
  grand_total numeric(16,2) not null check (grand_total >= 0),
  paid_total numeric(16,2) not null check (paid_total >= 0),
  balance_total numeric(16,2) not null check (balance_total >= 0),
  generated_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (invoice_id, version)
);

create index invoice_documents_invoice_id_created_at_idx
on public.invoice_documents (invoice_id, created_at desc);

alter table public.invoice_documents enable row level security;

create policy authenticated_read_invoice_documents
on public.invoice_documents for select to authenticated
using (public.current_user_role() is not null);

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
  if not public.has_role(array['admin', 'billing']::public.user_role[]) then
    raise exception 'No tienes permiso para archivar facturas';
  end if;

  if nullif(trim(p_file_path), '') is null then
    raise exception 'La ruta del PDF es obligatoria';
  end if;

  select * into target_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'No se encontró la factura';
  end if;

  if target_invoice.status <> p_invoice_status
     or target_invoice.grand_total <> p_grand_total then
    raise exception 'La factura cambió mientras se generaba el PDF. Vuelve a intentarlo';
  end if;

  select coalesce(sum(amount), 0) into current_paid
  from public.payments
  where invoice_id = p_invoice_id;
  current_balance := greatest(target_invoice.grand_total - current_paid, 0);

  if p_paid_total < 0
     or p_balance_total < 0
     or round(p_paid_total + p_balance_total, 2) <> round(p_grand_total, 2)
     or round(p_paid_total, 2) <> round(current_paid, 2)
     or round(p_balance_total, 2) <> round(current_balance, 2) then
    raise exception 'Los totales del PDF no coinciden con la factura';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.invoice_documents
  where invoice_id = p_invoice_id;

  insert into public.invoice_documents (
    invoice_id,
    version,
    file_path,
    invoice_status,
    grand_total,
    paid_total,
    balance_total,
    generated_by
  ) values (
    p_invoice_id,
    next_version,
    trim(p_file_path),
    p_invoice_status,
    p_grand_total,
    p_paid_total,
    p_balance_total,
    auth.uid()
  )
  returning * into created_document;

  update public.invoices
  set pdf_path = created_document.file_path
  where id = p_invoice_id;

  return created_document;
end;
$$;

revoke all on function public.register_invoice_document(uuid, text, public.invoice_status, numeric, numeric, numeric) from public;
grant execute on function public.register_invoice_document(uuid, text, public.invoice_status, numeric, numeric, numeric) to authenticated;

create policy billing_delete_failed_invoice_uploads
on storage.objects for delete to authenticated
using (
  bucket_id = 'invoices'
  and public.has_role(array['admin', 'billing']::public.user_role[])
  and not exists (
    select 1
    from public.invoice_documents document
    where document.file_path = name
  )
);
