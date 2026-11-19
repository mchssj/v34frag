-- Prueba de la 128 sobre la base local, con rollback. Se corre con probar_128.sh (les saca begin/commit a la 128 y a su inversa).
\set ON_ERROR_STOP on
begin;
create temp table t_md5 as select p.proname, md5(pg_get_functiondef(p.oid)) h from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('mm_block', 'mm_my_profile');

\i :r128

-- Un admin y un jugador común (ninguno VIP) con ficha, y 8 fichas para bloquear.
create temp table t_u as
  select (select pr.id from profiles pr join players p on p.user_id = pr.id where pr.role = 'admin' and not is_vip(pr.id) limit 1) adm,
         (select pr.id from profiles pr join players p on p.user_id = pr.id where pr.role <> 'admin' and not is_vip(pr.id) limit 1) usr;
do $$ begin if (select adm is null or usr is null from t_u) then raise exception 'faltan un admin y un jugador sin VIP con ficha'; end if; end $$;
create temp table t_p as select p.id, row_number() over (order by p.id) rn from players p
  where p.user_id is distinct from (select adm from t_u) and p.user_id is distinct from (select usr from t_u) limit 8;
grant select on t_u, t_p to authenticated;
delete from mm_blocks where user_id in ((select adm from t_u), (select usr from t_u));
delete from mm_block_log where user_id in ((select adm from t_u), (select usr from t_u));
update mm_config set blocks_vip_only = true, max_blocks = 1, block_changes_week = 5;

create function pg_temp.como(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $$;
create function pg_temp.falla(p uuid, msg text) returns void language plpgsql as $$
begin
  perform mm_block(p);
  raise exception 'debió fallar con "%"', msg;
exception when others then
  if position(msg in sqlerrm) = 0 then raise; end if;
end $$;

-- 1. Admin sin VIP, max_blocks 1, 5 por semana: bloquea a los 8.
select pg_temp.como((select adm from t_u));
select mm_block(id) from t_p;
do $$
declare b jsonb := mm_my_profile() -> 'blocks';
begin
  if (select count(*) from mm_blocks where user_id = (select adm from t_u)) <> 8 then raise exception '1: el admin no bloqueó a los 8'; end if;
  if b -> 'max' <> 'null' or (b ->> 'vip_only')::bool or not (b ->> 'allowed')::bool or b -> 'changes' <> 'null' then
    raise exception '1: perfil del admin mal: %', b - 'list';
  end if;
  raise notice '1 ok: el admin bloqueó a 8 (perfil %)', b - 'list';
end $$;
-- Con max_blocks 0 (apagado) también.
update mm_config set max_blocks = 0;
delete from mm_blocks where user_id = (select adm from t_u) and player_id = (select id from t_p where rn = 1);
select mm_block((select id from t_p where rn = 1));
do $$ begin raise notice '1b ok: con max_blocks 0 el admin bloquea igual'; end $$;
-- No a sí mismo.
select pg_temp.falla((select id from players where user_id = (select adm from t_u) limit 1), 'vos mismo');
do $$ begin raise notice '1c ok: el admin no se bloquea a sí mismo'; end $$;
update mm_config set max_blocks = 1;

-- 2. Jugador común sin VIP: exclusivo VIP.
select pg_temp.como((select usr from t_u));
select pg_temp.falla((select id from t_p where rn = 1), 'exclusivo para VIP');
do $$
declare b jsonb := mm_my_profile() -> 'blocks';
begin
  if (b ->> 'max')::int <> 1 or not (b ->> 'vip_only')::bool or (b ->> 'allowed')::bool or b -> 'changes' = 'null' then
    raise exception '2: perfil del jugador mal: %', b - 'list';
  end if;
  raise notice '2 ok: jugador sin VIP rechazado (perfil %)', b - 'list';
end $$;

-- 3. Sin VIP obligatorio: máximo de 1 y después 5 por semana.
update mm_config set blocks_vip_only = false;
select mm_block((select id from t_p where rn = 1));
select pg_temp.falla((select id from t_p where rn = 2), 'todos tus bloqueos');
update mm_config set max_blocks = 10;
select mm_unblock(id), mm_block(id) from t_p where rn between 2 and 5;
select pg_temp.falla((select id from t_p where rn = 6), 'últimos 7 días');
do $$ begin raise notice '3 ok: el jugador sigue con el máximo y con 5 por semana'; end $$;
select set_config('request.jwt.claims', '', true);

-- 4. La inversa deja las dos funciones como estaban.
\i :rev128
do $$
begin
  if exists (select 1 from t_md5 t join pg_proc p on p.proname = t.proname join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and md5(pg_get_functiondef(p.oid)) <> t.h) then
    raise exception '4: la inversa no deja las funciones como estaban';
  end if;
  raise notice '4 ok: la inversa deja mm_block y mm_my_profile como antes';
end $$;
rollback;
