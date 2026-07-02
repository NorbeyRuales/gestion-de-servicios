-- El primer usuario registrado es el propietario y administrador inicial.
-- Los usuarios posteriores quedan como técnicos hasta que el administrador cambie su rol.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  initial_role public.user_role;
begin
  perform pg_advisory_xact_lock(hashtext('gestor_servicios_first_user'));

  initial_role := case
    when exists (select 1 from public.profiles) then 'technician'::public.user_role
    else 'admin'::public.user_role
  end;

  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, ''),
    initial_role
  );
  return new;
end;
$$;
