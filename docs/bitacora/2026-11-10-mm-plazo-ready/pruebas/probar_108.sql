-- Prueba del replanteo 108 en la base local (copia de producción). Todo en una transacción que se deshace.
-- Correr con probar_108.sh (aplica la 108 y su inversa adentro de la transacción).

begin;

create temp table antes as select pg_get_functiondef('public.mm_tick()'::regprocedure) as f;
\i :r108

-- Avisos y sanciones a tablas (se deshacen con todo lo demás).
create temp table avisos (t text, lobby uuid, d jsonb);
create temp table sanciones (u uuid, why text);
create or replace function public.mm_emit(p_type text, p_lobby uuid, p_users uuid[], p_data jsonb default null)
  returns void language sql as $$ insert into avisos values (p_type, p_lobby, p_data) $$;
create or replace function public.mm_penalize(p_user uuid, p_reason text)
  returns void language sql as $$ insert into sanciones values (p_user, p_reason) $$;
-- Sin armado de salas nuevas en la prueba, y ninguna otra sala abierta de la copia.
update mm_config set open = false;
update mm_lobbies set status = 'cancelled' where status not in ('finished', 'cancelled');

-- Cuatro salas 'connecting' copiadas de una terminada, con el plazo de conexión vencido salvo la D:
--   A: todos conectados, el último hace 1 minuto  -> sigue, plazo = último + 3 min, aviso lobby.update
--   B: todos conectados, el último hace 4 minutos -> cancelada sin sanción
--   C: uno sin conectar                            -> como antes: cancelada y sanción a ese
--   D: todos conectados, plazo sin vencer          -> no cambia
create temp table s (k text primary key, id uuid, src uuid);
insert into s select k, gen_random_uuid(), (select id from mm_lobbies where status = 'finished' order by created_at desc limit 1)
  from unnest(array['A','B','C','D']) k;
create temp table primero as
  select user_id from mm_lobby_players where lobby_id = (select src from s limit 1) order by user_id limit 1;

insert into mm_lobbies
  select (jsonb_populate_record(l, jsonb_build_object('id', s.id, 'status', 'connecting', 'server_id', null, 'match_id', null,
          'ended_at', null, 'end_reason', null,
          'connect_deadline', case when s.k = 'D' then now() + interval '2 minutes' else now() - interval '5 seconds' end))).*
    from mm_lobbies l join s on l.id = s.src;
insert into mm_lobby_players
  select (jsonb_populate_record(p, jsonb_build_object('lobby_id', s.id, 'left_at', null, 'abandoned', false, 'replaced_by', null,
          'connected_at', case when s.k = 'B' then now() - interval '4 minutes' else now() - interval '6 minutes' end))).*
    from mm_lobby_players p join s on p.lobby_id = s.src;
-- El último en entrar: hace 1 minuto en A y D. En C, ese no entró.
update mm_lobby_players set connected_at = now() - interval '1 minute'
 where lobby_id in (select id from s where k in ('A', 'D')) and user_id = (select user_id from primero);
update mm_lobby_players set connected_at = null
 where lobby_id = (select id from s where k = 'C') and user_id = (select user_id from primero);

select mm_tick() \g /dev/null

do $$
declare
  a mm_lobbies%rowtype; b mm_lobbies%rowtype; c mm_lobbies%rowtype; d mm_lobbies%rowtype;
  v_last timestamptz;
begin
  select * into a from mm_lobbies where id = (select id from s where k = 'A');
  select * into b from mm_lobbies where id = (select id from s where k = 'B');
  select * into c from mm_lobbies where id = (select id from s where k = 'C');
  select * into d from mm_lobbies where id = (select id from s where k = 'D');
  select max(connected_at) into v_last from mm_lobby_players where lobby_id = a.id;

  if a.status <> 'connecting' or a.connect_deadline <> v_last + interval '3 minutes' then
    raise exception '1 falla: A quedó % con plazo %', a.status, a.connect_deadline;
  end if;
  if not exists (select 1 from avisos where t = 'lobby.update' and lobby = a.id) then raise exception '1 falla: sin aviso lobby.update'; end if;
  raise notice '1 ok: todos conectados, el último hace 1 min: sigue con 3 min desde el último y avisa';

  if b.status <> 'cancelled' or b.end_reason <> 'Estaban todos, pero la partida no arrancó (faltó el !ready)' then
    raise exception '2 falla: B quedó % (%)', b.status, b.end_reason;
  end if;
  raise notice '2 ok: todos conectados hace 4 min sin arrancar: cancelada con el motivo nuevo';

  if c.status <> 'cancelled' or c.end_reason <> 'No se conectaron todos a tiempo' then
    raise exception '3 falla: C quedó % (%)', c.status, c.end_reason;
  end if;
  if (select count(*) from sanciones) <> 1 or (select u from sanciones limit 1) <> (select user_id from primero) then
    raise exception '3 falla: % sanciones', (select count(*) from sanciones);
  end if;
  raise notice '3 ok: con uno sin conectar, como antes: cancelada y sanción solo a ese (ninguna en A ni B)';

  if d.status <> 'connecting' or d.connect_deadline < now() + interval '1 minute' then
    raise exception '4 falla: D quedó % con plazo %', d.status, d.connect_deadline;
  end if;
  if exists (select 1 from avisos where lobby = d.id) then raise exception '4 falla: aviso en D'; end if;
  raise notice '4 ok: plazo sin vencer: no cambia';
end $$;

-- 5: la vuelta siguiente no vuelve a alargar A ni la cancela.
delete from avisos;
select mm_tick() \g /dev/null
do $$ begin
  if (select status from mm_lobbies where id = (select id from s where k = 'A')) <> 'connecting'
     or exists (select 1 from avisos where t = 'lobby.update' and lobby = (select id from s where k = 'A')) then
    raise exception '5 falla';
  end if;
  raise notice '5 ok: la vuelta siguiente no la toca';
end $$;

-- 6: la inversa deja mm_tick como estaba.
\i :rev108
do $$ begin
  if pg_get_functiondef('public.mm_tick()'::regprocedure) <> (select f from antes) then
    raise exception '6 falla: la inversa no deja mm_tick igual';
  end if;
  raise notice '6 ok: la inversa deja mm_tick idéntico';
end $$;

rollback;
