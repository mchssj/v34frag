-- 134: nombre de la web en el servidor. Es la 113_nick_de_la_web.sql de Kyan (kyan/pruebas, bitácora
-- 2026-11-12-cuchillo-por-vida-y-nombre-web) sin cambios en la lógica: su reporter 2.10.2 corre en #1, #2 y #3
-- desde el 2026-11-13, pero la función nunca llegó a producción (docs/bitacora/2026-11-22-nick-de-la-web-en-produccion).
--
--   csstv_web_nick(p_token, p_steam): el nick de la ficha (players.nick) dueña del SteamID, principal o adicional
--   (steam_owner). El reporter (2.10.1 en adelante) la llama al entrar cada jugador y le pone ese nombre. Responde siempre 200:
--   { ok: true, nick, vip } o { ok: false } si no hay ficha o la ficha es privada (no se muestra a quién pertenece el SteamID).
--   vip: la cuenta de la ficha es VIP (is_vip). El VIP se salta la regla y sigue con el nombre que quiera (Kyan, 2026-11-12).
-- Necesita csstv_auth, csstv_steam64, is_vip (migración del VIP) y la 15 (steam_owner).
-- El número 113 ya lo usa main (chat y jugadores históricos): esta va después de la 133.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/134_nick_de_la_web.sql.
begin;

do $$
begin
  if to_regprocedure('public.csstv_web_nick(text, text)') is not null then
    raise exception 'replanteo 134: ya se aplicó (csstv_web_nick existe)';
  end if;
  if to_regprocedure('public.csstv_auth(text)') is null
     or to_regprocedure('public.csstv_steam64(text)') is null
     or to_regprocedure('public.steam_owner(text)') is null
     or to_regprocedure('public.is_vip(uuid)') is null then
    raise exception 'replanteo 134: faltan csstv_auth, csstv_steam64, steam_owner o is_vip';
  end if;
end $$;

create function public.csstv_web_nick(p_token text, p_steam text)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare s64 text; v_nick text; v_user uuid;
begin
  perform csstv_auth(p_token);
  s64 := csstv_steam64(p_steam);
  if s64 is null then return jsonb_build_object('ok', false); end if;
  select nullif(trim(p.nick), ''), p.user_id into v_nick, v_user
    from players p
   where p.id = steam_owner(s64) and p.privacy <> 'private';
  if v_nick is null then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'nick', v_nick, 'vip', v_user is not null and coalesce(is_vip(v_user), false));
end $$;

revoke all on function public.csstv_web_nick(text, text) from public;
grant execute on function public.csstv_web_nick(text, text) to anon, authenticated, service_role;

comment on function public.csstv_web_nick(text, text) is 'Reporter 2.10.1: nick de la ficha dueña de un SteamID, para ponérselo en el servidor (replanteo 134)';

commit;
