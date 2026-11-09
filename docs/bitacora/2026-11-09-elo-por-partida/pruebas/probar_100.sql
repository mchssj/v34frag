-- Prueba de la 100 sobre la base local, con rollback. Se corre con probar_100.sh (aplica antes la 98, que la base local
-- no tiene, y les saca begin/commit a la 98, la 100 y la inversa de la 100).
\set ON_ERROR_STOP on
begin;
create temp table t_antes as select id, elo_delta from match_player_stats where win_prob is not null;

\i :r98
create temp table t_md5 as select p.proname, md5(pg_get_functiondef(p.oid)) h from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('elo_apply_match', 'elo_recompute_player', 'mm_elo_stake', 'elo_set_config');

\i :r100

-- La base local no tiene la Temporada 2: la fórmula nueva (y el mínimo de la 98) desde la mitad del historial.
update elo_config set formula_from = (select percentile_disc(0.5) within group (order by played_at) from matches where kind = 'mix' and status = 'finished'),
                      min_delta_from = (select percentile_disc(0.5) within group (order by played_at) from matches where kind = 'mix' and status = 'finished')
 where id = 1;
select base, min_delta, team_cap, mult_win_min, mult_win_max, mult_loss_min, mult_loss_max, formula_from from elo_config;
select elo_recompute_all() as mixes;

create temp view v_esperado as
with cfg as (select * from elo_config where id = 1),
mt as (
  select m.id, m.winner_side, m.end_reason,
         greatest(coalesce(m.score1, 0) + coalesce(m.score2, 0), (select max(x.rounds) from match_player_stats x where x.match_id = m.id and x.team in (1, 2))) total
    from matches m
   where m.kind = 'mix' and m.status = 'finished' and coalesce(m.played_at, m.starts_at) >= (select formula_from from cfg)),
pl as (
  select s.id, s.match_id, s.team, s.rating, s.elo_delta, s.elo_after, s.elo_before, s.elo_mult, s.elo_scale, mt.winner_side, mt.end_reason,
         elo_key(s.steam_id) k, mm_elo_abandoned(s.match_id, elo_key(s.steam_id)) aband,
         case when mm_elo_abandoned(s.match_id, elo_key(s.steam_id)) then 1 else elo_weight(s.rounds, mt.total, cfg.min_pct, cfg.full_pct) end wt,
         cfg.start_elo, cfg.base, cfg.team_cap, cfg.elo_floor,
         cfg.mult_win_min, cfg.mult_win_max, cfg.mult_loss_min, cfg.mult_loss_max
    from match_player_stats s join mt on mt.id = s.match_id cross join cfg where s.team in (1, 2)),
str as (
  select match_id,
         sum(wt * coalesce(elo_before, start_elo)) filter (where team = 1) / nullif(sum(wt) filter (where team = 1), 0) e1,
         sum(wt * coalesce(elo_before, start_elo)) filter (where team = 2) / nullif(sum(wt) filter (where team = 2), 0) e2
    from pl where wt > 0 group by match_id),
c1 as (
  select pl.*, round((1 / (1 + power(10::double precision, (str.e2 - str.e1) / 400)))::numeric, 4) p1,
         (case when pl.aband then 0 else case pl.winner_side when pl.team then 1 when 3 - pl.team then 0 else 0.5 end end)::double precision res
    from pl join str using (match_id) where pl.elo_after is not null),
c2 as (
  select c1.*, round((case when c1.team = 1 then c1.p1 else 1 - c1.p1 end)::numeric, 4)::double precision pt,
         (case when c1.res = 1 then least(c1.mult_win_max, greatest(c1.mult_win_min, coalesce(c1.rating, 1)))
               when c1.res = 0 then least(c1.mult_loss_max, greatest(c1.mult_loss_min, 2 - coalesce(c1.rating, 1)))
               else 1 end)::numeric(4, 2) mult
    from c1),
c3 as (select c2.*, round(2 * c2.base * (c2.res - c2.pt) * c2.mult::double precision * c2.wt)::int d0 from c2),
c3b as (select c3.*, coalesce(mm_elo_delta(c3.match_id, c3.k, c3.team, c3.res, c3.pt, c3.d0), c3.d0) dd from c3),
c4 as (
  select c3b.*, case when not c3b.aband and max(abs(c3b.dd)) filter (where not c3b.aband) over (partition by c3b.match_id, c3b.team) > c3b.team_cap
                     then round(c3b.team_cap::numeric / max(abs(c3b.dd)) filter (where not c3b.aband) over (partition by c3b.match_id, c3b.team), 4)
                     else 1 end::numeric(6, 4) scale
    from c3b),
c5 as (select c4.*, case when c4.aband then c4.dd else round(c4.dd * c4.scale)::int end d1, elo_min_for(c4.match_id) vmin from c4)
select c5.*,
       case when c5.res = 1 then greatest(c5.d1, greatest(round(c5.vmin * c5.wt)::int, 1))
            when c5.res = 0 then least(c5.d1, -greatest(round(c5.vmin * c5.wt)::int, 1))
            else c5.d1 end esperado
  from c5;

-- 1. La fórmula exacta.
do $$ declare n int; malos int; ej record; begin
  select count(*), count(*) filter (where elo_delta <> esperado) into n, malos from v_esperado where elo_after > elo_floor;
  if malos > 0 then
    select * into ej from v_esperado where elo_after > elo_floor and elo_delta <> esperado limit 1;
    raise exception 'P1: % de % filas no siguen la fórmula (ej. delta %, esperado %, d0 %, escala %, p %)', malos, n, ej.elo_delta, ej.esperado, ej.d0, ej.scale, ej.pt;
  end if;
  if n = 0 then raise exception 'P1: no hay mixes con la fórmula nueva'; end if;
  raise notice 'P1 ok: % filas siguen la fórmula nueva', n;
  select count(*) filter (where elo_mult is distinct from mult or elo_scale is distinct from scale) into malos from v_esperado;
  if malos > 0 then raise exception 'P1b: % filas con elo_mult o elo_scale distintos', malos; end if;
  raise notice 'P1b ok: elo_mult y elo_scale guardados';
end $$;

-- 2. El tope por equipo.
do $$ declare malos int; escalados int; begin
  select count(*) into malos from (
    select match_id, team, max(abs(elo_delta)) mx from v_esperado where elo_after > elo_floor group by 1, 2) x
   where mx > (select team_cap from elo_config where id = 1);
  if malos > 0 then raise exception 'P2: % equipos pasan el tope', malos; end if;
  select count(distinct (match_id, team)) into escalados from v_esperado where scale < 1;
  raise notice 'P2 ok: ningún equipo pasa de 30 (% equipos escalados)', escalados;
end $$;

-- 3. El mínimo de 10 en los terminados; 1 en los interrumpidos; nada en los empates.
do $$ declare malos int; n_crash int; n_emp int; begin
  select count(*) into malos from v_esperado
   where end_reason is distinct from 'crash' and wt >= 1 and elo_after > elo_floor
     and ((res = 1 and elo_delta < 10) or (res = 0 and elo_delta > -10));
  if malos > 0 then raise exception 'P3: % filas con peso completo debajo de 10', malos; end if;
  select count(*) into n_crash from v_esperado where end_reason = 'crash';
  select count(*) into n_emp from v_esperado where res = 0.5;
  raise notice 'P3 ok: mínimo de 10 en los terminados (% filas de interrumpidos y % de empates, por la fórmula de P1)', n_crash, n_emp;
end $$;

-- 4. Los mixes anteriores a formula_from quedan igual.
do $$ declare n int; desde timestamptz := (select formula_from from elo_config where id = 1); begin
  select count(*) into n from match_player_stats s join t_antes a on a.id = s.id join matches m on m.id = s.match_id
   where coalesce(m.played_at, m.starts_at) < desde and s.elo_delta is distinct from a.elo_delta;
  if n > 0 then raise exception 'P4: % filas anteriores a formula_from cambiaron', n; end if;
  raise notice 'P4 ok: los mixes anteriores a % no cambian', desde;
end $$;

-- 5. elo_recompute_player da lo mismo que elo_recompute_all.
create temp table t_all as select id, elo_delta, elo_after from match_player_stats where elo_after is not null;
create temp table t_elo as select steam_id, elo, peak_elo from player_elo;
do $$ declare k text; n int; v int := 0; begin
  for k in
    select elo_key(s.steam_id) from match_player_stats s join matches m on m.id = s.match_id
     where s.elo_after is not null and coalesce(m.played_at, m.starts_at) >= (select formula_from from elo_config where id = 1)
     group by 1 order by count(*) desc limit 5
  loop
    perform elo_recompute_player(k);
    select count(*) into n from match_player_stats s join t_all a on a.id = s.id where elo_key(s.steam_id) = k and s.elo_delta is distinct from a.elo_delta;
    if n > 0 then raise exception 'P5: elo_recompute_player difiere en % filas de %', n, k; end if;
    if (select elo from player_elo where steam_id = k) is distinct from (select elo from t_elo where steam_id = k) then
      raise exception 'P5: ELO final distinto para %', k;
    end if;
    v := v + 1;
  end loop;
  raise notice 'P5 ok: elo_recompute_player coincide en % jugadores', v;
end $$;

-- 6. El ajuste manual del armado no cambia el ELO que se gana.
do $$ declare pid uuid; n int; begin
  if to_regclass('public.mm_balance_overrides') is null then
    raise notice 'P6: sin mm_balance_overrides en esta base (la 96 no está): se saltea';
    return;
  end if;
  select s.player_id into pid from match_player_stats s join matches m on m.id = s.match_id
   where s.player_id is not null and s.elo_after is not null and coalesce(m.played_at, m.starts_at) >= (select formula_from from elo_config where id = 1)
   group by 1 order by count(*) desc limit 1;
  perform mm_balance_override_set(pid, 100, 'prueba 100', 'prueba');
  perform elo_recompute_all();
  select count(*) into n from match_player_stats s join t_all a on a.id = s.id where s.elo_delta is distinct from a.elo_delta;
  if n > 0 then raise exception 'P6: con +100 de ajuste manual cambiaron % filas', n; end if;
  raise notice 'P6 ok: el ajuste manual de +100 no cambia el ELO de nadie';
end $$;

-- 7. "En juego" de la sala: entre el mínimo y el tope.
do $$ declare r record; j jsonb; n int := 0; begin
  for r in select lobby_id, user_id from mm_lobby_players limit 60 loop
    j := mm_elo_stake(r.lobby_id, r.user_id);
    if j is not null and ((j->>'win')::int not between 10 and 30 or (j->>'loss')::int not between 10 and 30) then
      raise exception 'P7: stake fuera de rango %', j;
    end if;
    if j is not null then n := n + 1; end if;
  end loop;
  raise notice 'P7 ok: % salas con lo que se juega entre 10 y 30', n;
end $$;

-- 8. elo_set_config: la llamada de la API actual sigue funcionando y valida lo nuevo.
do $$ declare c elo_config%rowtype; begin
  perform elo_set_config(p_base := 20, p_bonus_max := 5, p_bonus_factor := 5, p_floor := 100, p_start_elo := 1000, p_recompute := false);
  select * into c from elo_config where id = 1;
  if c.team_cap <> 30 or c.min_delta <> 10 or c.mult_win_max <> 1.5 then raise exception 'P8: la llamada vieja cambió lo nuevo'; end if;
  perform elo_set_config(p_base := 20, p_bonus_max := 5, p_bonus_factor := 5, p_floor := 100, p_start_elo := 1000,
                         p_mult_win_max := 1.4, p_team_cap := 35, p_min_delta := 12);
  select * into c from elo_config where id = 1;
  if c.team_cap <> 35 or c.min_delta <> 12 or c.mult_win_max <> 1.4 then raise exception 'P8: no guardó los valores nuevos'; end if;
  begin
    perform elo_set_config(p_base := 20, p_bonus_max := 5, p_bonus_factor := 5, p_floor := 100, p_start_elo := 1000, p_min_delta := 50);
    raise exception 'P8: aceptó un mínimo mayor que el tope';
  exception when sqlstate '22023' then null;
  end;
  update elo_config set mult_win_max = 1.5, team_cap = 30, min_delta = 10 where id = 1;
  raise notice 'P8 ok: elo_set_config con y sin los parámetros nuevos, y la validación';
end $$;

-- 8b. Con la fórmula nueva en todo el historial (cubre los mixes interrumpidos, con mínimo 1).
update elo_config set formula_from = '2000-01-01', min_delta_from = '2000-01-01' where id = 1;
-- La base local no tiene mixes interrumpidos con ELO: dos mixes con ganador pasan a serlo (dentro del rollback).
update matches set end_reason = 'crash'
 where id in (select id from matches where kind = 'mix' and status = 'finished' and winner_side in (1, 2)
                and end_reason is null
                and (select count(*) from match_player_stats s where s.match_id = matches.id and s.steam_id ~ '^7656') >= 10
              order by played_at desc limit 2);
select elo_recompute_all() as mixes_todo;
do $$ declare n int; malos int; n_crash int; begin
  select count(*), count(*) filter (where elo_delta <> esperado), count(*) filter (where end_reason = 'crash')
    into n, malos, n_crash from v_esperado where elo_after > elo_floor;
  if malos > 0 then raise exception 'P8b: % de % filas no siguen la fórmula', malos, n; end if;
  select count(*) into malos from v_esperado where end_reason = 'crash' and elo_after > elo_floor and res in (0, 1) and abs(elo_delta) < 1;
  if malos > 0 then raise exception 'P8b: % filas de interrumpidos sin el mínimo de 1', malos; end if;
  select count(*) into malos from v_esperado where end_reason = 'crash' and vmin <> 0;
  if malos > 0 then raise exception 'P8b: % filas de interrumpidos con el mínimo de 10', malos; end if;
  raise notice 'P8b ok: % filas con la fórmula nueva en todo el historial (% de interrumpidos, con mínimo 1)', n, n_crash;
  select count(*) into n from v_esperado where aband;
  select count(*) into malos from v_esperado where aband and end_reason is distinct from 'crash' and winner_side is not null and elo_after > elo_floor and elo_delta > -10;
  if n = 0 then raise exception 'P8c: no hay abandonos con la fórmula nueva'; end if;
  if malos > 0 then raise exception 'P8c: % abandonos pierden menos de 10', malos; end if;
  raise notice 'P8c ok: % abandonos con la cuenta de mm_elo_delta y al menos −10', n;
end $$;

-- 9. La inversa deja las funciones como estaban (con la 98).
drop view v_esperado;
\i :rev100
do $$ declare n int; begin
  select count(*) into n from t_md5 t join pg_proc p on p.proname = t.proname join pg_namespace s on s.oid = p.pronamespace and s.nspname = 'public'
   where md5(pg_get_functiondef(p.oid)) <> t.h;
  if n > 0 or (select count(*) from pg_proc where proname = 'elo_set_config') <> 1 then
    raise exception 'P9: la inversa no dejó las funciones como antes (% distintas)', n;
  end if;
  if exists (select 1 from information_schema.columns where table_name = 'elo_config' and column_name = 'team_cap') then
    raise exception 'P9: quedaron columnas de la 100';
  end if;
  raise notice 'P9 ok: la inversa deja las 4 funciones idénticas y saca las columnas';
end $$;
rollback;
