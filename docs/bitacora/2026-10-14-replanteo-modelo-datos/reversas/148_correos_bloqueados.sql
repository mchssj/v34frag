-- Inversa del replanteo 148 (correos temporales bloqueados). Como supabase_admin. Borra la lista de dominios.
begin;
drop trigger if exists email_domain_check on auth.users;
drop function if exists public.auth_users_email_domain_check();
drop function if exists public.admin_email_domain_accounts();
drop function if exists public.admin_email_domain_unblock(text);
drop function if exists public.admin_email_domain_block(text, text);
drop function if exists public.email_domain_blocked(text);
drop function if exists public.email_domain_of(text);
drop table if exists public.email_domain_blocks;
notify pgrst, 'reload schema';
commit;
