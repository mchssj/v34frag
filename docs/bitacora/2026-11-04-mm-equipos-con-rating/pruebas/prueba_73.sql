-- Prueba del replanteo 73 en staging, dentro de una transacción que se deshace al final (no deja nada).
-- La arma probar_73.sh: este archivo va entre el replanteo 73 y su inversa, sin sus begin/commit.
--   :admin  un usuario admin de la base (para mm_set_config)
--   :server un servidor con mm_enabled y sin sala activa
-- Crea 10 cuentas de prueba, las ata a 10 fichas con rating y arma dos salas: con el interruptor apagado y encendido.

\echo '--- 1. Apagado: mm_balance_elos devuelve null'
create temp table t_fichas as
  select p.id player_id, mm_player_elo(p.id) elo, r.rating, r.maps, row_number() over (order by p.id) n
    from players p join player_recent_rating(array(select id from players), 365) r on r.player_id = p.id
   where p.user_id is null
   order by p.id limit 10;
select count(*) = 10 as hay_10_fichas from t_fichas;
select mm_balance_elos(array(select player_id from t_fichas order by n), array(select elo from t_fichas order by n)) is null as apagado_null;

\echo '--- 2. Encendido (365 días): ELO de armado de cada ficha y la cuenta a mano'
update mm_config set balance_rating = true, balance_rating_days = 365;
with b as (
  select unnest(mm_balance_elos(array(select player_id from t_fichas order by n), array(select elo from t_fichas order by n))) bal,
         generate_subscripts(mm_balance_elos(array(select player_id from t_fichas order by n), array(select elo from t_fichas order by n)), 1) n
)
select f.n, f.elo, f.rating, f.maps, b.bal, b.bal - f.elo ajuste,
       greatest(-100, least(100, round(200 * ((f.maps * f.rating + 5) / (f.maps + 5) - 1))))::int a_mano,
       b.bal - f.elo = greatest(-100, least(100, round(200 * ((f.maps * f.rating + 5) / (f.maps + 5) - 1))))::int ok
  from t_fichas f join b using (n) order by f.n;

\echo '--- 3. Tope 0: el ELO de armado es el ELO'
update mm_config set balance_rating_cap = 0;
select mm_balance_elos(array(select player_id from t_fichas order by n), array(select elo from t_fichas order by n))
     = array(select elo from t_fichas order by n) as tope_cero_igual_elo;
update mm_config set balance_rating_cap = 100;

\echo '--- 4. Ficha sin rating: ajuste 0'
select mm_balance_elos(array[gen_random_uuid()], array[1234]) = array[1234] as sin_rating_cero;

\echo '--- 5. Dos salas con las mismas 10 fichas: apagado y encendido'
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
  select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'prueba73-' || n || '@example.invalid', '', now(), now(), now(), '{}', '{}'
    from t_fichas;
alter table t_fichas add column user_id uuid;
update t_fichas f set user_id = u.id from auth.users u where u.email = 'prueba73-' || f.n || '@example.invalid';
update players p set user_id = f.user_id from t_fichas f where f.player_id = p.id;
update mm_server_state set last_poll_at = now(), unavailable_until = null where server_id = :'server';

create temp table t_salas (modo text, lobby uuid);
create or replace function pg_temp.armar(p_modo text) returns void language plpgsql as $$
declare v uuid;
begin
  insert into mm_queue (user_id, player_id, mode, region, elo, joined_at)
    select user_id, player_id, '5v5', null, elo, now() - make_interval(secs => n) from t_fichas;
  v := mm_try_build('5v5');
  if v is null then raise exception 'prueba 73: no se armó la sala (%)', p_modo; end if;
  insert into t_salas values (p_modo, v);
  perform mm_cancel_lobby(v, 'prueba 73');
  delete from mm_queue where user_id in (select user_id from t_fichas);
end $$;

update mm_config set balance_rating = false;
select pg_temp.armar('apagado');
update mm_config set balance_rating = true;
select pg_temp.armar('encendido');

select s.modo, lp.team, sum(lp.elo) elo, sum(lp.balance_elo) armado, string_agg(f.n::text, ',' order by f.n) fichas
  from t_salas s join mm_lobby_players lp on lp.lobby_id = s.lobby join t_fichas f on f.user_id = lp.user_id
 group by 1, 2 order by 1, 2;
select s.modo,
       abs(sum(lp.elo) filter (where team = 1) - sum(lp.elo) filter (where team = 2)) dif_elo,
       abs(sum(lp.balance_elo) filter (where team = 1) - sum(lp.balance_elo) filter (where team = 2)) dif_armado,
       count(lp.balance_elo) con_armado
  from t_salas s join mm_lobby_players lp on lp.lobby_id = s.lobby group by 1 order by 1;

\echo '--- 6. mm_set_config con un admin'
select set_config('request.jwt.claims', json_build_object('sub', :'admin', 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
select (r->>'balance_rating')::boolean = false and (r->>'balance_rating_weight')::int = 150 and (r->>'balance_rating_cap')::int = 80
       and (r->>'balance_rating_prior_maps')::int = 3 and (r->>'balance_rating_days')::int = 30 and (r->>'reconnect_minutes')::int = 3 as set_config_ok
  from mm_set_config('{"balance_rating": false, "balance_rating_weight": 150, "balance_rating_cap": 80, "balance_rating_prior_maps": 3, "balance_rating_days": 30}') r;
\echo '    (un valor fuera de rango tiene que fallar)'
savepoint fuera;
\set ON_ERROR_STOP off
select mm_set_config('{"balance_rating_cap": 9999}');
\set ON_ERROR_STOP on
rollback to savepoint fuera;
\echo '    (sin admin no se puede llamar a mm_balance_elos)'
savepoint permiso;
\set ON_ERROR_STOP off
select mm_balance_elos(array[gen_random_uuid()], array[1000]);
\set ON_ERROR_STOP on
rollback to savepoint permiso;
reset role;
