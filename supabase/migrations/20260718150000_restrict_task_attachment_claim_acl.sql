-- Supabase can grant function execution directly to API roles through default
-- privileges. Restrict the attachment-claim RPC to authenticated callers while
-- preserving the service-role path used by trusted server operations.

revoke all on function public.claim_task_attachment(uuid, uuid, uuid) from anon;
revoke all on function public.claim_task_attachment(uuid, uuid, uuid) from public;

grant execute on function public.claim_task_attachment(uuid, uuid, uuid)
  to authenticated, service_role;
