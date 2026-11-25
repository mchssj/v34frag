-- Pruebas del replanteo 146. Correr en una COPIA de la base (hace rollback, pero llama a mm_start_veto):
--   docker exec -i <contenedor> psql -U postgres -d <copia> -v ON_ERROR_STOP=1 -f - < preveto_146.sql
begin;
set local client_min_messages = notice;

create function pg_temp.ok(p boolean, t text) returns void language plpgsql as $$
begin if p is not true then raise exception 'FALLA: %', t; end if; raise notice 'ok - %', t; end $$;
create function pg_temp.falla(q text, msg text, t text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'FALLA: % (no dio error)', t;
exception when others then
  if sqlerrm not like msg then raise exception 'FALLA: % (dio: %)', t, sqlerrm; end if;
  raise notice 'ok - %', t;
end $$;
create function pg_temp.soy(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', u::text, true) $$;

-- 10 cuentas con ficha y fuera de salas abiertas; los 6 primeros son VIP vigentes, el 7 está vencido, el resto no.
create temp table j as select row_number() over (order by p.id) n, p.user_id, p.id player_id from players p
  where p.user_id is not null and mm_active_lobby(p.user_id) is null limit 10;
update vip_memberships set revoked_at = now() where user_id in (select user_id from j) and revoked_at is null;
insert into vip_memberships (user_id, source, starts_at, ends_at)
  select user_id, 'manual', now() - interval '2 days', case when n = 7 then now() - interval '1 day' else now() + interval '30 days' end from j where n <= 7;
update mm_config set vip_preveto_max = 2 where id = 1;
delete from mm_mode_maps where mode = '5v5';
create temp table mapas as select name, row_number() over (order by name) n from map_pool where active limit 8;
insert into mm_mode_maps (mode, map, position) select '5v5', name, n from mapas where n <= 7;
update mm_mode_settings set enabled = true where mode = '5v5';

create function pg_temp.m(i int) returns text language sql as $$ select name from mapas where n = i $$;
create function pg_temp.u(i int) returns uuid language sql as $$ select user_id from j where n = i $$;
create function pg_temp.vota(i int, mapa int) returns void language plpgsql as $$
begin perform pg_temp.soy(pg_temp.u(i)); perform mm_set_preveto('5v5', pg_temp.m(mapa)); end $$;
-- Arma una sala con los 10 y empieza el veto: devuelve la sala.
create function pg_temp.sala() returns uuid language plpgsql as $$
declare v uuid;
begin
  update mm_lobbies set status = 'cancelled', ended_at = now() where id in (select lobby_id from mm_lobby_players where user_id in (select user_id from j)) and status = 'veto';
  insert into mm_lobbies (mode, status) values ('5v5', 'accepting') returning id into v;
  insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at, accepted_at)
    select v, user_id, player_id, case when n % 2 = 0 then 1 else 2 end, 1000 + n * 10, now(), now() from j;
  perform mm_start_veto(v);
  return v;
end $$;
create function pg_temp.bans(v uuid) returns text[] language sql as $$
  select coalesce(array_agg(map order by seq), '{}') from match_vetos where match_id = (select match_id from mm_lobbies where id = v) $$;

do $$
declare v uuid; l mm_lobbies%rowtype; b jsonb; s jsonb; vistos text[] := '{}'; i int; t int;
begin
  perform pg_temp.ok((select vip_preveto_max from mm_config) = 2, 'configurado en 2');

  -- Sin prevetos: como siempre.
  v := pg_temp.sala();
  perform pg_temp.ok(pg_temp.bans(v) = '{}', 'sin prevetos no se banea nada');
  perform pg_temp.ok((select veto_turn from mm_lobbies where id = v) is not null, 'sin prevetos empieza el veto de capitanes');
  t := (select veto_turn from mm_lobbies where id = v);

  -- Elegir.
  perform pg_temp.soy(pg_temp.u(8));
  perform pg_temp.falla(format('select mm_set_preveto(%L, %L)', '5v5', pg_temp.m(1)), 'Prevetar mapas es exclusivo para VIP', 'sin VIP no se elige');
  perform pg_temp.soy(pg_temp.u(7));
  perform pg_temp.falla(format('select mm_set_preveto(%L, %L)', '5v5', pg_temp.m(1)), 'Prevetar mapas es exclusivo para VIP', 'con el VIP vencido no se elige');
  perform pg_temp.soy(pg_temp.u(1));
  perform pg_temp.falla(format('select mm_set_preveto(%L, %L)', '5v5', pg_temp.m(8)), 'Ese mapa no está en el pool', 'un mapa de fuera del pool no se elige');
  perform pg_temp.falla('select mm_set_preveto(''9v9'', ''de_x'')', 'Ese modo no está habilitado', 'un modo que no existe no se elige');
  perform pg_temp.vota(1, 1);
  perform pg_temp.vota(1, 2);
  perform pg_temp.ok((select count(*) = 1 and min(map) = pg_temp.m(2) from mm_prevetos where user_id = pg_temp.u(1)), 'elegir otro reemplaza al anterior');
  s := mm_my_profile()->'preveto';
  perform pg_temp.ok((s->>'allowed')::boolean and s->'modes'->0->>'map' = pg_temp.m(2) and (s->'modes'->0->>'max')::int = 2
    and jsonb_array_length(s->'modes'->0->'pool') = 7, 'mi estado trae el mapa, el máximo y el pool');
  perform pg_temp.soy(pg_temp.u(8));
  perform pg_temp.ok(mm_my_profile()->'preveto' = '{"allowed": false, "modes": []}'::jsonb, 'sin VIP el estado dice que no puede y no trae mapas');

  -- Un solo mapa votado: se preveta uno aunque el máximo sea 2.
  v := pg_temp.sala();
  perform pg_temp.ok(pg_temp.bans(v) = array[pg_temp.m(2)], 'un solo mapa votado: un solo preveto');

  -- 3 votos al mapa 3, 2 al 4 y 1 al 5: caen el 3 y el 4, en ese orden.
  perform pg_temp.vota(1, 3); perform pg_temp.vota(2, 3); perform pg_temp.vota(3, 3);
  perform pg_temp.vota(4, 4); perform pg_temp.vota(5, 4); perform pg_temp.vota(6, 5);
  -- El vencido ya había elegido el 5: no cuenta (si contara, empataría con el 4).
  insert into mm_prevetos (user_id, mode, map) values (pg_temp.u(7), '5v5', pg_temp.m(5));
  for i in 1..15 loop
    v := pg_temp.sala();
    if pg_temp.bans(v) <> array[pg_temp.m(3), pg_temp.m(4)] then raise exception 'FALLA: los más votados (%)', pg_temp.bans(v); end if;
  end loop;
  perform pg_temp.ok(true, 'caen los 2 más votados, en orden; el VIP vencido no cuenta');
  select * into l from mm_lobbies where id = v;
  perform pg_temp.ok(l.status = 'veto' and l.veto_turn = t and l.veto_deadline > now(), 'los prevetos no gastan turno: empieza el de menor ELO');
  b := mm_lobby_json(v, pg_temp.u(1))->'veto'->'bans';
  perform pg_temp.ok(b->0 = jsonb_build_object('seq', 1, 'team', null, 'map', pg_temp.m(3), 'auto', false, 'vip_votes', 3), 'la sala trae el preveto con sus votos y sin bando');

  -- Sigue el veto de siempre.
  perform pg_temp.falla(format('select mm_ban_map(%L, %L, null)', v, pg_temp.m(3)), 'Ese mapa ya se baneó', 'un mapa prevetado no se vuelve a banear');
  perform mm_ban_map(v, pg_temp.m(1), null);
  b := mm_lobby_json(v, pg_temp.u(1))->'veto'->'bans'->2;
  perform pg_temp.ok((b->>'seq')::int = 3 and (b->>'auto')::boolean and b->'vip_votes' = 'null' and (b->>'team')::int = t, 'el primer baneo del capitán es el 3 y lleva su bando');
  perform mm_ban_map(v, pg_temp.m(2), null); perform mm_ban_map(v, pg_temp.m(5), null); perform mm_ban_map(v, pg_temp.m(6), null);
  perform pg_temp.ok((select map = pg_temp.m(7) and veto_turn is null and status <> 'veto' from mm_lobbies where id = v), 'el veto termina con el mapa que queda');
  update mm_lobbies set status = 'cancelled', server_id = null where id = v;

  -- Empate: 2 votos al 3, y 1 al 1, 2 y 4: el 3 siempre; el segundo, al azar entre los tres.
  perform pg_temp.vota(1, 3); perform pg_temp.vota(2, 3); perform pg_temp.vota(3, 1); perform pg_temp.vota(4, 2); perform pg_temp.vota(5, 4);
  perform pg_temp.soy(pg_temp.u(6)); perform mm_set_preveto('5v5', null);
  perform pg_temp.ok(not exists (select 1 from mm_prevetos where user_id = pg_temp.u(6)), 'mapa nulo lo saca');
  for i in 1..60 loop
    v := pg_temp.sala();
    if (pg_temp.bans(v))[1] <> pg_temp.m(3) or cardinality(pg_temp.bans(v)) <> 2 then raise exception 'FALLA: empate (%)', pg_temp.bans(v); end if;
    vistos := vistos || (pg_temp.bans(v))[2];
  end loop;
  perform pg_temp.ok((select count(distinct x) = 3 and bool_and(x in (pg_temp.m(1), pg_temp.m(2), pg_temp.m(4))) from unnest(vistos) x), 'entre empatados, al azar (salieron los 3 en 60 salas)');

  -- Fuera del pool, no cuenta; vuelve, cuenta.
  delete from mm_mode_maps where mode = '5v5' and map = pg_temp.m(3);
  v := pg_temp.sala();
  perform pg_temp.ok(not pg_temp.m(3) = any(pg_temp.bans(v)), 'un mapa que salió del pool no se preveta');
  perform pg_temp.soy(pg_temp.u(1));
  perform pg_temp.ok(mm_my_profile()->'preveto'->'modes'->0->>'map' is null, 'y el estado no lo muestra elegido');
  insert into mm_mode_maps (mode, map, position) values ('5v5', pg_temp.m(3), 3);
  v := pg_temp.sala();
  perform pg_temp.ok((pg_temp.bans(v))[1] = pg_temp.m(3), 'al volver al pool, vuelve a contar');

  -- Siempre quedan 2 para los capitanes.
  update mm_config set vip_preveto_max = 10 where id = 1;
  v := pg_temp.sala();
  perform pg_temp.ok(cardinality(pg_temp.bans(v)) = 4, 'máximo 10: solo los 4 mapas con votos');
  delete from mm_mode_maps where mode = '5v5' and map in (pg_temp.m(5), pg_temp.m(6), pg_temp.m(7));
  perform pg_temp.ok(mm_preveto_slots('5v5') = 2, 'pool de 4: hasta 2 prevetos');
  v := pg_temp.sala();
  perform pg_temp.ok(cardinality(pg_temp.bans(v)) = 2 and (select status = 'veto' from mm_lobbies where id = v), 'pool de 4: quedan 2 para los capitanes');
  delete from mm_mode_maps where mode = '5v5' and map in (pg_temp.m(3), pg_temp.m(4));
  v := pg_temp.sala();
  perform pg_temp.ok(mm_preveto_slots('5v5') = 0 and pg_temp.bans(v) = '{}', 'pool de 2: no hay preveto');
  perform pg_temp.soy(pg_temp.u(1));
  perform pg_temp.falla(format('select mm_set_preveto(%L, %L)', '5v5', pg_temp.m(1)), 'El preveto de mapas está apagado', 'pool de 2: no se elige');
  insert into mm_mode_maps (mode, map, position) select '5v5', name, n from mapas where n between 3 and 7;

  -- En 0, apagado.
  update mm_config set vip_preveto_max = 0 where id = 1;
  v := pg_temp.sala();
  perform pg_temp.ok(pg_temp.bans(v) = '{}', 'en 0 no se preveta nada');
  perform pg_temp.falla(format('select mm_set_preveto(%L, %L)', '5v5', pg_temp.m(1)), 'El preveto de mapas está apagado', 'en 0 no se elige');
  perform mm_set_preveto('5v5', null);
  perform pg_temp.ok(true, 'en 0 se puede sacar el propio');
  perform pg_temp.ok(mm_my_profile()->'preveto' = 'null'::jsonb, 'en 0 el estado no lo ofrece');

  -- Configuración.
  perform pg_temp.soy((select id from profiles where role = 'admin' limit 1));
  perform pg_temp.ok((mm_set_config('{"vip_preveto_max": 3}')->>'vip_preveto_max')::int = 3, 'el admin lo cambia');
  perform mm_set_config('{"veto_seconds": 15}');
  perform pg_temp.ok((mm_admin_config()->>'vip_preveto_max')::int = 3, 'sin el campo queda como estaba');
  perform pg_temp.falla('select mm_set_config(''{"vip_preveto_max": 11}'')', '%vip_preveto_max%', 'más de 10 no se acepta');
  perform pg_temp.ok((manual_valores()->>'mm.preveto_max')::int = 3, 'el manual lo lee');
end $$;

-- Nadie lee la tabla directo.
set local role authenticated;
select pg_temp.falla('select * from mm_prevetos', '%permission denied%', 'la tabla no se lee directo');
select pg_temp.falla('select mm_preveto_slots(''5v5'')', '%permission denied%', 'mm_preveto_slots es interna');
reset role;
rollback;
