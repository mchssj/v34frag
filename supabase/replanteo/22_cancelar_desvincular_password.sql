-- Replanteo 22: el jugador cancela su pedido de desvincular un SteamID y fecha del último cambio de contraseña
-- (plan docs/bitacora/2026-10-19-api-cancelar-desvincular-fecha-password).
--   - steam_requests.status admite 'cancelled'; cancel_steam_unlink lo usa para el pedido 'remove' pendiente del jugador.
--   - profiles.password_changed_at: la escribe un trigger en auth.users cuando cambia encrypted_password
--     (cambio desde la API, recuperación o el panel de Supabase). null: no la cambió desde que se guarda la fecha.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.request_steam_unlink(text, text)') is null then
    raise exception 'replanteo 22: falta request_steam_unlink (aplicar antes 21_steam_desvincular.sql)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'password_changed_at') then
    raise exception 'replanteo 22: profiles ya tiene password_changed_at (¿ya se aplicó?)';
  end if;
end $$;

-- =====================================================================================================
-- 1. Cancelar el pedido de desvincular
-- =====================================================================================================
alter table public.steam_requests drop constraint steam_requests_status_check;
alter table public.steam_requests add constraint steam_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'expired', 'cancelled'));
comment on column public.steam_requests.status is 'pending, approved, rejected, expired (30 días) o cancelled (lo canceló el jugador; replanteo 22)';

create function public.cancel_steam_unlink(p_steam text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para cancelar el pedido' using errcode = '42501'; end if;
  perform steam_requests_expire();
  update steam_requests set status = 'cancelled', resolved_at = now(), resolved_by = auth.uid()
   where steam_id = p_steam and user_id = auth.uid() and kind = 'remove' and status = 'pending';
  if not found then raise exception 'No tenés un pedido pendiente para desvincular ese SteamID'; end if;
end $$;
revoke all on function public.cancel_steam_unlink(text) from public, anon;
grant execute on function public.cancel_steam_unlink(text) to authenticated;

-- =====================================================================================================
-- 2. Fecha del último cambio de contraseña
-- =====================================================================================================
alter table public.profiles add column password_changed_at timestamptz;
comment on column public.profiles.password_changed_at is 'Último cambio de contraseña (lo escribe el trigger de auth.users); null si no la cambió desde el replanteo 22';

create function public.handle_password_change() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update profiles set password_changed_at = now() where id = new.id;
  return new;
end $$;
revoke all on function public.handle_password_change() from public, anon, authenticated;

create trigger on_auth_user_password_changed
  after update of encrypted_password on auth.users
  for each row when (old.encrypted_password is distinct from new.encrypted_password)
  execute function public.handle_password_change();

commit;
