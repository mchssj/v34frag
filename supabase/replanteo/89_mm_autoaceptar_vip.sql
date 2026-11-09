-- 89: autoaceptar partida para VIP (bitácora docs/bitacora/2026-11-09-autoaceptar-vip, Kyan 2026-11-09).
--
--   1. user_preferences.preferences->'mm_auto_accept': el interruptor de Jugar › Configuración.
--   2. mm_set_auto_accept(p_on): lo prende (solo VIP) o lo apaga (cualquiera).
--   3. Trigger mm_lobby_players_auto_accept: al armarse la sala (estado `accepting`), el jugador VIP con el
--      interruptor prendido entra ya aceptado. Si se le venció el VIP, la preferencia queda guardada pero no se aplica.
--   4. mm_my_profile: suma `auto_accept` ({enabled, allowed}) al estado de Jugar.
-- No cambia la sanción: el que no se conecta a tiempo se sanciona como siempre.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/89_mm_autoaceptar_vip.sql.
begin;

do $$
begin
  if to_regprocedure('public.mm_set_auto_accept(boolean)') is not null then raise exception 'replanteo 89: ya se aplicó (mm_set_auto_accept existe)'; end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 89: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

/** Si la cuenta tiene autoaceptar prendido (sin mirar el VIP). */
create function public.mm_auto_accept_on(p_user uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select (preferences->>'mm_auto_accept')::boolean from user_preferences where user_id = p_user), false)
$$;

create function public.mm_set_auto_accept(p_on boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  if p_on and not is_vip(me) then raise exception 'Autoaceptar partida es exclusivo para VIP' using errcode = '42501'; end if;
  insert into user_preferences (user_id, preferences) values (me, jsonb_build_object('mm_auto_accept', p_on))
  on conflict (user_id) do update set preferences = user_preferences.preferences || jsonb_build_object('mm_auto_accept', p_on),
    updated_at = now();
end $$;

create function public.tg_mm_lobby_players_auto_accept() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.accepted_at is null and mm_auto_accept_on(new.user_id) and is_vip(new.user_id)
     and exists (select 1 from mm_lobbies where id = new.lobby_id and status = 'accepting') then
    new.accepted_at := now();
  end if;
  return new;
end $$;
create trigger mm_lobby_players_auto_accept before insert on public.mm_lobby_players
  for each row execute function public.tg_mm_lobby_players_auto_accept();

select pg_temp.reemplazar('public.mm_my_profile()', array[
  array[$a$    'sounds', jsonb_build_object($a$,
        $b$    'auto_accept', jsonb_build_object('enabled', mm_auto_accept_on(me), 'allowed', v_vip),
    'sounds', jsonb_build_object($b$]]);

revoke all on function public.mm_auto_accept_on(uuid), public.mm_set_auto_accept(boolean),
  public.tg_mm_lobby_players_auto_accept() from public, anon, authenticated;
grant execute on function public.mm_set_auto_accept(boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
