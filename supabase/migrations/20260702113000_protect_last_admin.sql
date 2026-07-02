create or replace function public.protect_profile_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.role, new.is_active, new.email) is distinct from (old.role, old.is_active, old.email)
     and not public.has_role(array['admin']::public.user_role[]) then
    raise exception 'Solo un administrador puede cambiar el rol, estado o correo de un perfil';
  end if;

  if old.role = 'admin' and old.is_active
     and (new.role <> 'admin' or not new.is_active)
     and not exists (
       select 1 from public.profiles
       where id <> old.id and role = 'admin' and is_active
     ) then
    raise exception 'Debe existir al menos un administrador activo';
  end if;

  return new;
end;
$$;
