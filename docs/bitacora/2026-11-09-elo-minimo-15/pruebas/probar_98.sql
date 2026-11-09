-- Prueba de la 98 sobre la base local, con rollback. Se corre con probar_98.sh (le saca begin/commit a la 98 y a su inversa).
\set ON_ERROR_STOP on
begin;
create temp table t_md5 as select p.proname, md5(pg_get_functiondef(p.oid)) h from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('elo_apply_match', 'elo_recompute_player', 'mm_elo_stake');
create temp table t_antes as select id, match_id, steam_id, elo_delta, win_prob from match_player_stats where win_prob is not null;

\i :r98

-- 1. Apagado: todo igual que antes.
update elo_config set min_delta = 0, min_delta_from = null where id = 1;
select elo_recompute_all() as p1_mixes;
do $$ declare n int; begin
  select count(*) into n from match_player_stats s join t_antes a on a.id = s.id where s.elo_delta is distinct from a.elo_delta;
  if n > 0 then raise exception 'P1: con min_delta 0 cambiaron % filas', n; end if;
  raise notice 'P1 ok: con el mínimo apagado no cambia nada (% filas)', (select count(*) from t_antes);
end $$;

-- 2. Con 15 para todos los mixes.
update elo_config set min_delta = 15, min_delta_from = null where id = 1;
select elo_recompute_all() as p2_mixes;
create temp table t_calc as
select s.id, s.match_id, s.elo_delta, s.elo_after, m.end_reason, m.winner_side, s.team,
       mm_elo_abandoned(s.match_id, elo_key(s.steam_id)) aband,
       case when mm_elo_abandoned(s.match_id, elo_key(s.steam_id)) then 0 when m.winner_side = s.team then 1 when m.winner_side = 3 - s.team then 0 else 0.5 end res,
       elo_weight(s.rounds, greatest(coalesce(m.score1, 0) + coalesce(m.score2, 0),
                  (select max(x.rounds) from match_player_stats x where x.match_id = m.id and x.team in (1, 2))), c.min_pct, c.full_pct) wt,
       s.win_prob, s.rating, c.base, c.bonus_max, c.bonus_factor, c.elo_floor
  from match_player_stats s join matches m on m.id = s.match_id cross join elo_config c
 where s.elo_after is not null and c.id = 1;
do $$ declare n int; malos int; begin
  -- Fórmula (b) para los que no abandonaron, lejos del piso de ELO y en salas sin abandonos.
  select count(*), count(*) filter (where elo_delta <> esperado) into n, malos from (
    select t.*, case when res = 1 then greatest(round((greatest(round(2 * base * (1 - win_prob))::int, 15) + bonus) * wt)::int, round(15 * wt)::int)
                     else least(round((least(round(2 * base * (0 - win_prob))::int, -15) + bonus) * wt)::int, -round(15 * wt)::int) end esperado
      from (select t.*, greatest(-bonus_max, least(bonus_max, round((coalesce(rating, 1) - 1) * bonus_factor)::int)) bonus from t_calc t) t
     where res in (0, 1) and not aband and end_reason is distinct from 'crash' and elo_after > elo_floor
       and not exists (select 1 from matches g join mm_lobbies l on l.match_id = g.parent_match_id
                         join mm_lobby_players lp on lp.lobby_id = l.id
                        where g.id = t.match_id and lp.abandoned)) z;
  if malos > 0 then raise exception 'P2: % de % filas no siguen la fórmula', malos, n; end if;
  raise notice 'P2 ok: % filas siguen la fórmula (b)', n;
  select count(*) into malos from t_calc where res = 1 and end_reason is distinct from 'crash' and wt >= 1 and elo_delta < 15;
  if malos > 0 then raise exception 'P2b: % ganadores con peso completo suman menos de 15', malos; end if;
  select count(*) into malos from t_calc where res = 0 and end_reason is distinct from 'crash' and wt >= 1 and elo_delta > -15 and elo_after > elo_floor;
  if malos > 0 then raise exception 'P2c: % perdedores con peso completo restan menos de 15', malos; end if;
  raise notice 'P2b/c ok: nadie con peso completo queda debajo de 15 (abandonos incluidos)';
end $$;

-- 3. Interrumpidos y empates: igual que antes.
do $$ declare n int; total int; begin
  select count(*), count(*) filter (where s.elo_delta is distinct from a.elo_delta) into total, n
    from match_player_stats s join t_antes a on a.id = s.id join matches m on m.id = s.match_id
   where (m.end_reason = 'crash' or m.winner_side is null) and s.elo_after > (select elo_floor from elo_config where id = 1);
  if n > 0 then raise exception 'P3: % de % filas de interrumpidos o empates cambiaron', n, total; end if;
  raise notice 'P3 ok: % filas de interrumpidos y empates sin cambios', total;
end $$;

-- 4. min_delta_from: lo anterior no cambia.
update elo_config set min_delta_from = (select percentile_disc(0.5) within group (order by played_at) from matches where kind = 'mix' and status = 'finished') where id = 1;
select elo_recompute_all() as p4_mixes;
do $$ declare n int; desde timestamptz := (select min_delta_from from elo_config where id = 1); begin
  select count(*) into n from match_player_stats s join t_antes a on a.id = s.id join matches m on m.id = s.match_id
   where coalesce(m.played_at, m.starts_at) < desde and s.elo_delta is distinct from a.elo_delta;
  if n > 0 then raise exception 'P4: % filas anteriores a min_delta_from cambiaron', n; end if;
  raise notice 'P4 ok: los mixes anteriores a % no cambian', desde;
end $$;

-- 5. elo_recompute_player da lo mismo que elo_recompute_all.
create temp table t_all as select id, elo_delta from match_player_stats where elo_after is not null;
create temp table t_elo as select steam_id, elo from player_elo;
do $$ declare k text; n int; begin
  select elo_key(s.steam_id) into k from match_player_stats s where s.elo_after is not null group by 1 order by count(*) desc limit 1;
  perform elo_recompute_player(k);
  select count(*) into n from match_player_stats s join t_all a on a.id = s.id where elo_key(s.steam_id) = k and s.elo_delta is distinct from a.elo_delta;
  if n > 0 then raise exception 'P5: elo_recompute_player difiere en % filas de %', n, k; end if;
  if (select elo from player_elo where steam_id = k) is distinct from (select elo from t_elo where steam_id = k) then
    raise exception 'P5: ELO final distinto para %', k;
  end if;
  raise notice 'P5 ok: elo_recompute_player coincide (%)', k;
end $$;

-- 6. mm_elo_stake: nunca menos que el mínimo.
do $$ declare r record; j jsonb; n int := 0; begin
  update elo_config set min_delta_from = now() - interval '1 minute' where id = 1;
  for r in select lobby_id, user_id from mm_lobby_players limit 50 loop
    j := mm_elo_stake(r.lobby_id, r.user_id);
    if j is not null and ((j->>'win')::int < 15 or (j->>'loss')::int < 15) then raise exception 'P6: stake %', j; end if;
    if j is not null then n := n + 1; end if;
  end loop;
  raise notice 'P6 ok: % salas muestran 15 o más en lo que se juega', n;
end $$;

-- 7. La inversa devuelve las funciones originales.
\i :rev98
do $$ declare n int; begin
  select count(*) into n from t_md5 t join pg_proc p on p.proname = t.proname join pg_namespace s on s.oid = p.pronamespace and s.nspname = 'public'
   where md5(pg_get_functiondef(p.oid)) <> t.h;
  if n > 0 then raise exception 'P7: % funciones no quedaron como antes', n; end if;
  raise notice 'P7 ok: la inversa deja las funciones idénticas';
end $$;
rollback;
