create index if not exists invoices_created_at_idx on public.invoices(created_at desc);
create index if not exists invoices_issue_date_idx on public.invoices(issue_date desc);
create index if not exists payments_payment_date_idx on public.payments(payment_date desc);
create index if not exists payments_created_at_idx on public.payments(created_at desc);
create index if not exists work_orders_completion_date_idx on public.work_orders(completion_date desc);
create index if not exists work_orders_status_completion_idx on public.work_orders(status, completion_date desc);
create index if not exists branches_active_client_idx on public.branches(client_id, is_active);
create index if not exists assets_active_branch_idx on public.assets(branch_id, is_active);
create index if not exists areas_active_branch_idx on public.areas(branch_id, is_active);
