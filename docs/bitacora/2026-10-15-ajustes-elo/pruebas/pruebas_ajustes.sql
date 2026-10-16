\set ON_ERROR_STOP 1
set client_min_messages = notice;
-- Se corre después de pruebas_elo.sql y pruebas_participacion.sql (usa t_part y su base).

create function t_elo(s text) returns int language sql as $$ select elo from player_elo where steam_id = s $$;

-- A1: ajuste exacto de +20, crea al jugador nuevo con start_elo, no toca μ/σ ni matches
do $$ declare m0 int; mu0 float8; n int; begin
  select matches, mu into m0, mu0 from player_elo where steam_id = '76561199700000001';
  n := elo_add_adjustment(array['76561199700000001', '76561199800000001'], 20, 'prueba A1', now());
  if n <> 2 or t_elo('76561199800000001') <> 1020
     or (select (matches, mu) from player_elo where steam_id = '76561199700000001') <> (m0, mu0)
     or (select matches from player_elo where steam_id = '76561199800000001') <> 0 then raise exception 'A1 falla'; end if;
  raise notice 'A1 OK: +20 exacto, sin tocar μ ni matches';
end $$;

-- A2: validaciones
do $$ begin
  begin perform elo_add_adjustment(array['123'], 20, 'x'); raise exception 'A2a falla';
  exception when sqlstate '22023' then null; end;
  begin perform elo_add_adjustment(array['76561199800000002'], 0, 'x'); raise exception 'A2b falla';
  exception when sqlstate '22023' then null; end;
  begin perform elo_add_adjustment(array['76561199800000002'], 5, '  '); raise exception 'A2c falla';
  exception when sqlstate '22023' then null; end;
  begin perform elo_add_adjustment(array['76561199800000002','76561199800000002'], 5, 'x'); raise exception 'A2d falla';
  exception when sqlstate '22023' then null; end;
  perform set_config('test.uid', gen_random_uuid()::text, false);
  begin perform elo_add_adjustment(array['76561199800000002'], 5, 'x'); raise exception 'A2e falla';
  exception when sqlstate '42501' then null; end;
  perform set_config('test.uid', '', false);
  if exists (select 1 from elo_adjustments where steam_id = '76561199800000002') then raise exception 'A2 dejó filas'; end if;
  raise notice 'A2 OK: SteamID, 0, motivo vacío, repetidos y no admin rechazados';
end $$;

-- A3: piso de elo_config
do $$ declare id0 bigint; begin
  perform elo_add_adjustment(array['76561199800000003'], -5000, 'prueba A3');
  if t_elo('76561199800000003') <> (select elo_floor from elo_config) then raise exception 'A3 falla'; end if;
  raise notice 'A3 OK: no baja del piso';
end $$;

-- A4: el recálculo conserva los ajustes y da el mismo ELO que antes
do $$ declare antes jsonb; despues jsonb; begin
  perform elo_recompute_all();   -- base limpia con el orden cronológico
  select jsonb_object_agg(steam_id, elo) into antes from player_elo;
  perform elo_recompute_all();
  select jsonb_object_agg(steam_id, elo) into despues from player_elo;
  if antes <> despues or t_elo('76561199800000001') <> 1020 then raise exception 'A4 falla'; end if;
  raise notice 'A4 OK: recalcular dos veces da lo mismo y el ajuste sigue (1020)';
end $$;

-- A5: el ajuste cae en su lugar cronológico: un mix posterior arranca con el ELO ajustado
do $$ declare mid uuid; before int; begin
  perform elo_add_adjustment(array['76561199800000004'], 50, 'prueba A5', now() - interval '1 day');
  mid := t_part('ajuste-0001', array['76561199800000004:1:30', '76561199800000005:2:30'], 16, 14, 1);
  perform elo_recompute_all();
  select elo_before into before from match_player_stats where match_id = mid and steam_id = '76561199800000004';
  if before <> 1050 then raise exception 'A5 falla: elo_before %', before; end if;
  raise notice 'A5 OK: el mix posterior parte de 1050';
end $$;

-- A6: quitar un ajuste lo deshace sin recalcular
do $$ declare aid bigint; e0 int; begin
  e0 := t_elo('76561199800000001');
  select id into aid from elo_adjustments where steam_id = '76561199800000001';
  perform elo_remove_adjustment(aid);
  if t_elo('76561199800000001') <> e0 - 20 or exists (select 1 from elo_adjustments where id = aid) then raise exception 'A6 falla'; end if;
  begin perform elo_remove_adjustment(aid); raise exception 'A6b falla'; exception when sqlstate 'P0002' then null; end;
  raise notice 'A6 OK: se resta y se borra';
end $$;

-- A7: el script del ajuste real (con players de prueba)
alter table players add column if not exists steam_id text unique;
insert into players(nick, steam_id) values ('RBK','76561199900000001'), ('KyanSuke','76561199900000002'),
  ('flow','76561199900000003'), ('Naukky','76561199900000004'), ('honzzq','76561201135522278');
