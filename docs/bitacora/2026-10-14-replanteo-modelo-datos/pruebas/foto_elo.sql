-- Recalcula el ELO desde cero y saca una foto ordenada de todo lo que tiene que quedar igual tras el
-- replanteo. Las victorias y derrotas salen de la vista player_stats si existe (después del paso 2.3) y si
-- no, de recompute_player_stats (antes).
\set QUIET on
select elo_recompute_all() \gset
do $$
declare p uuid;
begin
  if to_regclass('public.player_stats') is null then
    for p in select id from players loop perform recompute_player_stats(p); end loop;
  end if;
end $$;
\pset tuples_only on
\pset format unaligned
\pset fieldsep '|'
-- ELO por SteamID (texto completo de mu y sigma: tienen que coincidir bit a bit).
select 'elo', steam_id, elo, peak_elo, mu::text, sigma::text, matches from player_elo order by steam_id;
-- ELO de cada jugador en cada mix.
select 'mps', match_id, steam_id, team, elo_before, elo_after, elo_delta, win_prob from match_player_stats order by match_id, steam_id;
-- Victorias y derrotas por jugador.
select 'wl', id, coalesce(wins, 0), coalesce(losses, 0) from players where to_regclass('public.player_stats') is null order by id;
-- Conteos: no se tiene que perder ninguna partida ni fila de stats.
select 'n', 'matches', count(*) from matches
union all select 'n', 'match_player_stats', count(*) from match_player_stats
union all select 'n', 'player_elo', count(*) from player_elo
union all select 'n', 'players', count(*) from players;
