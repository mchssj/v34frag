-- Inversa de supabase/replanteo/22_cancelar_desvincular_password.sql: deja los pedidos de SteamID y profiles como después de la 21.
-- Se borran los pedidos cancelados (todos de desvincular) y la fecha del último cambio de contraseña.
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'password_changed_at') then
    raise exception 'inversa 22: profiles no tiene password_changed_at (¿no se aplicó la 22?)';
  end if;
end $$;

drop trigger on_auth_user_password_changed on auth.users;
drop function public.handle_password_change();
alter table public.profiles drop column password_changed_at;

drop function public.cancel_steam_unlink(text);
delete from public.steam_requests where status = 'cancelled';
alter table public.steam_requests drop constraint steam_requests_status_check;
alter table public.steam_requests add constraint steam_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'expired'));
comment on column public.steam_requests.status is null;

commit;
