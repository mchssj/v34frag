-- Prueba de la 115 en una transacción que se deshace (base local o producción).
-- Uso: probar_115.sh (le pasa las rutas de la 115 y de su inversa). Usa al jugador con la sala terminada más reciente.
\set ON_ERROR_STOP 1
begin;

-- Antes de la 115: lo que devolvía last_lobby, para compararlo.
create temp table t115 as
  select lp.user_id as uid from mm_lobby_players lp join mm_lobbies l on l.id = lp.lobby_id
   where l.status = 'finished' order by l.ended_at desc limit 1;
grant select on t115 to authenticated;
do $$ begin
  if not exists (select 1 from t115) then raise exception 'sin salas terminadas: no hay con qué probar'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', (select uid from t115), 'role', 'authenticated')::text, false);
end $$;
create temp table t115_antes as select mm_my_live() -> 'last_lobby' as sala;
grant select on t115_antes to authenticated;

\i :r115

set local role authenticated;

-- 1. mm_my_live ya no arma la sala: trae la referencia, y mm_my_last_lobby la misma sala que antes.
do $$
declare v jsonb := mm_my_live(); s jsonb := mm_my_last_lobby();
begin
  if v ? 'last_lobby' then raise exception 'falla 1: mm_my_live sigue trayendo last_lobby'; end if;
  if v -> 'last_lobby_ref' ->> 'id' is distinct from s ->> 'id' then raise exception 'falla 1: la referencia no es la última sala'; end if;
  if length(v -> 'last_lobby_ref' ->> 'rev') <> 32 then raise exception 'falla 1: rev no es un md5'; end if;
  if s is distinct from (select sala from t115_antes) then raise exception 'falla 1: mm_my_last_lobby no es igual a la last_lobby de antes'; end if;
  raise notice 'ok 1: last_lobby_ref y la misma sala que antes';
end $$;

-- 2. rev cambia al recomendar a alguien de la sala (lo hace la API con service_role), y la sala lo muestra.
create temp table t115_rev (rev text, lobby uuid, player uuid);
grant all on t115_rev to authenticated;
reset role;
delete from mm_commends where (lobby_id, user_id) in (select l.id, t.uid from t115 t join mm_lobby_players lp on lp.user_id = t.uid join mm_lobbies l on l.id = lp.lobby_id);
set local role authenticated;
insert into t115_rev select mm_my_live() -> 'last_lobby_ref' ->> 'rev', (mm_my_live() -> 'last_lobby_ref' ->> 'id')::uuid, null;
reset role;
update t115_rev set player = (select lp.player_id from mm_lobby_players lp where lp.lobby_id = t115_rev.lobby and lp.user_id <> (select uid from t115) limit 1);
insert into mm_commends (lobby_id, user_id, player_id) select lobby, (select uid from t115), player from t115_rev;
set local role authenticated;
do $$ begin
  if (mm_my_live() -> 'last_lobby_ref' ->> 'rev') = (select rev from t115_rev) then raise exception 'falla 2: rev no cambió al recomendar'; end if;
  if (mm_my_last_lobby() ->> 'commended')::uuid is distinct from (select player from t115_rev) then raise exception 'falla 2: la sala no muestra la recomendación'; end if;
  raise notice 'ok 2: rev cambia con la recomendación';
end $$;

-- 3. rev no cambia si no pasa nada.
do $$ begin
  if (mm_my_live() -> 'last_lobby_ref' ->> 'rev') <> (mm_my_live() -> 'last_lobby_ref' ->> 'rev') then raise exception 'falla 3: rev cambia solo'; end if;
  raise notice 'ok 3: rev estable';
end $$;

-- 4. mm_my_state (p_full) sigue igual: trae lobby y la referencia.
do $$ begin
  if not (mm_my_state() ? 'last_lobby_ref') then raise exception 'falla 4: mm_my_state sin last_lobby_ref'; end if;
  raise notice 'ok 4: mm_my_state con last_lobby_ref';
end $$;

-- 5. Sin sesión no se pide.
reset role;
set local role anon;
do $$ begin
  perform mm_my_last_lobby();
  raise exception 'falla 5: anon llamó a mm_my_last_lobby';
exception when insufficient_privilege then raise notice 'ok 5: anon no puede';
end $$;
do $$ begin
  perform mm_lobby_rev(null, null);
  raise exception 'falla 5: anon llamó a mm_lobby_rev';
exception when insufficient_privilege then raise notice 'ok 5: mm_lobby_rev cerrada';
end $$;
reset role;
delete from mm_commends where (lobby_id, user_id) in (select lobby, (select uid from t115) from t115_rev);

-- 6. La inversa vuelve a la de antes.
\i :rev115
set local role authenticated;
do $$ begin
  if (mm_my_live() -> 'last_lobby') is distinct from (select sala from t115_antes) then raise exception 'falla 6: la inversa no devuelve la last_lobby de antes'; end if;
  raise notice 'ok 6: inversa';
end $$;

rollback;
