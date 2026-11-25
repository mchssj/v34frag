-- 145: abandono del reemplazo y ELO de quien abandona si su equipo gana
-- (bitácora docs/bitacora/2026-11-25-abandono-del-reemplazo, Daniel 2026-11-25).
--
--   1. mm_left_last_round (77) comparaba las rondas jugadas con el total de la partida: un reemplazo, que entra a la
--      mitad, nunca llegaba, e irse en la última ronda le contaba como abandono. Ahora suma las de antes de que entrara.
--   2. mm_elo_delta (78): la parte no jugada de un reemplazo que abandona no incluye las rondas de antes de que entrara.
--   3. mm_elo_delta (78): elo_apply_match y elo_recompute_player le pasan p_res = 0 al que abandona, así que la regla de
--      "su equipo ganó" (abandon_win_min a _max) nunca se aplicaba. Ahora mira el resultado real de la partida.
-- Los puntos 2 y 3 rigen para las partidas desde mm_config.abandon_rules_from (el momento de aplicar este replanteo): las
-- anteriores quedan igual aunque se recalcule el ELO, porque varias ya se compensaron a mano.
-- Necesita la 77 y la 78. No depende de las 139 a 144.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/145_mm_abandono_reemplazo.sql.
begin;

do $$
begin
  if to_regprocedure('public.mm_left_last_round(uuid, uuid)') is null then raise exception 'replanteo 145: falta la 77'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'mm_replacements' and column_name = 'joined_round') then
    raise exception 'replanteo 145: falta la 78';
  end if;
  if to_regprocedure('public.mm_rounds_before(uuid, uuid)') is not null then
    raise exception 'replanteo 145: ya se aplicó (mm_rounds_before existe)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 145: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

alter table public.mm_config add column abandon_rules_from timestamptz not null default now();
comment on column public.mm_config.abandon_rules_from is
  'Desde qué partidas rigen las reglas del ELO del abandono de la 145 (victoria del equipo y rondas previas del reemplazo). No se edita desde la web. Replanteo 145';

-- Rondas de la partida jugadas antes de que la ficha entrara de reemplazo; 0 si jugó desde el principio. Sin joined_round
-- (el mix en vivo no se veía al entrar), la ronda en que se pidió el reemplazo.
create function public.mm_rounds_before(p_game uuid, p_player uuid) returns integer
  language sql stable security definer set search_path = public as $$
  select coalesce((
    select greatest(max(coalesce(r.joined_round, r.left_round, 1)) - 1, 0)
      from matches g
      join mm_lobbies l on l.match_id = g.parent_match_id
      join mm_lobby_players lp on lp.lobby_id = l.id and lp.player_id = p_player
      join mm_replacements r on r.lobby_id = l.id and r.taken_by = lp.user_id and r.status = 'connected'
     where g.id = p_game), 0) $$;
revoke all on function public.mm_rounds_before(uuid, uuid) from public, anon, authenticated;

create or replace function public.mm_left_last_round(p_game uuid, p_player uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  -- (replanteo 145) más las rondas de antes de que entrara, si es un reemplazo
  select coalesce((select max(s.rounds) from match_player_stats s where s.match_id = g.id and s.player_id = p_player) + mm_rounds_before(g.id, p_player), -1)
         >= greatest(coalesce(g.score1, 0) + coalesce(g.score2, 0),
                     (select coalesce(max(x.rounds), 0) from match_player_stats x where x.match_id = g.id and x.team in (1, 2))) - 1
    from matches g
   where g.id = p_game $$;

select pg_temp.reemplazar('public.mm_elo_delta(uuid,text,integer,double precision,double precision,integer)', array[
  [E'  f numeric;\n',
   E'  f numeric;\n'
   || E'  v_new boolean;        -- (replanteo 145) la partida es de abandon_rules_from o después\n'
   || E'  v_prev int := 0;      -- (replanteo 145) rondas de antes de que entrara el reemplazo que abandona\n'],
  [E'  select * into c from mm_config;\n',
   E'  select * into c from mm_config;\n'
   || E'  v_new := coalesce(g.played_at, g.starts_at) >= c.abandon_rules_from;\n'],
  [E'    f := coalesce(least(greatest((v_total - v_rounds) / nullif(v_total, 0), 0), 1), 1);\n'
   || E'    if p_res = 1 then\n',
   E'    -- (replanteo 145) sin las rondas de antes de que entrara, y con el resultado real: a quien abandona le pasan p_res = 0\n'
   || E'    if v_new then\n'
   || E'      select coalesce(max(mm_rounds_before(p_game, lp.player_id)), 0) into v_prev\n'
   || E'        from mm_lobby_players lp join players p on p.id = lp.player_id\n'
   || E'       where lp.lobby_id = v_lobby and lp.abandoned and elo_key(p.steam_id) = p_key;\n'
   || E'    end if;\n'
   || E'    f := coalesce(least(greatest((v_total - v_prev - v_rounds) / nullif(v_total, 0), 0), 1), 1);\n'
   || E'    if p_res = 1 or (v_new and g.winner_side = p_team) then\n'],
  [E'  select coalesce(max(s.rounds), 0) into v_rounds\n',
   E'  select coalesce(max(s.rounds), 0), case when v_new then coalesce(max(mm_rounds_before(p_game, lp.player_id)), 0) else 0 end into v_rounds, v_prev\n'],
  [E'  f := least(greatest((v_total - v_rounds) / nullif(v_total, 0), 0), 1) * c.abandon_adjust_pct / 100;\n',
   E'  f := least(greatest((v_total - v_prev - v_rounds) / nullif(v_total, 0), 0), 1) * c.abandon_adjust_pct / 100;\n']
]);

commit;
