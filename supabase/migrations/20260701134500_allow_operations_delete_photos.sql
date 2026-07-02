-- Permite que operaciones elimine archivos de evidencia en los buckets de fotos.
-- La metadata de la foto ya está protegida por RLS en las tablas públicas.
create policy operations_delete_photos on storage.objects for delete to authenticated
using (
  bucket_id in ('work-order-photos', 'asset-photos')
  and public.has_role(array['admin', 'technician']::public.user_role[])
);
