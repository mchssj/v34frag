-- Inversa de supabase/replanteo/14_demos_admin.sql.
begin;
drop view public.admin_demo_summary;
drop view public.admin_demo_worker_list;
drop view public.admin_demo_list;
drop function public.admin_demo_retry(uuid);
drop function public.rotate_demo_worker_token(uuid);
drop function public.admin_create_demo_worker(text);
alter table public.demo_workers drop constraint demo_workers_name_len;
drop index public.demo_workers_name_key;
commit;
