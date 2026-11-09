-- Prueba del replanteo 96 (ajuste manual del armado), dentro de una transacción que se deshace al final.
-- La arma probar_96.sh: este archivo va entre el replanteo 96 y su inversa, sin sus begin/commit.
-- Antes del replanteo, probar_96.sh guarda en t_antes_elos el resultado de mm_balance_elos con el código de la 73.
--   :server un servidor con mm_enabled y sin sala activa (para la sala real del punto 9)

create or replace function pg_temp.falla(p_sql text) returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  return true;
end $$;

\echo '--- 1. Sin ajustes: lo mismo que antes, encendido y apagado'
select mm_balance_elos(array(select player_id from t_fichas order by n), array(select elo from t_fichas order by n))
       is not distinct from (select v from t_antes_elos where modo = 'encendido') as encendido_igual,
       (select balance_rating from mm_config) as balance_rating_encendido;
update mm_config set balance_rating = false;
select mm_balance_elos(array(select player_id from t_fichas order by n), array(select elo from t_fichas order by n)) is null
       and (select v from t_antes_elos where modo = 'apagado') is null as apagado_null_como_antes;
update mm_config set balance_rating = true;

\echo '--- 2. +150 a la ficha 1: sube 150 y las demás no cambian'
select (mm_balance_override_set((select player_id from t_fichas where n = 1), 150, 'prueba 96', 'Prueba')).points = 150 as puesto;
with a as (select unnest(v) x, generate_subscripts(v, 1) i from t_antes_elos where modo = 'encendido'),
     b as (select unnest(v) x, generate_subscripts(v, 1) i from
             (select mm_balance_elos(array(select player_id from t_fichas order by n), array(select elo from t_fichas order by n)) v) q)
select bool_and(case when a.i = 1 then b.x = a.x + 150 else b.x = a.x end) as solo_la_1_sube_150
  from a join b using (i);

\echo '--- 3. Después del tope del rating: la ficha con el tope (+200) y +150 manual queda en ELO + 350'
select t.player_id is not null as hay_ficha_con_tope,
       mm_balance_elos(array[t.player_id], array[1000]) = array[1200] as antes_1200
  from t_tope t;
select mm_balance_override_set((select player_id from t_tope), 150, 'prueba 96 tope', 'Prueba') is not null as puesto_tope;
select mm_balance_elos(array[(select player_id from t_tope)], array[1000]) = array[1350] as con_manual_1350;

\echo '--- 4. Apagado: el ajuste se aplica igual; sin ajuste en la sala, null'
update mm_config set balance_rating = false;
select mm_balance_elos(array(select player_id from t_fichas order by n), array(select elo from t_fichas order by n))
       = array(select elo + case when n = 1 then 150 else 0 end from t_fichas order by n) as apagado_solo_el_manual;
select mm_balance_elos(array(select player_id from t_fichas where n > 1 order by n), array(select elo from t_fichas where n > 1 order by n))
       is null as apagado_sin_ajuste_null;

\echo '--- 5. Vencido: se ignora'
update mm_balance_overrides set expires_at = now() - interval '1 minute' where player_id = (select player_id from t_fichas where n = 1);
select mm_balance_elos(array(select player_id from t_fichas order by n), array(select elo from t_fichas order by n)) is null as vencido_ignorado,
       not exists (select 1 from mm_balance_overrides_active where player_id = (select player_id from t_fichas where n = 1)) as fuera_de_la_vista;
update mm_config set balance_rating = true;

\echo '--- 6. Errores'
select pg_temp.falla(format('select mm_balance_override_set(%L, 0, ''motivo'', ''Prueba'')', (select player_id from t_fichas where n = 2))) as cero_falla,
       pg_temp.falla(format('select mm_balance_override_set(%L, 301, ''motivo'', ''Prueba'')', (select player_id from t_fichas where n = 2))) as mas_301_falla,
       pg_temp.falla(format('select mm_balance_override_set(%L, -301, ''motivo'', ''Prueba'')', (select player_id from t_fichas where n = 2))) as menos_301_falla,
       pg_temp.falla(format('select mm_balance_override_set(%L, 100, ''  '', ''Prueba'')', (select player_id from t_fichas where n = 2))) as sin_motivo_falla,
       pg_temp.falla(format('select mm_balance_override_set(%L, 100, ''motivo'', ''Prueba'', 181)', (select player_id from t_fichas where n = 2))) as dias_181_falla,
       pg_temp.falla(format('select mm_balance_override_set(%L, 100, ''motivo'', ''Prueba'', 0)', (select player_id from t_fichas where n = 2))) as dias_0_falla,
       pg_temp.falla('select mm_balance_override_set(gen_random_uuid(), 100, ''motivo'', ''Prueba'')') as ficha_inexistente_falla,
       pg_temp.falla(format('select mm_balance_override_clear(%L, '''', ''Prueba'')', (select player_id from t_fichas where n = 1))) as baja_sin_motivo_falla,
       pg_temp.falla(format('update mm_balance_overrides set points = 0 where player_id = %L', (select player_id from t_fichas where n = 1))) as cero_a_mano_falla;
select (mm_balance_override_set((select player_id from t_fichas where n = 2), -300, 'motivo', 'Prueba', 180)).expires_at
       between now() + interval '179 days 23 hours' and now() + interval '180 days 1 hour' as menos_300_y_180_dias_ok,
       (mm_balance_override_set((select player_id from t_fichas where n = 3), 300, 'motivo', 'Prueba')).expires_at
       between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour' as mas_300_y_30_dias_por_defecto;

\echo '--- 7. Historial: alta, cambio, cambio a mano y baja'
select mm_balance_override_set((select player_id from t_fichas where n = 4), 50, 'alta', 'Daniel') is not null as alta;
select mm_balance_override_set((select player_id from t_fichas where n = 4), 80, 'cambio', 'Daniel', 10) is not null as cambio;
update mm_balance_overrides set points = 90 where player_id = (select player_id from t_fichas where n = 4);
select mm_balance_override_clear((select player_id from t_fichas where n = 4), 'ya no hace falta', 'Daniel') as baja_habia,
       mm_balance_override_clear((select player_id from t_fichas where n = 4), 'otra vez', 'Daniel') = false as baja_sin_fila_false;
select string_agg(action || ':' || coalesce(points_before::text, '-') || '>' || coalesce(points_after::text, '-') || ':' || coalesce(reason, '-') || ':' || coalesce(set_by, '-'),
                  ' | ' order by id) as historial,
       string_agg(action || ':' || coalesce(points_before::text, '-') || '>' || coalesce(points_after::text, '-') || ':' || coalesce(reason, '-') || ':' || coalesce(set_by, '-'),
                  ' | ' order by id)
         = 'set:->50:alta:Daniel | update:50>80:cambio:Daniel | update:80>90:cambio:Daniel | clear:90>-:ya no hace falta:Daniel' as historial_ok,
       bool_and(db_user = current_user) as con_db_user
  from mm_balance_override_log where player_id = (select player_id from t_fichas where n = 4);
delete from mm_balance_overrides where player_id = (select player_id from t_fichas where n = 2);
select reason is null and set_by is null and action = 'clear' as baja_a_mano_registrada
  from mm_balance_override_log where player_id = (select player_id from t_fichas where n = 2) order by id desc limit 1;

\echo '--- 8. Permisos: anon y authenticated no ven ni llaman nada'
select not has_table_privilege('anon', 'public.mm_balance_overrides', 'select')
       and not has_table_privilege('authenticated', 'public.mm_balance_overrides', 'select')
       and not has_table_privilege('authenticated', 'public.mm_balance_overrides', 'insert')
       and not has_table_privilege('anon', 'public.mm_balance_override_log', 'select')
       and not has_table_privilege('authenticated', 'public.mm_balance_override_log', 'select')
       and not has_table_privilege('anon', 'public.mm_balance_overrides_active', 'select')
       and not has_table_privilege('authenticated', 'public.mm_balance_overrides_active', 'select') as tablas_cerradas,
       not has_function_privilege('anon', 'public.mm_balance_override_set(uuid,integer,text,text,integer)', 'execute')
       and not has_function_privilege('authenticated', 'public.mm_balance_override_set(uuid,integer,text,text,integer)', 'execute')
       and not has_function_privilege('authenticated', 'public.mm_balance_override_clear(uuid,text,text)', 'execute')
       and not has_function_privilege('authenticated', 'public.mm_balance_elos(uuid[],integer[])', 'execute') as funciones_cerradas,
       has_function_privilege('service_role', 'public.mm_balance_override_set(uuid,integer,text,text,integer)', 'execute') as service_role_puede;

\echo '--- 9. mm_tick borra el historial de más de un año'
select position('delete from mm_balance_override_log where at < now() - interval ''1 year''' in pg_get_functiondef('public.mm_tick()'::regprocedure)) > 0
       as mm_tick_borra_al_anio;

\echo '--- 10. Sala real: la misma sala con y sin +300 a la ficha 5'
delete from mm_balance_overrides;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
  select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'prueba96-' || n || '@example.invalid', '', now(), now(), now(), '{}', '{}'
    from t_fichas;
alter table t_fichas add column user_id uuid;
update t_fichas f set user_id = u.id from auth.users u where u.email = 'prueba96-' || f.n || '@example.invalid';
update players p set user_id = f.user_id from t_fichas f where f.player_id = p.id;
update mm_server_state set last_poll_at = now(), unavailable_until = null where server_id = :'server';

create temp table t_salas (modo text, lobby uuid);
create or replace function pg_temp.armar(p_modo text) returns void language plpgsql as $$
declare v uuid;
begin
  insert into mm_queue (user_id, player_id, mode, region, elo, joined_at)
    select user_id, player_id, '5v5', null, elo, now() - make_interval(secs => n) from t_fichas;
  v := mm_try_build('5v5');
  if v is null then raise exception 'prueba 96: no se armó la sala (%)', p_modo; end if;
  insert into t_salas values (p_modo, v);
  perform mm_cancel_lobby(v, 'prueba 96');
  delete from mm_queue where user_id in (select user_id from t_fichas);
end $$;

select pg_temp.armar('sin ajuste');
select mm_balance_override_set((select player_id from t_fichas where n = 5), 300, 'prueba 96 sala', 'Prueba') is not null as puesto_300;
select pg_temp.armar('con +300');

select s.modo, lp.team, sum(lp.elo) elo, sum(lp.balance_elo) armado, string_agg(f.n::text, ',' order by f.n) fichas
  from t_salas s join mm_lobby_players lp on lp.lobby_id = s.lobby join t_fichas f on f.user_id = lp.user_id
 group by 1, 2 order by 1, 2;
select (select lp.balance_elo from t_salas s join mm_lobby_players lp on lp.lobby_id = s.lobby join t_fichas f on f.user_id = lp.user_id
         where s.modo = 'con +300' and f.n = 5)
     - (select lp.balance_elo from t_salas s join mm_lobby_players lp on lp.lobby_id = s.lobby join t_fichas f on f.user_id = lp.user_id
         where s.modo = 'sin ajuste' and f.n = 5) = 300 as sala_guarda_300_mas,
       (select bool_and(lp.elo = f.elo) from t_salas s join mm_lobby_players lp on lp.lobby_id = s.lobby join t_fichas f on f.user_id = lp.user_id)
         as elo_de_la_sala_sin_cambios;
