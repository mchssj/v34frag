-- Prueba del replanteo 107. Aplica la 107, prueba cada caso, aplica la inversa y deshace todo (rollback).
-- Se arma con: ./prueba_107.sh > /tmp/p107.sql  (mete la 107 y la inversa en su lugar) y se corre con psql.
-- Usa 14 cuentas reales con ficha, SteamID y correo confirmado, sin sala activa ni cola; los cambios no quedan.
\set ON_ERROR_STOP 1
begin;

create temp table t_md5 as select md5(pg_get_functiondef('public.mm_try_build(text)'::regprocedure)) as antes;

-- @@107@@

create temp table t_u as
  select row_number() over (order by p.id) as n, p.user_id, p.id as player_id, p.steam_id
    from players p join auth.users u on u.id = p.user_id
   where p.steam_id is not null and u.email_confirmed_at is not null
     and mm_active_lobby(p.user_id) is null
     and not exists (select 1 from mm_queue q where q.user_id = p.user_id)
     and not exists (select 1 from mm_party_members m where m.user_id = p.user_id)
     and not mm_user_banned(p.user_id)
   order by p.id limit 14;
do $$ begin if (select count(*) from t_u) < 14 then raise exception 'faltan cuentas de prueba'; end if; end $$;

create function pg_temp.u(i int) returns uuid language sql as $$ select user_id from t_u where n = i $$;
create function pg_temp.pl(i int) returns uuid language sql as $$ select player_id from t_u where n = i $$;
create function pg_temp.ban(i int) returns uuid language sql as $$
  select ban_insert(pg_temp.pl(i), null, null, 'prueba 107', now() + interval '1 hour', 'web', null, null, 'prueba', null) $$;
create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALLA: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function pg_temp.queue(i int, party uuid default null) returns void language sql as $$
  insert into mm_queue (user_id, player_id, party_id, mode, region, elo, joined_at)
  values (pg_temp.u(i), pg_temp.pl(i), party, '5v5', 'sa', 1000, now() - interval '1 minute') $$;
-- Sala de 10 (cuentas 1 a 10) en el estado pedido; la 1 y la 2 forman un grupo.
create function pg_temp.lobby(p_status text) returns uuid language plpgsql as $$
declare v uuid; v_party uuid;
begin
  insert into mm_parties (leader_id) values (pg_temp.u(1)) returning id into v_party;
  insert into mm_party_members (party_id, user_id) values (v_party, pg_temp.u(1)), (v_party, pg_temp.u(2));
  insert into mm_lobbies (mode, status, accept_deadline, connect_deadline)
    values ('5v5', p_status, now() + interval '1 minute', now() + interval '5 minutes') returning id into v;
  insert into mm_lobby_players (lobby_id, user_id, player_id, party_id, region, team, elo, joined_at, accepted_at, connected_at)
    select v, user_id, player_id, case when n <= 2 then v_party end, 'sa', (1 + n % 2)::smallint, 1000, now() - interval '2 minutes',
           now(), case when p_status = 'live' then now() end
      from t_u where n <= 10;
  return v;
end $$;
create function pg_temp.clean() returns void language plpgsql as $$
begin
  delete from mm_queue where user_id in (select user_id from t_u);
  delete from mm_lobby_players where user_id in (select user_id from t_u);
  delete from mm_party_members where user_id in (select user_id from t_u);
  update bans set lifted_at = now() where player_id in (select player_id from t_u) and lifted_at is null;
end $$;

-- 1. Solo en la cola.
select pg_temp.queue(1);
select pg_temp.ban(1);
select pg_temp.check(not exists (select 1 from mm_queue where user_id = pg_temp.u(1)), 'solo: sale de la cola');
select pg_temp.check((select outcome from mm_queue_log where user_id = pg_temp.u(1) order by left_at desc limit 1) = 'cancelled', 'solo: queda como cancelled');
select pg_temp.check(not exists (select 1 from mm_penalties where user_id = pg_temp.u(1) and until > now()), 'solo: sin sanción de matchmaking');
select pg_temp.clean();

-- 2. En la cola con un grupo de 3: salen los tres; uno que no es del grupo se queda.
do $$
declare v_party uuid;
begin
  insert into mm_parties (leader_id) values (pg_temp.u(11)) returning id into v_party;
  insert into mm_party_members (party_id, user_id) values (v_party, pg_temp.u(11)), (v_party, pg_temp.u(12)), (v_party, pg_temp.u(13));
  perform pg_temp.queue(11, v_party); perform pg_temp.queue(12, v_party); perform pg_temp.queue(13, v_party);
  perform pg_temp.queue(14);
  perform pg_temp.ban(12);
end $$;
select pg_temp.check(not exists (select 1 from mm_queue where user_id in (pg_temp.u(11), pg_temp.u(12), pg_temp.u(13))), 'grupo: sale todo el grupo');
select pg_temp.check(exists (select 1 from mm_queue where user_id = pg_temp.u(14)), 'grupo: el de afuera sigue en la cola');
select pg_temp.check(exists (select 1 from mm_party_members where user_id = pg_temp.u(11)), 'grupo: el grupo no se desarma');
select pg_temp.clean();

-- 3. Sala aceptando: se cancela, los demás vuelven con su lugar y el baneado (y su grupo) no.
create temp table t_l (id uuid);
insert into t_l select pg_temp.lobby('accepting');
select pg_temp.ban(1);
select pg_temp.check((select status from mm_lobbies where id = (select id from t_l)) = 'cancelled', 'aceptando: la sala se cancela');
select pg_temp.check((select end_reason from mm_lobbies where id = (select id from t_l)) = 'Un jugador fue baneado', 'aceptando: con el motivo');
select pg_temp.check((select count(*) from mm_queue where user_id in (select user_id from t_u where n between 3 and 10)) = 8, 'aceptando: los otros 8 vuelven a la cola');
select pg_temp.check(not exists (select 1 from mm_queue where user_id in (pg_temp.u(1), pg_temp.u(2))), 'aceptando: el baneado y su compañero de grupo no');
select pg_temp.check((select declined_at from mm_lobby_players where lobby_id = (select id from t_l) and user_id = pg_temp.u(1)) is not null, 'aceptando: queda como rechazo');
select pg_temp.clean(); truncate t_l;

-- 4. Sala conectando: lo mismo.
insert into t_l select pg_temp.lobby('connecting');
select pg_temp.ban(5);
select pg_temp.check((select status from mm_lobbies where id = (select id from t_l)) = 'cancelled', 'conectando: la sala se cancela');
select pg_temp.check((select count(*) from mm_queue where user_id in (select user_id from t_u where n <= 10)) = 9, 'conectando: los otros 9 vuelven a la cola');
select pg_temp.check(not exists (select 1 from mm_queue where user_id = pg_temp.u(5)), 'conectando: el baneado no');
select pg_temp.clean(); truncate t_l;

-- 5. Sala en vivo: abandono en el acto, sin sanción, la sala sigue.
insert into t_l select pg_temp.lobby('live');
select pg_temp.ban(3);
select pg_temp.check((select status from mm_lobbies where id = (select id from t_l)) = 'live', 'en vivo: la sala sigue');
select pg_temp.check((select abandoned and left_at is null from mm_lobby_players where lobby_id = (select id from t_l) and user_id = pg_temp.u(3)), 'en vivo: abandono marcado');
select pg_temp.check((select count(*) from mm_lobby_players where lobby_id = (select id from t_l) and abandoned) = 1, 'en vivo: solo él');
select pg_temp.check(not exists (select 1 from mm_penalties where user_id = pg_temp.u(3) and until > now()), 'en vivo: sin sanción de matchmaking');
select pg_temp.clean(); truncate t_l;

-- 6. SteamID sin ficha y alguien que no juega matchmaking: nada, sin error.
select pg_temp.check(ban_insert(null, '76561190000000107', 'nadie', 'prueba 107', now() + interval '1 hour', 'web', null, null, 'prueba', null) is not null, 'SteamID sin ficha: se banea');
select pg_temp.check(pg_temp.ban(14) is not null, 'sin matchmaking: se banea');
select pg_temp.clean();

-- 7. Un baneo que no está activo (se guarda ya levantado) no saca a nadie. Uno vencido no se puede guardar (bans_expira).
select pg_temp.queue(6);
insert into bans (player_id, steam_id, reason, expires_at, source, lifted_at) select player_id, steam_id, 'prueba 107', now() + interval '1 hour', 'web', now() from t_u where n = 6;
select pg_temp.check(exists (select 1 from mm_queue where user_id = pg_temp.u(6)), 'levantado: sigue en la cola');
select pg_temp.clean();

-- 8. Un baneo que reemplaza a otro también saca.
select pg_temp.ban(7);
select pg_temp.queue(7);  -- se cuela (por ejemplo, con el trigger caído)
select pg_temp.check(mm_unit_banned(pg_temp.u(7)::text), 'red: mm_unit_banned lo ve');
select pg_temp.check(not mm_unit_banned(pg_temp.u(8)::text), 'red: y no ve a otro');
select pg_temp.ban(7);
select pg_temp.check(not exists (select 1 from mm_queue where user_id = pg_temp.u(7)), 'reemplazo: sale de la cola');
select pg_temp.clean();

-- 9. mm_try_build tiene la condición en los tres lugares.
select pg_temp.check((select (length(f) - length(replace(f, 'mm_unit_banned(', ''))) / length('mm_unit_banned(') = 3
                        from (select pg_get_functiondef('public.mm_try_build(text)'::regprocedure) f) x), 'armado: la red está en los 3 lugares');

-- 10. Si mm_ban_kick falla, el baneo se guarda igual.
create or replace function public.mm_ban_kick(p_ban uuid) returns jsonb language plpgsql as $$ begin raise exception 'roto a propósito'; end $$;
select pg_temp.queue(9);
select pg_temp.check(pg_temp.ban(9) is not null, 'falla: el baneo se guarda');
select pg_temp.check(exists (select 1 from mm_queue where user_id = pg_temp.u(9)), 'falla: (y la cola queda como estaba)');
select pg_temp.clean();

-- 11. La inversa deja mm_try_build como antes.
-- @@INVERSA@@
select pg_temp.check((select md5(pg_get_functiondef('public.mm_try_build(text)'::regprocedure)) from t_md5) = (select antes from t_md5), 'inversa: mm_try_build igual que antes');
select pg_temp.check(to_regprocedure('public.mm_ban_kick(uuid)') is null, 'inversa: sin mm_ban_kick');

rollback;
