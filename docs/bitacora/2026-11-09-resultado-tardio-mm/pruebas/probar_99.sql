-- Prueba de la 99 sobre la base local, con rollback. Se corre con probar_99.sh.
-- Toma una sala del matchmaking terminada con su mix, la deja como si el plugin la hubiera cancelado
-- antes de que llegara el resultado y prueba csstv_link_game.
\set ON_ERROR_STOP on
begin;
create temp table t_md5 as select md5(pg_get_functiondef('public.csstv_link_game'::regproc)) h;
create temp table t_caso as
select l.id lobby, p.id parent, p.link_code code, g.id game, g.parent_side1 side, l.server_id
  from mm_lobbies l join matches p on p.id = l.match_id join matches g on g.parent_match_id = p.id
 where l.status = 'finished' and g.server_id is not distinct from l.server_id
 order by l.ended_at desc limit 1;

\i :r99

-- Deja la sala como la deja el abort del plugin: cancelada, con el mix suelto.
create function pg_temp.preparar(p_reason text, p_ended timestamptz) returns void language plpgsql as $$
declare c record;
begin
  select * into c from t_caso;
  update matches set parent_match_id = null, parent_side1 = null where id = c.game;
  update matches set status = 'cancelled', score1 = null, score2 = null, maps = null where id = c.parent;
  update mm_lobbies set status = 'cancelled', end_reason = p_reason, ended_at = p_ended, winner_team = null where id = c.lobby;
end $$;

-- 1. Cancelada por "no llegó a la web": se vincula y queda terminada.
savepoint s1;
select pg_temp.preparar('El resultado de la partida no llegó a la web', now() - interval '20 minutes');
do $$ declare c record; ok boolean; l record; begin
  select * into c from t_caso;
  ok := csstv_link_game(c.game, c.code, c.side);
  select * into l from mm_lobbies where id = c.lobby;
  if not ok or l.status <> 'finished' or l.end_reason <> 'result' or l.winner_team is null
     or (select parent_match_id from matches where id = c.game) is distinct from c.parent
     or (select status from matches where id = c.parent) <> 'finished' then
    raise exception 'P1: no se vinculó (ok %, sala %, %)', ok, l.status, l.end_reason;
  end if;
  raise notice 'P1 ok: sala cancelada por resultado tardío queda terminada (ganador %)', l.winner_team;
end $$;
rollback to savepoint s1;

-- 2. Cancelada por otro motivo: no se vincula.
savepoint s2;
select pg_temp.preparar('El servidor se reinició durante la partida', now() - interval '20 minutes');
do $$ declare c record; begin
  select * into c from t_caso;
  perform csstv_link_game(c.game, c.code, c.side);
  if (select status from mm_lobbies where id = c.lobby) <> 'cancelled' or (select parent_match_id from matches where id = c.game) is not null then
    raise exception 'P2: se vinculó una sala cancelada por otro motivo';
  end if;
  raise notice 'P2 ok: otro motivo de cancelación no se vincula';
end $$;
rollback to savepoint s2;

-- 3. Mix de otro servidor: no se vincula.
savepoint s3;
select pg_temp.preparar('El resultado de la partida no llegó a la web', now() - interval '20 minutes');
do $$ declare c record; otro uuid; begin
  select * into c from t_caso;
  select id into otro from game_servers where id is distinct from c.server_id limit 1;
  update matches set server_id = otro where id = c.game;
  perform csstv_link_game(c.game, c.code, c.side);
  if (select status from mm_lobbies where id = c.lobby) <> 'cancelled' or (select parent_match_id from matches where id = c.game) is not null then
    raise exception 'P3: se vinculó un mix de otro servidor';
  end if;
  raise notice 'P3 ok: un mix de otro servidor no se vincula';
end $$;
rollback to savepoint s3;

-- 4. Cancelada hace más de 24 horas: no se vincula.
savepoint s4;
select pg_temp.preparar('El resultado de la partida no llegó a la web', now() - interval '25 hours');
do $$ declare c record; begin
  select * into c from t_caso;
  perform csstv_link_game(c.game, c.code, c.side);
  if (select status from mm_lobbies where id = c.lobby) <> 'cancelled' or (select parent_match_id from matches where id = c.game) is not null then
    raise exception 'P4: se vinculó una sala de hace más de 24 horas';
  end if;
  raise notice 'P4 ok: una sala cancelada hace más de 24 horas no se vincula';
end $$;
rollback to savepoint s4;

-- 5. Sala live: como antes.
savepoint s5;
select pg_temp.preparar('x', null);
do $$ declare c record; ok boolean; begin
  select * into c from t_caso;
  update matches set status = 'live' where id = c.parent;
  update mm_lobbies set status = 'live', end_reason = null where id = c.lobby;
  ok := csstv_link_game(c.game, c.code, c.side);
  if not ok or (select status from mm_lobbies where id = c.lobby) <> 'finished' then
    raise exception 'P5: una sala live no se vinculó';
  end if;
  raise notice 'P5 ok: una sala live se vincula como antes';
end $$;
rollback to savepoint s5;

-- 6. La inversa deja la función como estaba.
\i :rev99
do $$ begin
  if md5(pg_get_functiondef('public.csstv_link_game'::regproc)) <> (select h from t_md5) then
    raise exception 'P6: la inversa no dejó la función como antes';
  end if;
  raise notice 'P6 ok: la inversa deja csstv_link_game idéntica';
end $$;
rollback;
