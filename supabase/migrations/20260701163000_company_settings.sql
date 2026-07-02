create table public.company_settings (
  id smallint primary key default 1 check (id = 1),
  business_name text not null default 'Gestor de Servicios',
  document_type text,
  document_number text,
  address text,
  phone text,
  email text,
  logo_path text,
  bank_name text,
  account_type text,
  account_number text,
  account_holder text,
  payment_instructions text,
  invoice_terms text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.company_settings (id) values (1) on conflict (id) do nothing;

create trigger company_settings_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

alter table public.company_settings enable row level security;

create policy authenticated_read_company_settings on public.company_settings
for select to authenticated
using (public.current_user_role() is not null);

create policy admin_manage_company_settings on public.company_settings
for all to authenticated
using (public.has_role(array['admin']::public.user_role[]))
with check (public.has_role(array['admin']::public.user_role[]));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-assets', 'company-assets', false, 5242880, array['image/jpeg','image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy authenticated_read_company_assets on storage.objects
for select to authenticated
using (bucket_id = 'company-assets' and public.current_user_role() is not null);
