-- Prueba de la 135 sobre la base local, con rollback. Se corre con probar_135.sh (les saca begin/commit a la 135 y a su inversa).
\set ON_ERROR_STOP on
begin;
create temp table t_md5 as select p.proname, md5(pg_get_functiondef(p.oid)) h from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('mm_best_split_ex', 'mm_my_profile');

\i :r135

-- Un admin con ficha (A, ELO 2000), un jugador común con ficha (B, ELO 100) y 8 cuentas más con ficha (ELO 1000).
-- Juntos: 5100 contra 5000 (diferencia 100). Separados: 1900. Con margen 100, el bloqueo normal no se respeta.
create temp table t_u as
  select (select pr.id from profiles pr join players p on p.user_id = pr.id where pr.role = 'admin' limit 1) adm,
         (select pr.id from profiles pr join players p on p.user_id = pr.id where pr.role <> 'admin' limit 1) usr;
do $$ begin if (select adm is null or usr is null from t_u) then raise exception 'faltan un admin y un jugador con ficha'; end if; end $$;
create temp table t_sala as
  select array[(select adm from t_u), (select usr from t_u)] || array(
           select distinct p.user_id from players p where p.user_id is not null
              and p.user_id not in ((select adm from t_u), (select usr from t_u)) limit 8) users,
         array[2000, 100, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000] elos;
do $$ begin if cardinality((select users from t_sala)) <> 10 then raise exception 'faltan 10 cuentas con ficha'; end if; end $$;
grant select on t_u, t_sala to authenticated;
update mm_config set block_margin = 100;
delete from mm_blocks where user_id in ((select adm from t_u), (select usr from t_u));

create function pg_temp.como(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $$;
create function pg_temp.reparto(grupos uuid[]) returns jsonb language sql as $$
  select mm_best_split_ex(users, elos, grupos, 5) from t_sala $$;
create function pg_temp.sin_grupo() returns uuid[] language sql as $$
  select array(select gen_random_uuid() from generate_series(1, 10)) $$;
create function pg_temp.falla(sql text, msg text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'debió fallar con "%"', msg;
exception when others then
  if position(msg in sqlerrm) = 0 then raise; end if;
end $$;

-- 1. El admin bloquea a B (normal): no se respeta, juntos con diferencia 100.
select pg_temp.como((select adm from t_u));
select mm_block((select id from players where user_id = (select usr from t_u) limit 1));
do $$
declare r jsonb := pg_temp.reparto(pg_temp.sin_grupo());
begin
  if r -> 'sides' -> 0 <> r -> 'sides' -> 1 or (r ->> 'diff')::int <> 100 or jsonb_array_length(r -> 'ignored') <> 1 then
    raise exception '1: el bloqueo normal debió ignorarse: %', r;
  end if;
  raise notice '1 ok: bloqueo normal ignorado (diferencia 100)';
end $$;

-- 2. Lo marca como super bloqueo: separados aunque la diferencia sea 1900.
select mm_block_super((select id from players where user_id = (select usr from t_u) limit 1), true);
do $$
declare r jsonb := pg_temp.reparto(pg_temp.sin_grupo());
begin
  if r -> 'sides' -> 0 = r -> 'sides' -> 1 or (r ->> 'diff')::int <> 1900 or jsonb_array_length(r -> 'ignored') <> 0 then
    raise exception '2: el super bloqueo debió respetarse: %', r;
  end if;
  if not (mm_my_profile() -> 'blocks' -> 'list' -> 0 ->> 'super')::bool then raise exception '2: el perfil no trae super'; end if;
  raise notice '2 ok: super bloqueo respetado (diferencia 1900) y en el perfil';
end $$;

-- 3. A y B en el mismo grupo: imposible respetarlo; la sala se arma igual y se avisa.
do $$
declare g uuid[] := pg_temp.sin_grupo(); r jsonb;
begin
  g[2] := g[1];
  r := pg_temp.reparto(g);
  if r is null or r -> 'sides' -> 0 <> r -> 'sides' -> 1 or jsonb_array_length(r -> 'ignored') <> 1 then
    raise exception '3: con el grupo debió romperse: %', r;
  end if;
  raise notice '3 ok: con A y B en el mismo grupo se arma igual y se avisa';
end $$;

-- 4. Si quien bloqueó deja de ser admin, cuenta como normal.
update profiles set role = 'user' where id = (select adm from t_u);
do $$
declare r jsonb := pg_temp.reparto(pg_temp.sin_grupo());
begin
  if r -> 'sides' -> 0 <> r -> 'sides' -> 1 then raise exception '4: sin rol admin debió ser normal: %', r; end if;
  raise notice '4 ok: sin rol admin el super bloqueo cuenta como normal';
end $$;
-- Y ya no lo puede marcar.
select pg_temp.falla(format('select mm_block_super(%L, false)', (select id from players where user_id = (select usr from t_u) limit 1)), 'solo para admins');
update profiles set role = 'admin' where id = (select adm from t_u);
do $$ begin raise notice '4b ok: un no admin no puede marcar'; end $$;

-- 5. Un bloqueo que no existe no se marca; desmarcar vuelve al normal.
select pg_temp.falla(format('select mm_block_super(%L, true)', (select id from players where user_id = (select users[3] from t_sala) limit 1)), 'Primero bloque');
select mm_block_super((select id from players where user_id = (select usr from t_u) limit 1), false);
do $$
declare r jsonb := pg_temp.reparto(pg_temp.sin_grupo());
begin
  if r -> 'sides' -> 0 <> r -> 'sides' -> 1 then raise exception '5: desmarcado debió ser normal: %', r; end if;
  raise notice '5 ok: sin bloqueo no se marca; desmarcado vuelve a normal';
end $$;

-- 6. La inversa deja las funciones como estaban.
reset role;
\i :rev135
do $$
begin
  if exists (select 1 from t_md5 t join pg_proc p on p.proname = t.proname join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
              where md5(pg_get_functiondef(p.oid)) <> t.h) then
    raise exception '6: la inversa no deja las funciones iguales';
  end if;
  if exists (select 1 from information_schema.columns where table_name = 'mm_blocks' and column_name = 'super') then
    raise exception '6: quedó la columna super';
  end if;
  raise notice '6 ok: la inversa deja todo como estaba';
end $$;

rollback;
