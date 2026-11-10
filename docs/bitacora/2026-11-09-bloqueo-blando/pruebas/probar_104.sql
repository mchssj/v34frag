-- Prueba de la 104 sobre la base local, con rollback. Se corre con probar_104.sh (les saca begin/commit a la 104 y a su inversa).
\set ON_ERROR_STOP on
begin;
create temp table t_md5 as select p.proname, md5(pg_get_functiondef(p.oid)) h from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('mm_best_split', 'mm_try_build', 'mm_block', 'mm_unblock', 'mm_my_profile', 'mm_tick',
                                               'mm_set_config', 'manual_valores', 'notification_category');

\i :r104

-- Diez fichas con cuenta de la base local, con los nombres y el ELO de armado de la sala del mirage (cb04b97c).
create temp table t_u as
select x.nick, x.elo, p.user_id u, p.id pid
  from (select row_number() over (order by p.id) rn, p.user_id, p.id from players p where p.user_id is not null limit 10) p
  join (values (1, 'shevchenko', 872), (2, 'LESCO', 954), (3, 'slave', 980), (4, 'kobassj', 818), (5, 'Nmz1-', 1025),
               (6, 'romanxz', 1099), (7, 'tam', 822), (8, 'nokushima', 902), (9, 'kyan', 1123), (10, 'daniloev', 893)) x(rn, nick, elo)
    on x.rn = p.rn;
do $$ begin if (select count(*) from t_u) <> 10 then raise exception 'faltan 10 fichas con cuenta en la base local'; end if; end $$;
create function pg_temp.u(n text) returns uuid language sql as $$ select u from t_u where nick = n $$;
create function pg_temp.pid(n text) returns uuid language sql as $$ select pid from t_u where nick = n $$;
delete from mm_blocks where user_id in (select u from t_u);

-- 1. La sala del mirage: dúo kyan + romanxz; daniloev y kyan bloquean a kobassj, romanxz a shevchenko.
insert into mm_blocks (user_id, player_id, created_at) values
  (pg_temp.u('daniloev'), pg_temp.pid('kobassj'), now() - interval '3 days'),
  (pg_temp.u('kyan'), pg_temp.pid('kobassj'), now() - interval '2 days'),
  (pg_temp.u('romanxz'), pg_temp.pid('shevchenko'), now() - interval '1 day');
do $$
declare
  nombres text[] := array['shevchenko', 'LESCO', 'slave', 'kobassj', 'Nmz1-', 'romanxz', 'tam', 'nokushima', 'kyan', 'daniloev'];
  duo uuid := gen_random_uuid();
  r jsonb;
  eq1 text[];
begin
  r := mm_best_split_ex(array(select pg_temp.u(x) from unnest(nombres) x),
                        array(select (select elo from t_u where nick = x) from unnest(nombres) x),
                        array(select case when x in ('kyan', 'romanxz') then duo end from unnest(nombres) x), 5);
  select array_agg(nombres[o] order by nombres[o] collate "C") into eq1
    from jsonb_array_elements_text(r -> 'sides') with ordinality s(v, o) where s.v = '1';
  if (r ->> 'diff_free')::int <> 20 or (r ->> 'diff')::int <> 40 then raise exception 'P1: diferencias %', r; end if;
  if r -> 'ignored' <> jsonb_build_array(jsonb_build_array(pg_temp.u('kyan'), pg_temp.u('kobassj'))) then
    raise exception 'P1: ignoró otros bloqueos: %', r -> 'ignored';
  end if;
  if eq1 <> array['LESCO', 'Nmz1-', 'daniloev', 'shevchenko', 'slave'] then raise exception 'P1: reparto %', eq1; end if;
  -- Con el margen en 2000 (todo entra): respeta los tres, como antes, y queda el reparto que se jugó (190).
  update mm_config set block_margin = 2000 where id = 1;
  r := mm_best_split_ex(array(select pg_temp.u(x) from unnest(nombres) x),
                        array(select (select elo from t_u where nick = x) from unnest(nombres) x),
                        array(select case when x in ('kyan', 'romanxz') then duo end from unnest(nombres) x), 5);
  if (r ->> 'diff')::int <> 190 or jsonb_array_length(r -> 'ignored') <> 0 then raise exception 'P1b: %', r; end if;
  update mm_config set block_margin = 100 where id = 1;
  raise notice 'P1 ok: el mirage ignora solo kyan → kobassj (190 → 40); con margen 2000 respeta los tres (190)';
end $$;

-- 2. Un bloqueo barato se respeta (como antes).
delete from mm_blocks where user_id in (select u from t_u);
insert into mm_blocks (user_id, player_id) values (pg_temp.u('LESCO'), pg_temp.pid('slave'));
do $$
declare
  nombres text[] := array['shevchenko', 'LESCO', 'slave', 'kobassj', 'Nmz1-', 'romanxz', 'tam', 'nokushima', 'kyan', 'daniloev'];
  r jsonb;
begin
  r := mm_best_split_ex(array(select pg_temp.u(x) from unnest(nombres) x),
                        array(select (select elo from t_u where nick = x) from unnest(nombres) x),
                        array(select null::uuid from unnest(nombres) x), 5);
  if jsonb_array_length(r -> 'ignored') <> 0 or (r -> 'sides' ->> 1) = (r -> 'sides' ->> 2) then raise exception 'P2: %', r; end if;
  if (r ->> 'diff')::int > (r ->> 'diff_free')::int + 100 then raise exception 'P2: fuera del margen %', r; end if;
  raise notice 'P2 ok: el bloqueo barato se respeta (diferencia % contra % sin bloqueos)', r ->> 'diff', r ->> 'diff_free';
end $$;

-- 3. Si hay que romper uno de dos, se rompe el más reciente. a=1000, b=1000, c=1500, d=1500 (2 contra 2):
--    {a,b} queda afuera del margen (1000); {a,c} y {a,d} empatan en 0. a bloquea a c (viejo) y a d (nuevo).
delete from mm_blocks where user_id in (select u from t_u);
update mm_config set max_blocks = 5 where id = 1;
insert into mm_blocks (user_id, player_id, created_at) values
  (pg_temp.u('shevchenko'), pg_temp.pid('slave'), now() - interval '5 days'),
  (pg_temp.u('shevchenko'), pg_temp.pid('kobassj'), now() - interval '1 day');
do $$
declare r jsonb;
begin
  r := mm_best_split_ex(array[pg_temp.u('shevchenko'), pg_temp.u('LESCO'), pg_temp.u('slave'), pg_temp.u('kobassj')],
                        array[1000, 1000, 1500, 1500], array[null, null, null, null]::uuid[], 2);
  if r -> 'ignored' <> jsonb_build_array(jsonb_build_array(pg_temp.u('shevchenko'), pg_temp.u('kobassj'))) then
    raise exception 'P3: no rompió el más reciente: %', r;
  end if;
  raise notice 'P3 ok: con dos opciones, rompe el bloqueo más reciente';
end $$;

-- 4. Un grupo nunca se separa, aunque haya que romper el bloqueo.
delete from mm_blocks where user_id in (select u from t_u);
insert into mm_blocks (user_id, player_id) values (pg_temp.u('shevchenko'), pg_temp.pid('slave'));
do $$
declare r jsonb; g uuid := gen_random_uuid();
begin
  r := mm_best_split_ex(array[pg_temp.u('shevchenko'), pg_temp.u('LESCO'), pg_temp.u('slave'), pg_temp.u('kobassj')],
                        array[1000, 1000, 1000, 1000], array[g, null, g, null]::uuid[], 2);
  if (r -> 'sides' ->> 0) <> (r -> 'sides' ->> 2) or jsonb_array_length(r -> 'ignored') <> 1 then raise exception 'P4: %', r; end if;
  if mm_best_split(array[pg_temp.u('shevchenko'), pg_temp.u('LESCO'), pg_temp.u('slave'), pg_temp.u('kobassj')],
                   array[1000, 1000, 1000, 1000], array[g, null, g, null]::uuid[], 2) <> array[1, 2, 1, 2]::smallint[] then
    raise exception 'P4: mm_best_split no devuelve los mismos lados';
  end if;
  raise notice 'P4 ok: el grupo no se separa (rompe el bloqueo) y mm_best_split devuelve los mismos lados';
end $$;

-- 5. mm_try_build compila con el registro y el aviso; notification_category conoce el tipo nuevo.
do $$ begin
  if position('mm_lobby_block_ignored' in pg_get_functiondef('public.mm_try_build'::regproc)) = 0 then raise exception 'P5: mm_try_build sin el registro'; end if;
  if notification_category('mm_block_ignored') <> 'elo' then raise exception 'P5: categoría'; end if;
  if position('mm_block_log' in pg_get_functiondef('public.mm_tick'::regproc)) = 0 then raise exception 'P5: mm_tick sin la limpieza'; end if;
  if (manual_valores() ->> 'mm.bloqueo_cambios')::int <> 5 or (manual_valores() ->> 'mm.bloqueo_margen')::int <> 100 then raise exception 'P5: manual_valores'; end if;
  raise notice 'P5 ok: mm_try_build, mm_tick, notification_category y manual_valores';
end $$;

-- 6. Límite de 5 bloqueos nuevos en 7 días (como la cuenta de shevchenko, con el bloqueo para todos y de a uno).
delete from mm_blocks where user_id in (select u from t_u);
update mm_config set blocks_vip_only = false, max_blocks = 1, block_changes_week = 5 where id = 1;
delete from mm_block_log where user_id = pg_temp.u('shevchenko');
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.u('shevchenko'), 'role', 'authenticated')::text, true);
do $$
declare
  objetivos text[] := array['LESCO', 'slave', 'kobassj', 'Nmz1-', 'romanxz', 'tam'];
  i int;
  v jsonb;
begin
  for i in 1..5 loop
    perform mm_block(pg_temp.pid(objetivos[i]));
    perform mm_block(pg_temp.pid(objetivos[i]));   -- repetir el mismo no gasta un cambio
    perform mm_unblock(pg_temp.pid(objetivos[i]));
  end loop;
  v := mm_block_changes(pg_temp.u('shevchenko'));
  if (v ->> 'changes_left')::int <> 0 or v ->> 'next_change_at' is null then raise exception 'P6: %', v; end if;
  begin
    perform mm_block(pg_temp.pid('tam'));
    raise exception 'P6: dejó el 6.º bloqueo';
  exception when sqlstate 'V8904' then null;
  end;
  if (mm_my_profile() -> 'blocks' -> 'changes' ->> 'changes_left')::int <> 0 then raise exception 'P6: mm_my_profile'; end if;
  -- Pasados 7 días del más viejo, se libera uno.
  update mm_block_log set at = at - interval '8 days'
   where id = (select min(id) from mm_block_log where user_id = pg_temp.u('shevchenko') and action = 'block');
  perform mm_block(pg_temp.pid('tam'));
  if (select count(*) from mm_block_log where user_id = pg_temp.u('shevchenko')) <> 11 then raise exception 'P6: log'; end if;
  raise notice 'P6 ok: 5 bloqueos en 7 días, el 6.º falla (V8904) y se libera a los 7 días; el log tiene bloqueos y desbloqueos';
end $$;
select set_config('request.jwt.claims', '', true);

-- 7. La inversa deja las funciones como estaban.
\i :rev104
do $$ declare n int; begin
  select count(*) into n from t_md5 t join pg_proc p on p.proname = t.proname join pg_namespace s on s.oid = p.pronamespace and s.nspname = 'public'
   where md5(pg_get_functiondef(p.oid)) <> t.h;
  if n > 0 then raise exception 'P7: % funciones no quedaron como antes', n; end if;
  if to_regclass('public.mm_block_log') is not null or to_regprocedure('public.mm_best_split_ex(uuid[], integer[], uuid[], integer)') is not null then
    raise exception 'P7: quedaron restos';
  end if;
  raise notice 'P7 ok: la inversa deja las 9 funciones idénticas y saca lo nuevo';
end $$;
rollback;
