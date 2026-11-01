-- Replanteo 38: IPs de una ficha para el admin de la web nueva (plan docs/bitacora/2026-10-29-ips-jugadores).
--   - admin_player_ips(ficha): las IPs de todos los SteamID de la ficha (player_steam_all), con primera y última vez,
--     veces y las otras fichas que usaron la misma IP (para detectar multicuentas). Solo admin.
-- Las tablas (player_ips y las demás) están en producción desde la migración 20261029180000_ips_jugadores.sql,
-- que necesita. Necesita también la 15 (player_steam_all).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.player_ips') is null or to_regclass('public.player_steam_all') is null then
    raise exception 'replanteo 38: faltan la migración 20261029180000_ips_jugadores.sql o la 15';
  end if;
  if to_regprocedure('public.admin_player_ips(uuid)') is not null then
    raise exception 'replanteo 38: admin_player_ips ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- others: otras fichas que entraron desde esa IP (id y alias). others_unlinked: SteamID sin ficha desde esa IP.
create function public.admin_player_ips(p_player uuid)
  returns table(steam_id text, ip text, first_seen_at timestamptz, last_seen_at timestamptz, times integer,
                last_nick text, others jsonb, others_unlinked integer)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede ver las IPs' using errcode = '42501'; end if;
  return query
  select i.steam_id, host(i.ip), i.first_seen_at, i.last_seen_at, i.times, i.last_nick,
         coalesce((select jsonb_agg(distinct jsonb_build_object('id', o.id, 'alias', o.nick))
                     from player_ips j
                     join player_steam_all s on s.steam_id = j.steam_id
                     join players o on o.id = s.player_id
                    where j.ip = i.ip and s.player_id <> p_player), '[]'::jsonb),
         (select count(distinct j.steam_id)::integer
            from player_ips j
           where j.ip = i.ip and not exists (select 1 from player_steam_all s where s.steam_id = j.steam_id))
    from player_ips i
    join player_steam_all a on a.steam_id = i.steam_id and a.player_id = p_player
   order by i.last_seen_at desc;
end $$;

revoke all on function public.admin_player_ips(uuid) from public, anon;
grant execute on function public.admin_player_ips(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
