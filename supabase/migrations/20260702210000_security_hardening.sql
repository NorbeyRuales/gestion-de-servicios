revoke all on function public.recalculate_invoice(uuid) from public, anon, authenticated;
revoke all on function public.refresh_asset_last_maintenance(uuid) from public, anon, authenticated;
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.has_role(public.user_role[]) from public, anon;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.has_role(public.user_role[]) to authenticated;

-- Future RPCs must be granted explicitly by their migration.
alter default privileges for role postgres in schema public revoke execute on functions from public;
