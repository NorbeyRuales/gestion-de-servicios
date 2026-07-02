-- Permite que la interfaz muestre el registro únicamente mientras no exista ningún usuario.
create or replace function public.is_initial_setup_available()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles);
$$;

revoke all on function public.is_initial_setup_available() from public;
grant execute on function public.is_initial_setup_available() to anon, authenticated;
