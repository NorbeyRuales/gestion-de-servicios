create table public.asset_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_categories_name_length check (char_length(trim(name)) >= 2)
);

create unique index asset_categories_name_unique on public.asset_categories (lower(trim(name)));
create index asset_categories_active_order_idx on public.asset_categories (is_active, sort_order, name);

alter table public.asset_categories enable row level security;
create policy authenticated_read_asset_categories on public.asset_categories for select to authenticated using (true);
create policy admin_manage_asset_categories on public.asset_categories for all to authenticated
using (public.has_role(array['admin']::public.user_role[]))
with check (public.has_role(array['admin']::public.user_role[]));

insert into public.asset_categories (name, sort_order) values
  ('Refrigeración', 10), ('Cocción', 20), ('Preparación de alimentos', 30),
  ('Lavado y limpieza', 40), ('Extracción y ventilación', 50), ('Bebidas', 60),
  ('Conservación caliente', 70), ('Gas', 80), ('Electricidad', 90),
  ('Climatización', 100), ('Pesaje', 110), ('Seguridad', 120),
  ('Mobiliario inoxidable', 130);

create or replace function public.update_asset_category(p_id uuid, p_name text, p_sort_order integer)
returns void language plpgsql security definer set search_path = '' as $$
declare previous_name text;
begin
  if not public.has_role(array['admin']::public.user_role[]) then raise exception 'Solo un administrador puede editar categorías'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Escribe un nombre válido'; end if;
  select name into previous_name from public.asset_categories where id = p_id for update;
  if previous_name is null then raise exception 'No se encontró la categoría'; end if;
  update public.assets set category = trim(p_name) where category = previous_name;
  update public.asset_categories set name = trim(p_name), sort_order = greatest(p_sort_order, 0), updated_at = now() where id = p_id;
end;
$$;

create or replace function public.delete_asset_category(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.asset_categories;
begin
  if not public.has_role(array['admin']::public.user_role[]) then raise exception 'Solo un administrador puede eliminar categorías'; end if;
  select * into target from public.asset_categories where id = p_id for update;
  if target.id is null then raise exception 'No se encontró la categoría'; end if;
  if target.is_active then raise exception 'Desactiva la categoría antes de eliminarla'; end if;
  if exists (select 1 from public.assets where category = target.name) then
    raise exception 'No se puede eliminar porque está asignada a uno o más equipos';
  end if;
  delete from public.asset_categories where id = p_id;
end;
$$;

revoke all on function public.update_asset_category(uuid, text, integer) from public;
revoke all on function public.delete_asset_category(uuid) from public;
grant execute on function public.update_asset_category(uuid, text, integer) to authenticated;
grant execute on function public.delete_asset_category(uuid) to authenticated;

