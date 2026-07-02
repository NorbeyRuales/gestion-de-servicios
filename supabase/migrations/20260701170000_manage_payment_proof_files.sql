create policy billing_delete_payment_proof_files on storage.objects
for delete to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.has_role(array['admin','billing']::public.user_role[])
);
