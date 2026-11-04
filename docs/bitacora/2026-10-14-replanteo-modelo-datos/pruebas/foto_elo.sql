-- Recalcula el ELO desde cero y saca una foto ordenada de todo lo que tiene que quedar igual tras el
-- replanteo. Las stats de cada jugador salen de la vista player_stats si existe (después de 06) y si
-- no, de players tras correr recompute_player_stats (antes). Solo se comparan jugadores con al menos
-- una partida terminada: los demás pierden sus stats manuales, que es la consecuencia aceptada en 06.
\set QUIET on
select elo_recompute_all() \gset
select to_regclass('public.player_stats') is not null as hay_vista \gset
\if :hay_vista
\else
do $$
declare p uuid;
begin
  for p in select id from players loop perform recompute_player_stats(p); end loop;
end $$;
\endif
\pset tuples_only on
\pset format unaligned
\pset fieldsep '|'
-- ELO por SteamID (texto completo de mu y sigma: tienen que coincidir bit a bit).
select 'elo', steam_id, elo, peak_elo, mu::text, sigma::text, matches from player_elo order by steam_id;
-- ELO de cada jugador en cada mix.
select 'mps', match_id, steam_id, team, elo_before, elo_after, elo_delta, win_prob from match_player_stats order by match_id, steam_id;
-- Stats por jugador con partidas: mapas, rating, K/D, HS %, ADR, victorias y derrotas.
\if :hay_vista
select 'st', player_id, maps, rating, kd, hs, adr, wins, losses from player_stats order by player_id;
\else
select 'st', p.id, p.maps, p.rating, p.kd, p.hs, p.adr, coalesce(p.wins, 0), coalesce(p.losses, 0)
  from players p
 where exists (select 1 from match_player_stats s join matches m on m.id = s.match_id
                where s.player_id = p.id and m.status = 'finished')
 order by p.id;
\endif
-- Conteos: no se tiene que perder ninguna partida ni fila de stats.
select 'n', 'matches', count(*) from matches
union all select 'n', 'match_player_stats', count(*) from match_player_stats
union all select 'n', 'player_elo', count(*) from player_elo
union all select 'n', 'players', count(*) from players;
