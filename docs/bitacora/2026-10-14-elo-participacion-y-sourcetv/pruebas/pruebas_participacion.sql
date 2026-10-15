\set ON_ERROR_STOP 1
set client_min_messages = notice;
-- Se corre después de pruebas_elo.sql (usa sus funciones de soporte y su base).

-- Mix armado a mano: cada jugador 'steamid:equipo:rondas'. Rating 1.00 (sin bonus).
create function t_part(uid text, pl text[], s1 int, s2 int, win int) returns uuid language plpgsql as $$
declare t1 uuid; t2 uuid; mid uuid; x text; a text[]; begin
  insert into teams(name,kind) values ('A','mix') returning id into t1;
  insert into teams(name,kind) values ('B','mix') returning id into t2;
  insert into matches(kind,status,team1,team2,winner,score1,score2,external_id,played_at)
  values ('mix','finished',t1,t2,case win when 1 then t1 when 2 then t2 end,s1,s2,uid,now()) returning id into mid;
  foreach x in array pl loop a := string_to_array(x, ':');
    insert into match_player_stats(match_id,steam_id,team,rounds,rating) values (mid,a[1],a[2]::int,a[3]::int,1.0); end loop;
  perform elo_apply_match(mid); return mid; end $$;
create function t_d(mid uuid, s text) returns int language sql as $$ select elo_delta from match_player_stats where match_id=mid and steam_id=s $$;

-- P1: valores por defecto
do $$ begin
  if (select (min_pct, full_pct) from elo_config) <> (35, 90) then raise exception 'P1 falla'; end if;
  raise notice 'P1 OK: 35%% / 90%% por defecto';
end $$;

-- P2: pesos con enteros exactos
do $$ begin
  if elo_weight(10,30,35,90) <> 0 or elo_weight(11,30,35,90) <> 11/30.0 or elo_weight(26,30,35,90) <> 26/30.0
     or elo_weight(27,30,35,90) <> 1 or elo_weight(30,30,35,90) <> 1 or elo_weight(0,30,35,90) <> 0 or elo_weight(5,0,35,90) <> 0
     or elo_weight(7,20,35,90) <> 0.35 then raise exception 'P2 falla'; end if;
  raise notice 'P2 OK: 10/30 = 0, 11/30 = 0.367, 27/30 = 1, 7/20 = 0.35';
end $$;

-- P3: 3v3 parejo de jugadores nuevos, 16-14. Cada equipo: 30, 20 y 10 rondas.
--     Fuerza igual en los dos lados -> base ±30; 20 rondas da ±20; 10 rondas (33%) no cambia.
do $$ declare mid uuid; p numeric; begin
  mid := t_part('part-0001', array['76561199700000001:1:30','76561199700000002:1:20','76561199700000003:1:10',
                                   '76561199700000004:2:30','76561199700000005:2:20','76561199700000006:2:10'], 16, 14, 1);
  select min(win_prob) into p from match_player_stats where match_id=mid;
  if p <> 0.5 or t_d(mid,'76561199700000001') <> 30 or t_d(mid,'76561199700000002') <> 20
     or t_d(mid,'76561199700000004') <> -30 or t_d(mid,'76561199700000005') <> -20
     or t_d(mid,'76561199700000003') is not null or t_d(mid,'76561199700000006') is not null
     or exists (select 1 from player_elo where steam_id in ('76561199700000003','76561199700000006'))
  then raise exception 'P3 falla'; end if;
  raise notice 'P3 OK: +30 / +20 / sin cambio y -30 / -20 / sin cambio';
end $$;

-- P4: TrueSkill escalado. Con el mismo punto de partida, el de 20 rondas mueve μ 2/3 de lo
--     que mueve el de 30, y σ baja menos.
do $$ declare a record; b record; begin
  select mu - 25 dmu, sigma into a from player_elo where steam_id='76561199700000001';
  select mu - 25 dmu, sigma into b from player_elo where steam_id='76561199700000002';
  if abs(b.dmu - a.dmu * 20 / 30) > 1e-9 or not (b.sigma > a.sigma and b.sigma < 25.0/3) or a.dmu <= 0 then
    raise exception 'P4 falla: % %', a, b; end if;
  raise notice 'P4 OK: Δμ % y % (2/3), σ % y %', round(a.dmu::numeric,4), round(b.dmu::numeric,4), round(a.sigma::numeric,4), round(b.sigma::numeric,4);
end $$;

-- P5: reemplazo. Equipo 1: 4 completos + uno que se fue en la ronda 6 + su reemplazo de 24
--     rondas; equipo 2: 5 completos. Con peso, el equipo 1 vale 5 jugadores (24/30 = 0.8 y 6/30 = 0)
--     -> no es favorito por tener 6. Sin peso estaría en 6 vs 5.
do $$ declare mid uuid; p numeric; begin
  mid := t_part('part-0002', array['76561199710000001:1:30','76561199710000002:1:30','76561199710000003:1:30','76561199710000004:1:30',
                                   '76561199710000005:1:6','76561199710000006:1:24',
                                   '76561199710000007:2:30','76561199710000008:2:30','76561199710000009:2:30','76561199710000010:2:30','76561199710000011:2:30'], 16, 14, 1);
  select win_prob into p from match_player_stats where match_id=mid and steam_id='76561199710000001';
  if p >= 0.5 or t_d(mid,'76561199710000005') is not null or t_d(mid,'76561199710000006') <> round(t_d(mid,'76561199710000001') * 0.8) then
    raise exception 'P5 falla: p=%, %, %', p, t_d(mid,'76561199710000006'), t_d(mid,'76561199710000001'); end if;
  raise notice 'P5 OK: equipo con reemplazo p=% (4.8 vs 5 jugadores), reemplazo % (0.8 de %)', p, t_d(mid,'76561199710000006'), t_d(mid,'76561199710000001');
end $$;

-- P6: ronda empatada: marcador 15-14 (29) pero los que jugaron todo tienen 30 -> rondas del mix = 30.
--     El de 27 rondas cuenta completo; el de 26 no.
do $$ declare mid uuid; begin
  mid := t_part('part-0003', array['76561199720000001:1:30','76561199720000002:1:27','76561199720000003:1:26',
                                   '76561199720000004:2:30','76561199720000005:2:30','76561199720000006:2:30'], 15, 14, 1);
  if t_d(mid,'76561199720000002') <> t_d(mid,'76561199720000001')
     or t_d(mid,'76561199720000003') <> round(t_d(mid,'76561199720000001') * 26 / 30.0) then raise exception 'P6 falla'; end if;
  raise notice 'P6 OK: 30 y 27 rondas dan %, 26 rondas da %', t_d(mid,'76561199720000001'), t_d(mid,'76561199720000003');
end $$;

-- P7: mínimo ±1 después de escalar. 11 de 30 rondas en el equipo favorito: (base chica) × 0.37 -> al menos +1.
do $$ declare mid uuid; begin
  insert into player_elo(steam_id, elo, mu, sigma) values ('76561199730000001',2000,45,2),('76561199730000002',2000,45,2);
  mid := t_part('part-0004', array['76561199730000001:1:30','76561199730000002:1:11','76561199730000003:2:30','76561199730000004:2:30'], 16, 2, 1);
  if t_d(mid,'76561199730000002') < 1 or t_d(mid,'76561199730000002') > t_d(mid,'76561199730000001') then raise exception 'P7 falla'; end if;
  raise notice 'P7 OK: favorito completo +%, con 11 rondas +%', t_d(mid,'76561199730000001'), t_d(mid,'76561199730000002');
end $$;

-- P8: si un equipo no tiene a nadie que llegue al mínimo, el mix no mueve ELO.
do $$ declare mid uuid; begin
  mid := t_part('part-0005', array['76561199740000001:1:30','76561199740000002:2:5'], 16, 0, 1);
  if exists (select 1 from match_player_stats where match_id=mid and elo_after is not null) then raise exception 'P8 falla'; end if;
  raise notice 'P8 OK: sin rival que cuente, sin ELO';
end $$;

-- P9: configuración. Parámetros vacíos conservan; valores inválidos se rechazan; mínimo 50 cambia el resultado.
do $$ declare mid uuid; begin
  perform elo_set_config(30, 5, 10, 100, 1000, false, 50, 80);
  perform elo_set_config(30, 5, 10, 100, 1000);          -- como la web anterior: no los manda
  if (select (min_pct, full_pct) from elo_config) <> (50, 80) then raise exception 'P9: no conservó'; end if;
  begin perform elo_set_config(30, 5, 10, 100, 1000, false, 60, 50); raise exception 'P9: aceptó completo < mínimo';
  exception when invalid_parameter_value then null; end;
  begin perform elo_set_config(30, 5, 10, 100, 1000, false, 0, 90); raise exception 'P9: aceptó mínimo 0';
  exception when invalid_parameter_value then null; end;
  mid := t_part('part-0006', array['76561199750000001:1:30','76561199750000002:1:14','76561199750000003:1:24',
                                   '76561199750000004:2:30','76561199750000005:2:14','76561199750000006:2:24'], 16, 14, 1);
  -- 14/30 = 47% < 50%: no cuenta; 24/30 = 80%: completo
  if t_d(mid,'76561199750000002') is not null or t_d(mid,'76561199750000003') <> t_d(mid,'76561199750000001') then raise exception 'P9 falla'; end if;
  perform elo_set_config(30, 5, 10, 100, 1000, false, 35, 90);
  raise notice 'P9 OK: conserva, rechaza inválidos y con 50/80 el de 14 rondas no cuenta y el de 24 cuenta completo';
end $$;

-- P10: permisos
do $$ begin
  if has_function_privilege('anon','elo_weight(integer,integer,integer,integer)','execute')
     or has_function_privilege('authenticated','elo_weight(integer,integer,integer,integer)','execute')
     or has_function_privilege('anon','elo_set_config(integer,integer,numeric,integer,integer,boolean,integer,integer)','execute')
     or not has_function_privilege('authenticated','elo_set_config(integer,integer,numeric,integer,integer,boolean,integer,integer)','execute')
     or exists (select 1 from pg_proc where proname='elo_set_config' and pronargs=6)
  then raise exception 'P10 falla'; end if;
  raise notice 'P10 OK: permisos y sin la versión de 6 parámetros';
end $$;

-- P11: un no admin no puede cambiar la configuración
do $$ begin
  perform set_config('test.uid', gen_random_uuid()::text, true);
  begin perform elo_set_config(30, 5, 10, 100, 1000, false, 40, 90); raise exception 'P11 falla';
  exception when insufficient_privilege then raise notice 'P11 OK: no admin rechazado'; end;
  perform set_config('test.uid', '', true);
end $$;

-- P12: recalcular todo dos veces da el mismo estado (la regla nueva es determinista)
select elo_recompute_all() as aplicados;
create temp table snap2 as select steam_id, elo, peak_elo, round(mu::numeric,9) mu, round(sigma::numeric,9) sigma, matches from player_elo;
select elo_recompute_all() as aplicados;
do $$ begin
  if exists (select * from snap2 except select steam_id, elo, peak_elo, round(mu::numeric,9), round(sigma::numeric,9), matches from player_elo)
     or (select count(*) from snap2) <> (select count(*) from player_elo) then raise exception 'P12 falla'; end if;
  raise notice 'P12 OK: elo_recompute_all es repetible';
end $$;
