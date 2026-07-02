-- Gestor de Servicios - esquema inicial para una sola empresa
create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'technician', 'billing');
create type public.asset_status as enum ('operational', 'needs_review', 'under_repair', 'out_of_service', 'retired');
create type public.work_order_status as enum ('pending', 'quoted', 'approved', 'in_progress', 'completed', 'cancelled', 'invoiced');
create type public.work_item_type as enum ('material', 'spare_part', 'labor', 'transport', 'rental', 'other');
create type public.photo_type as enum ('before', 'during', 'after', 'evidence');
create type public.invoice_status as enum ('pending', 'partial', 'paid', 'void');
create type public.payment_method as enum ('cash', 'bank_transfer', 'nequi', 'bancolombia', 'daviplata', 'other');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) >= 2),
  email text not null,
  role public.user_role not null default 'technician',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  document_type text,
  document_number text,
  phone text,
  email text,
  billing_address text,
  main_contact_name text,
  main_contact_phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_document_unique unique nulls not distinct (document_type, document_number)
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null,
  address text,
  manager_name text,
  manager_phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, name),
  unique (id, client_id)
);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, name),
  unique (id, branch_id)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  area_id uuid,
  internal_code text not null unique,
  name text not null,
  category text not null,
  brand text,
  model text,
  serial_number text,
  status public.asset_status not null default 'operational',
  purchase_date date,
  last_maintenance_date date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (area_id, branch_id) references public.areas(id, branch_id) on delete restrict,
  unique (id, branch_id)
);

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  execution_branch_id uuid not null,
  area_id uuid,
  asset_id uuid,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  reported_problem text,
  work_performed text,
  observations text,
  pending_items text,
  status public.work_order_status not null default 'pending',
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete restrict,
  scheduled_date date,
  start_date timestamptz,
  completion_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (execution_branch_id, client_id) references public.branches(id, client_id) on delete restrict,
  foreign key (area_id, execution_branch_id) references public.areas(id, branch_id) on delete restrict,
  foreign key (asset_id, execution_branch_id) references public.assets(id, branch_id) on delete restrict,
  check (completion_date is null or start_date is null or completion_date >= start_date)
);

create table public.work_order_items (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  item_type public.work_item_type not null,
  description text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  subtotal numeric(16,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_order_photos (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  file_path text not null unique,
  photo_type public.photo_type not null,
  caption text,
  uploaded_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.asset_photos (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  file_path text not null unique,
  caption text,
  uploaded_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  billing_branch_id uuid,
  issue_date date not null default current_date,
  due_date date,
  status public.invoice_status not null default 'pending',
  materials_total numeric(16,2) not null default 0 check (materials_total >= 0),
  spare_parts_total numeric(16,2) not null default 0 check (spare_parts_total >= 0),
  labor_total numeric(16,2) not null default 0 check (labor_total >= 0),
  transport_total numeric(16,2) not null default 0 check (transport_total >= 0),
  other_total numeric(16,2) not null default 0 check (other_total >= 0),
  discount_total numeric(16,2) not null default 0 check (discount_total >= 0),
  grand_total numeric(16,2) not null default 0 check (grand_total >= 0),
  notes text,
  pdf_path text,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (billing_branch_id, client_id) references public.branches(id, client_id) on delete restrict,
  check (due_date is null or due_date >= issue_date)
);

create table public.invoice_work_orders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  work_order_id uuid not null unique references public.work_orders(id) on delete restrict,
  amount numeric(16,2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (invoice_id, work_order_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  payment_date date not null default current_date,
  amount numeric(16,2) not null check (amount > 0),
  payment_method public.payment_method not null,
  received_at_branch_id uuid references public.branches(id) on delete restrict,
  reference text,
  notes text,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  file_path text not null unique,
  uploaded_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index branches_client_idx on public.branches(client_id);
create index areas_branch_idx on public.areas(branch_id);
create index assets_branch_idx on public.assets(branch_id);
create index assets_area_idx on public.assets(area_id);
create index work_orders_client_idx on public.work_orders(client_id);
create index work_orders_branch_idx on public.work_orders(execution_branch_id);
create index work_orders_asset_idx on public.work_orders(asset_id);
create index work_orders_status_idx on public.work_orders(status);
create index work_orders_dates_idx on public.work_orders(created_at desc);
create index work_order_items_order_idx on public.work_order_items(work_order_id);
create index invoices_client_idx on public.invoices(client_id);
create index invoices_status_idx on public.invoices(status);
create index invoice_work_orders_invoice_idx on public.invoice_work_orders(invoice_id);
create index payments_invoice_idx on public.payments(invoice_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger clients_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger branches_updated_at before update on public.branches for each row execute function public.set_updated_at();
create trigger areas_updated_at before update on public.areas for each row execute function public.set_updated_at();
create trigger assets_updated_at before update on public.assets for each row execute function public.set_updated_at();
create trigger work_orders_updated_at before update on public.work_orders for each row execute function public.set_updated_at();
create trigger work_order_items_updated_at before update on public.work_order_items for each row execute function public.set_updated_at();
create trigger invoices_updated_at before update on public.invoices for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = auth.uid() and is_active $$;

create or replace function public.has_role(allowed_roles public.user_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.current_user_role() = any(allowed_roles), false) $$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.has_role(public.user_role[]) to authenticated;

create or replace function public.protect_profile_permissions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.role, new.is_active, new.email) is distinct from (old.role, old.is_active, old.email)
     and not public.has_role(array['admin']::public.user_role[]) then
    raise exception 'Solo un administrador puede cambiar el rol, estado o correo de un perfil';
  end if;
  return new;
end;
$$;

create trigger protect_profile_permissions_before
before update on public.profiles
for each row execute function public.protect_profile_permissions();

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

  select coalesce(sum(subtotal), 0) into calculated_amount
  from public.work_order_items where work_order_id = new.work_order_id;
  new.amount = calculated_amount;
  return new;
end;
$$;

create trigger validate_invoice_work_order_before
before insert or update on public.invoice_work_orders
for each row execute function public.validate_invoice_work_order();

create or replace function public.sync_invoiced_order_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    update public.work_orders set status = 'completed' where id = old.work_order_id and status = 'invoiced';
    return old;
  end if;
  update public.work_orders set status = 'invoiced' where id = new.work_order_id;
  return new;
end;
$$;

create trigger sync_invoiced_order_after
after insert or delete on public.invoice_work_orders
for each row execute function public.sync_invoiced_order_status();

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
  from public.invoice_work_orders iwo
  join public.work_order_items i on i.work_order_id = iwo.work_order_id
  where iwo.invoice_id = p_invoice_id;

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

create or replace function public.trigger_recalculate_invoice()
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

create trigger recalculate_invoice_orders
after insert or update or delete on public.invoice_work_orders
for each row execute function public.trigger_recalculate_invoice();

create or replace function public.validate_payment()
returns trigger language plpgsql set search_path = '' as $$
declare
  invoice_total numeric(16,2);
  already_paid numeric(16,2);
  invoice_state public.invoice_status;
  invoice_client uuid;
  receiving_branch_client uuid;
begin
  select grand_total, status, client_id into invoice_total, invoice_state, invoice_client
  from public.invoices where id = new.invoice_id for update;
  if invoice_state = 'void' then raise exception 'No se pueden registrar pagos en una factura anulada'; end if;
  if new.received_at_branch_id is not null then
    select client_id into receiving_branch_client from public.branches where id = new.received_at_branch_id;
    if receiving_branch_client <> invoice_client then
      raise exception 'La sede que recibe el pago debe pertenecer al cliente de la factura';
    end if;
  end if;
  select coalesce(sum(amount), 0) into already_paid from public.payments
  where invoice_id = new.invoice_id and id <> new.id;
  if already_paid + new.amount > invoice_total then
    raise exception 'El pago supera el saldo pendiente de la factura';
  end if;
  return new;
end;
$$;

create trigger validate_payment_before before insert or update on public.payments
for each row execute function public.validate_payment();
create trigger recalculate_invoice_payments after insert or update or delete on public.payments
for each row execute function public.trigger_recalculate_invoice();

create or replace function public.recalculate_invoice_from_item()
returns trigger language plpgsql set search_path = '' as $$
declare
  invoice_id_value uuid;
  affected_work_order_id uuid;
begin
  affected_work_order_id := case when tg_op = 'DELETE' then old.work_order_id else new.work_order_id end;
  for invoice_id_value in
    select invoice_id from public.invoice_work_orders where work_order_id = affected_work_order_id
  loop
    perform public.recalculate_invoice(invoice_id_value);
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger recalculate_invoice_items after insert or update or delete on public.work_order_items
for each row execute function public.recalculate_invoice_from_item();

create or replace function public.recalculate_invoice_discount()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform public.recalculate_invoice(new.id);
  return new;
end;
$$;

create trigger recalculate_invoice_discount_after
after update of discount_total on public.invoices
for each row when (old.discount_total is distinct from new.discount_total)
execute function public.recalculate_invoice_discount();

insert into public.service_types (name, sort_order) values
('Mantenimiento preventivo', 10), ('Mantenimiento correctivo', 20), ('Reparación', 30),
('Instalación', 40), ('Diagnóstico', 50), ('Visita técnica', 60), ('Obra blanca', 70),
('Obra gris', 80), ('Demolición', 90), ('Construcción', 100), ('Adecuación', 110),
('Reparación eléctrica', 120), ('Reparación hidráulica', 130), ('Reparación de gas', 140),
('Limpieza técnica', 150), ('Otro', 999);

alter table public.profiles enable row level security;
alter table public.service_types enable row level security;
alter table public.clients enable row level security;
alter table public.branches enable row level security;
alter table public.areas enable row level security;
alter table public.assets enable row level security;
alter table public.work_orders enable row level security;
alter table public.work_order_items enable row level security;
alter table public.work_order_photos enable row level security;
alter table public.asset_photos enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_work_orders enable row level security;
alter table public.payments enable row level security;
alter table public.payment_proofs enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (public.current_user_role() is not null);
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on public.profiles for all to authenticated using (public.has_role(array['admin']::public.user_role[])) with check (public.has_role(array['admin']::public.user_role[]));

create policy authenticated_read_service_types on public.service_types for select to authenticated using (true);
create policy admin_manage_service_types on public.service_types for all to authenticated using (public.has_role(array['admin']::public.user_role[])) with check (public.has_role(array['admin']::public.user_role[]));

do $$
declare table_name text;
begin
  foreach table_name in array array['clients','branches','areas','assets','work_orders','work_order_items','work_order_photos','asset_photos'] loop
    execute format('create policy authenticated_read_%1$s on public.%1$I for select to authenticated using (public.current_user_role() is not null)', table_name);
    execute format('create policy operations_write_%1$s on public.%1$I for all to authenticated using (public.has_role(array[''admin'',''technician'']::public.user_role[])) with check (public.has_role(array[''admin'',''technician'']::public.user_role[]))', table_name);
  end loop;
  foreach table_name in array array['invoices','invoice_work_orders','payments','payment_proofs'] loop
    execute format('create policy authenticated_read_%1$s on public.%1$I for select to authenticated using (public.current_user_role() is not null)', table_name);
    execute format('create policy billing_write_%1$s on public.%1$I for all to authenticated using (public.has_role(array[''admin'',''billing'']::public.user_role[])) with check (public.has_role(array[''admin'',''billing'']::public.user_role[]))', table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
('work-order-photos', 'work-order-photos', false, 10485760, array['image/jpeg','image/png','image/webp']),
('asset-photos', 'asset-photos', false, 10485760, array['image/jpeg','image/png','image/webp']),
('payment-proofs', 'payment-proofs', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
('invoices', 'invoices', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy authenticated_read_files on storage.objects for select to authenticated
using (bucket_id in ('work-order-photos','asset-photos','payment-proofs','invoices') and public.current_user_role() is not null);
create policy operations_upload_photos on storage.objects for insert to authenticated
with check (bucket_id in ('work-order-photos','asset-photos') and public.has_role(array['admin','technician']::public.user_role[]));
create policy billing_upload_files on storage.objects for insert to authenticated
with check (bucket_id in ('payment-proofs','invoices') and public.has_role(array['admin','billing']::public.user_role[]));
create policy admin_manage_files on storage.objects for all to authenticated
using (public.has_role(array['admin']::public.user_role[]))
with check (public.has_role(array['admin']::public.user_role[]));

create view public.work_order_totals with (security_invoker = true) as
select wo.id as work_order_id,
  coalesce(sum(i.subtotal) filter (where i.item_type = 'material'), 0) as materials_total,
  coalesce(sum(i.subtotal) filter (where i.item_type = 'spare_part'), 0) as spare_parts_total,
  coalesce(sum(i.subtotal) filter (where i.item_type = 'labor'), 0) as labor_total,
  coalesce(sum(i.subtotal) filter (where i.item_type = 'transport'), 0) as transport_total,
  coalesce(sum(i.subtotal) filter (where i.item_type in ('rental','other')), 0) as other_total,
  coalesce(sum(i.subtotal), 0) as grand_total
from public.work_orders wo left join public.work_order_items i on i.work_order_id = wo.id
group by wo.id;

create view public.invoice_balances with (security_invoker = true) as
select i.id as invoice_id, i.grand_total,
  coalesce(sum(p.amount), 0) as paid_total,
  greatest(i.grand_total - coalesce(sum(p.amount), 0), 0) as balance_due
from public.invoices i left join public.payments p on p.invoice_id = i.id
group by i.id, i.grand_total;

grant select on public.work_order_totals, public.invoice_balances to authenticated;
