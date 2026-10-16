-- Replanteo 13: simulación del recálculo del ELO (plan docs/bitacora/2026-10-16-api-elo-config).
-- elo_simulate recalcula todo con valores de configuración propuestos dentro de un bloque que se deshace
-- al final, y devuelve cómo quedaría cada jugador. No guarda nada.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.admin_server_list') is null then
    raise exception 'replanteo 13: falta admin_server_list (aplicar antes 12_servidores.sql)';
  end if;
  if to_regprocedure('public.elo_simulate(integer, integer, numeric, integer, integer, integer, integer)') is not null then
    raise exception 'replanteo 13: elo_simulate ya existe (¿ya se aplicó?)';
  end if;
end $$;

create function public.elo_simulate(p_base integer, p_bonus_max integer, p_bonus_factor numeric, p_floor integer,
                                    p_start_elo integer, p_min_pct integer, p_full_pct integer)
  returns table(steam_id text, player_id uuid, name text, elo_before integer, elo_after integer, delta integer,
                abs_delta integer, matches_before integer, matches_after integer, changed boolean, search text)
  language plpgsql security definer set search_path = public as $$
declare
  antes   jsonb;
  despues jsonb;
begin
  if not is_admin() then
    raise exception 'Solo un admin puede simular el recálculo del ELO' using errcode = '42501';
  end if;
  select coalesce(jsonb_object_agg(e.steam_id, jsonb_build_array(e.elo, e.matches)), '{}') into antes from player_elo e;

  -- Guarda los valores y recalcula (con las validaciones de elo_set_config), toma la foto y deshace todo:
  -- al deshacer el bloque también se sueltan los bloqueos que tomó el recálculo.
  begin
    perform elo_set_config(p_base, p_bonus_max, p_bonus_factor, p_floor, p_start_elo, true, p_min_pct, p_full_pct);
    select coalesce(jsonb_object_agg(e.steam_id, jsonb_build_array(e.elo, e.matches)), '{}') into despues from player_elo e;
    raise exception using errcode = 'V3401', message = 'deshacer simulación';
  exception when sqlstate 'V3401' then
    null;
  end;

  return query
  select x.sid, p.id, coalesce(p.nick, n.nick),
         (antes -> x.sid ->> 0)::int, (despues -> x.sid ->> 0)::int,
         coalesce((despues -> x.sid ->> 0)::int, 0) - coalesce((antes -> x.sid ->> 0)::int, 0),
         abs(coalesce((despues -> x.sid ->> 0)::int, 0) - coalesce((antes -> x.sid ->> 0)::int, 0)),
         coalesce((antes -> x.sid ->> 1)::int, 0), coalesce((despues -> x.sid ->> 1)::int, 0),
         (antes -> x.sid) is distinct from (despues -> x.sid),
         search_norm(concat_ws(' ', p.nick, n.nick, x.sid))
    from (select jsonb_object_keys(antes) as sid union select jsonb_object_keys(despues)) x
    left join players p on p.steam_id = x.sid
    left join lateral (select s.nick from match_player_stats s left join matches m on m.id = s.match_id
                        where s.steam_id = x.sid and s.nick is not null
                        order by coalesce(m.played_at, s.created_at) desc limit 1) n on true;
end $$;
revoke all on function public.elo_simulate(integer, integer, numeric, integer, integer, integer, integer) from public, anon;
grant execute on function public.elo_simulate(integer, integer, numeric, integer, integer, integer, integer) to authenticated;

commit;
