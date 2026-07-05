create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  phone text,
  email text,
  specialty text,
  company text,
  profile_id uuid unique references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger technicians_updated_at before update on public.technicians
for each row execute function public.set_updated_at();

alter table public.work_orders
add column technician_id uuid references public.technicians(id) on delete restrict;

insert into public.technicians (name, email, profile_id, is_active)
select full_name, email, id, is_active
from public.profiles
where role = 'technician'
on conflict (profile_id) do nothing;

create or replace function public.sync_profile_technician()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'technician' then
    insert into public.technicians (name, email, profile_id, is_active)
    values (new.full_name, new.email, new.id, new.is_active)
    on conflict (profile_id) do update set
      name = excluded.name,
      email = excluded.email,
      is_active = excluded.is_active;
  elsif tg_op = 'UPDATE' and old.role = 'technician' then
    update public.technicians set is_active = false where profile_id = new.id;
  end if;
  return new;
end;
$$;

create trigger sync_profile_technician_after_change
after insert or update of full_name, email, role, is_active on public.profiles
for each row execute function public.sync_profile_technician();

update public.work_orders wo
set technician_id = t.id
from public.technicians t
where t.profile_id = wo.assigned_to and wo.technician_id is null;

create index work_orders_technician_idx on public.work_orders(technician_id);
create index technicians_active_name_idx on public.technicians(is_active, name);

alter table public.technicians enable row level security;
create policy authenticated_read_technicians on public.technicians
for select to authenticated using (public.current_user_role() is not null);
create policy admin_manage_technicians on public.technicians
for all to authenticated
using (public.has_role(array['admin']::public.user_role[]))
with check (public.has_role(array['admin']::public.user_role[]));

create or replace function public.save_work_order_with_technician(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid;
  selected_technician public.technicians%rowtype;
  selected_id uuid := nullif(payload ->> 'technician_id', '')::uuid;
begin
  if not public.has_role(array['admin', 'technician']::public.user_role[]) then
    raise exception 'No tienes permiso para guardar órdenes de trabajo';
  end if;

  if selected_id is not null then
    select * into selected_technician from public.technicians where id = selected_id;
    if not found then raise exception 'El técnico seleccionado no existe'; end if;
    if not selected_technician.is_active then raise exception 'El técnico seleccionado está inactivo'; end if;
  end if;

  saved_id := public.save_work_order(payload || jsonb_build_object(
    'assigned_to', case when selected_id is null then null else selected_technician.profile_id end
  ));

  update public.work_orders
  set technician_id = selected_id,
      assigned_to = case when selected_id is null then null else selected_technician.profile_id end
  where id = saved_id;

  return saved_id;
end;
$$;

revoke all on function public.save_work_order_with_technician(jsonb) from public;
grant execute on function public.save_work_order_with_technician(jsonb) to authenticated;
