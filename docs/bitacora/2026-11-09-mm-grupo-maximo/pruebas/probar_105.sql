-- Prueba del replanteo 105 en la base local (copia de producción), con la 105 aplicada. Todo en una transacción que
-- se deshace al final: no deja nada. Correr con:
--   docker exec -i supabase_db_v34frag-api psql -U postgres -v ON_ERROR_STOP=1 -q < probar_105.sql
-- Cada caso imprime OK o corta con un error.

begin;

-- Los avisos del socket se anotan en una tabla en vez de salir por pg_notify (se deshace con todo lo demás).
create temp table avisos (t text, users uuid[], d jsonb);
create or replace function public.mm_emit(p_type text, p_lobby uuid, p_users uuid[], p_data jsonb default null)
  returns void language sql as $$ insert into avisos values (p_type, p_users, p_data) $$;

-- Ocho cuentas con ficha, que no estén en ningún grupo, cola ni sala.
create temp table u as
  select row_number() over (order by p.id) as n, p.user_id as uid, p.id as pid
    from players p
   where p.user_id is not null
     and not exists (select 1 from mm_party_members m where m.user_id = p.user_id)
     and not exists (select 1 from mm_lobby_players lp where lp.user_id = p.user_id)
   order by p.id limit 8;
do $$ begin if (select count(*) from u) < 8 then raise exception 'faltan cuentas de prueba'; end if; end $$;

-- A: grupo de 2 sin buscar (1 y 2). B: grupo de 2 en la cola (3 y 4). C: grupo de 2 con el 5 en una sala (5 y 6).
-- D: grupo de 1 (el 7) con una invitación pendiente al 8.
create temp table g (k text primary key, id uuid);
insert into g values ('A', gen_random_uuid()), ('B', gen_random_uuid()), ('C', gen_random_uuid()), ('D', gen_random_uuid());
insert into mm_parties (id, leader_id) select g.id, u.uid from g join u on u.n = case g.k when 'A' then 1 when 'B' then 3 when 'C' then 5 else 7 end;
insert into mm_party_members (party_id, user_id)
  select (select id from g where k = x.k), (select uid from u where n = x.n)
    from (values ('A', 1), ('A', 2), ('B', 3), ('B', 4), ('C', 5), ('C', 6), ('D', 7)) x(k, n);
insert into mm_party_invites (party_id, from_user, to_user, expires_at)
  values ((select id from g where k = 'D'), (select uid from u where n = 7), (select uid from u where n = 8), now() + interval '5 minutes');
insert into mm_queue (user_id, player_id, party_id, mode, elo)
  select uid, pid, (select id from g where k = 'B'), '5v5', 1000 from u where n in (3, 4);
-- La sala: una terminada que se vuelve "live" con el 5 adentro.
create temp table sala as select id from mm_lobbies where status = 'finished' order by created_at desc limit 1;
update mm_lobbies set status = 'live' where id = (select id from sala);
insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at)
  select (select id from sala), uid, pid, 1, 1000, now() from u where n = 5;

-- 1. Con el máximo en 2 no se desarma nada.
set local request.jwt.claims = '{"role": "authenticated"}';
do $$ begin
  if mm_party_trim(2) <> 0 then raise exception '1: con 2 desarmó grupos'; end if;
  if (select count(*) from mm_party_invites where party_id = (select id from g where k = 'D') and status = 'pending') <> 1 then
    raise exception '1: venció la invitación de un grupo que no está lleno';
  end if;
  raise notice 'OK 1: con el máximo en 2 no cambia nada';
end $$;

-- 2. Un admin baja el máximo a 1 desde mm_set_config.
do $$
declare admin uuid := (select id from profiles where role = 'admin' limit 1);
begin
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  perform mm_set_config('{"max_party_size": 1}'::jsonb);
  if (select max_party_size from mm_config) <> 1 then raise exception '2: no guardó el máximo'; end if;
  if exists (select 1 from mm_parties where id in (select id from g where k in ('A', 'B'))) then raise exception '2: A o B siguen armados'; end if;
  if not exists (select 1 from mm_parties where id = (select id from g where k = 'C')) then raise exception '2: desarmó el grupo en una sala'; end if;
  if (select count(*) from mm_party_members where party_id = (select id from g where k = 'C')) <> 2 then raise exception '2: C perdió integrantes'; end if;
  if exists (select 1 from mm_queue where user_id in (select uid from u where n in (3, 4))) then raise exception '2: B sigue en la cola'; end if;
  if (select count(*) from mm_queue_log where user_id in (select uid from u where n in (3, 4)) and outcome = 'closed' and left_at = now()) <> 2 then
    raise exception '2: la salida de la cola no quedó como closed';
  end if;
  if (select status from mm_party_invites where party_id = (select id from g where k = 'D')) <> 'expired' then raise exception '2: la invitación no venció'; end if;
  if (select count(*) from avisos where t = 'party.disbanded' and (d->>'max')::int = 1) < 2 then raise exception '2: faltan avisos party.disbanded'; end if;
  if not exists (select 1 from avisos where t = 'party.disbanded' and (d->>'queued')::boolean
                  and users @> array(select uid from u where n in (3, 4))) then raise exception '2: el aviso de B no dice queued'; end if;
  if not exists (select 1 from avisos where t = 'party.disbanded' and not (d->>'queued')::boolean
                  and users @> array(select uid from u where n in (1, 2))) then raise exception '2: el aviso de A está mal'; end if;
  if exists (select 1 from avisos where t = 'party.disbanded' and users && array(select uid from u where n in (5, 6))) then
    raise exception '2: le avisó al grupo de la sala';
  end if;
  raise notice 'OK 2: mm_set_config desarma A (sin buscar) y B (en la cola, closed), deja C (en una sala) y vence la invitación de D';
end $$;

-- 3. mm_join rechaza un grupo más grande que el máximo (el grupo C, desde el 6, que no está en la sala).
do $$
declare ok boolean := false;
begin
  update mm_parties set leader_id = (select uid from u where n = 6) where id = (select id from g where k = 'C');
  update mm_lobbies set status = 'finished' where id = (select id from sala);
  update mm_config set open = true where id = 1;
  perform set_config('request.jwt.claims', json_build_object('sub', (select uid from u where n = 6), 'role', 'authenticated')::text, true);
  begin
    perform mm_join('5v5', null);
  exception when others then
    ok := sqlerrm like 'Tu grupo es más grande que el máximo actual (1)%';
    if not ok then raise exception '3: otro error: %', sqlerrm; end if;
  end;
  if not ok then raise exception '3: mm_join dejó entrar al grupo'; end if;
  raise notice 'OK 3: mm_join rechaza el grupo de 2 con el máximo en 1';
end $$;

-- 4. Cuando la sala terminó, la vuelta de mm_tick (mm_party_trim con el máximo) lo desarma.
do $$ begin
  -- Puede desarmar más de uno: si la sala que se usó tenía a alguien de un grupo real de la copia, ese grupo también
  -- quedó esperando a que terminara.
  if mm_party_trim((select max_party_size from mm_config)) < 1 then raise exception '4: no desarmó nada'; end if;
  if exists (select 1 from mm_parties where id = (select id from g where k = 'C')) then raise exception '4: C sigue'; end if;
  if not exists (select 1 from avisos where t = 'party.disbanded' and users @> array(select uid from u where n in (5, 6))) then
    raise exception '4: sin aviso a C';
  end if;
  raise notice 'OK 4: al terminar la sala, el grupo se desarma';
end $$;

-- 5. Subir el máximo no desarma nada, y con 2 un grupo de 2 entra a la cola (el chequeo nuevo no molesta).
do $$
declare admin uuid := (select id from profiles where role = 'admin' limit 1);
        e uuid := gen_random_uuid();
begin
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  perform mm_set_config('{"max_party_size": 2}'::jsonb);
  insert into mm_parties (id, leader_id) values (e, (select uid from u where n = 1));
  insert into mm_party_members (party_id, user_id) select e, uid from u where n in (1, 2);
  if mm_party_trim(2) <> 0 then raise exception '5: desarmó un grupo de 2 con el máximo en 2'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', (select uid from u where n = 1), 'role', 'authenticated')::text, true);
  begin
    perform mm_join('5v5', null);
  exception when others then
    if sqlerrm like 'Tu grupo es más grande%' then raise exception '5: rechazó un grupo de 2 con el máximo en 2'; end if;
    -- Otro motivo (sanción, pocos mixes, anticheat…) es de la cuenta de prueba, no de la 105.
    raise notice '   (mm_join no entró por otro motivo: %)', sqlerrm;
  end;
  raise notice 'OK 5: con el máximo en 2, el dúo sigue y no lo frena el chequeo nuevo';
end $$;

rollback;
