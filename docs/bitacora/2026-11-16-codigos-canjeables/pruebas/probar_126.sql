-- Prueba de la 126 en una transacción que se deshace (base local o una copia de producción).
-- Uso: probar_126.sh (le pasa las rutas de la 126 y de su inversa).
\set ON_ERROR_STOP 1
begin;

-- Si la base ya tiene la 126, se revierte primero: todo se deshace al final.
select to_regclass('public.redeem_codes') is not null as ya_126 \gset
\if :ya_126
\i :rev126
\endif

-- Huella de la estructura antes, para comparar después de la inversa.
create function pg_temp.estructura() returns table (k text, h text) language sql as $$
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', md5(pg_get_functiondef(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'
  union all
  select table_name || '.' || column_name, data_type || coalesce(column_default, '') || is_nullable
    from information_schema.columns where table_schema = 'public'
  union all
  select conrelid::regclass::text || ':' || conname, pg_get_constraintdef(oid)
    from pg_constraint where connamespace = 'public'::regnamespace
  union all
  select 'policy ' || polrelid::regclass::text || ':' || polname, coalesce(pg_get_expr(polqual, polrelid), '')
    from pg_policy p join pg_class c on c.oid = p.polrelid where c.relnamespace = 'public'::regnamespace
  union all
  select 'grant ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', coalesce(p.proacl::text, '')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f' $$;
create temp table huella as select * from pg_temp.estructura();

\i :r126

-- Cuentas: A, C, E y G ('10') con ficha; B sin ficha; F con ficha y baneada; D admin.
insert into auth.users (id, email, raw_user_meta_data) values
  ('22222222-2222-4222-8222-0000000126a0', 'p126a@example.com', '{"tag":"p126a"}'),
  ('22222222-2222-4222-8222-0000000126b0', 'p126b@example.com', '{"tag":"p126b"}'),
  ('22222222-2222-4222-8222-0000000126c0', 'p126c@example.com', '{"tag":"p126c"}'),
  ('22222222-2222-4222-8222-0000000126d0', 'p126d@example.com', '{"tag":"p126d"}'),
  ('22222222-2222-4222-8222-0000000126e0', 'p126e@example.com', '{"tag":"p126e"}'),
  ('22222222-2222-4222-8222-0000000126f0', 'p126f@example.com', '{"tag":"p126f"}'),
  ('22222222-2222-4222-8222-000000012610', 'p126g@example.com', '{"tag":"p126g"}');
update profiles set role = 'admin' where id = '22222222-2222-4222-8222-0000000126d0';
insert into players (id, nick, steam_id, user_id) values
  ('11111111-1111-4111-8111-0000000126a0', 'p126a', '76561190000012601', '22222222-2222-4222-8222-0000000126a0'),
  ('11111111-1111-4111-8111-0000000126c0', 'p126c', '76561190000012603', '22222222-2222-4222-8222-0000000126c0'),
  ('11111111-1111-4111-8111-0000000126e0', 'p126e', '76561190000012605', '22222222-2222-4222-8222-0000000126e0'),
  ('11111111-1111-4111-8111-0000000126f0', 'p126f', '76561190000012606', '22222222-2222-4222-8222-0000000126f0'),
  ('11111111-1111-4111-8111-000000012610', 'p126g', '76561190000012607', '22222222-2222-4222-8222-000000012610');
insert into bans (player_id, steam_id, reason, source)
values ('11111111-1111-4111-8111-0000000126f0', '76561190000012606', 'prueba 126', 'web');
insert into vip_memberships (user_id, starts_at, ends_at, source)
values ('22222222-2222-4222-8222-0000000126e0', now() - interval '1 day', null, 'manual');

-- Tres marcos a la venta con puntos para las pruebas (se deshace con el rollback).
create temp table it as
  select id, row_number() over (order by id) n from shop_items
   where kind = 'frame' and not vip_only and not vip_reward order by id limit 3;
update shop_items set price = 100, active = true where id in (select id from it);

create function pg_temp.como(p text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-4222-8222-0000000126' || p, 'role', 'authenticated')::text, true) $$;
create function pg_temp.u(p text) returns uuid language sql as $$ select ('22222222-2222-4222-8222-0000000126' || p)::uuid $$;
create function pg_temp.item(n int) returns text language sql as $$ select id from it where it.n = $1 $$;
-- Crea un código como D y devuelve su texto.
create function pg_temp.nuevo(p_reward text, p_item text default null, p_amount int default null, p_days int default null,
                              p_max_uses int default 1, p_for_user uuid default null, p_custom text default null) returns text
  language plpgsql as $$
begin
  perform pg_temp.como('d0');
  return admin_code_create(p_reward, p_item, p_amount, p_days, p_max_uses, 1, null, null, p_for_user, p_custom, 'Sorteo prueba') -> 'codes' -> 0 ->> 'code';
end $$;
create function pg_temp.canje(p text, p_code text) returns jsonb language plpgsql as $$
begin perform pg_temp.como(p); return code_redeem(p_code, '10.0.0.1'); end $$;
create function pg_temp.err(r jsonb, e text, m text) returns void language plpgsql as $$
begin
  if coalesce(r ->> 'error', 'ok') <> e then raise exception 'falla %: esperaba %, vino %', m, e, r; end if;
end $$;

-- 1. Permisos
do $$ begin
  if has_table_privilege('authenticated', 'redeem_codes', 'select') or has_table_privilege('anon', 'code_redemptions', 'select')
     or has_table_privilege('authenticated', 'redeem_attempts', 'insert') then raise exception 'falla 1a: tablas con permisos'; end if;
  if has_function_privilege('anon', 'code_redeem(text, inet)', 'execute') then raise exception 'falla 1b: anon canjea'; end if;
  if not has_function_privilege('authenticated', 'code_redeem(text, inet)', 'execute') then raise exception 'falla 1c'; end if;
  if has_function_privilege('authenticated', 'code_normalize(text)', 'execute')
     or has_function_privilege('authenticated', 'redeem_blocked_until(uuid)', 'execute') then raise exception 'falla 1d: internas'; end if;
  if has_function_privilege('anon', 'admin_code_create(text, text, int, int, int, int, timestamptz, timestamptz, uuid, text, text, text)', 'execute')
     then raise exception 'falla 1e'; end if;
  begin
    perform pg_temp.como('a0');
    perform admin_code_create('points', null, 10);
    raise exception 'falla 1f: un jugador creó un código';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok 1: permisos';
end $$;

-- 2. Formato y normalización
do $$ declare c text; begin
  c := pg_temp.nuevo('points', null, 10);
  if c !~ '^CML-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$' then raise exception 'falla 2a: %', c; end if;
  if code_normalize(' cml-ab12 ol-I0 ') <> 'CM1AB120110' then raise exception 'falla 2b: %', code_normalize(' cml-ab12 ol-I0 '); end if;
  if (select code from redeem_codes where display = c) <> code_normalize(c) then raise exception 'falla 2c'; end if;
  raise notice 'ok 2: formato CML-XXXX-XXXX-XXXX y normalización';
end $$;

-- 3. Artículo para siempre, con 2 usos
do $$ declare c text; r jsonb; begin
  c := pg_temp.nuevo('item', pg_temp.item(1), null, null, 2);
  r := pg_temp.canje('a0', lower(replace(c, '-', ' ')));
  if not (r ->> 'ok')::boolean or r -> 'item' ->> 'id' <> pg_temp.item(1) or r ->> 'until' is not null then raise exception 'falla 3a: %', r; end if;
  if (select source || coalesce(expires_at::text, '-') from user_items where user_id = pg_temp.u('a0') and item_id = pg_temp.item(1)) <> 'code-' then
    raise exception 'falla 3b';
  end if;
  if not can_use_item(pg_temp.u('a0'), pg_temp.item(1)) then raise exception 'falla 3c'; end if;
  if not exists (select 1 from notifications where user_id = pg_temp.u('a0') and type = 'code_redeemed') then raise exception 'falla 3d: sin aviso'; end if;
  perform pg_temp.err(pg_temp.canje('a0', c), 'code_already_redeemed', '3e');
  perform pg_temp.err(pg_temp.canje('b0', c), 'code_no_player', '3f');
  perform pg_temp.err(pg_temp.canje('f0', c), 'code_banned', '3g');
  r := pg_temp.canje('c0', c);
  if not (r ->> 'ok')::boolean then raise exception 'falla 3h: %', r; end if;
  perform pg_temp.err(pg_temp.canje('e0', c), 'code_used_up', '3i');
  -- agotado: a quien ya lo canjeó le dice eso, no que se agotó
  perform pg_temp.err(pg_temp.canje('a0', c), 'code_already_redeemed', '3i2');
  if (select uses from redeem_codes where display = c) <> 2 then raise exception 'falla 3j'; end if;
  -- ya lo tiene para siempre: no se gasta
  c := pg_temp.nuevo('item', pg_temp.item(1));
  perform pg_temp.err(pg_temp.canje('a0', c), 'code_already_owned', '3k');
  if (select uses from redeem_codes where display = c) <> 0 then raise exception 'falla 3l'; end if;
  raise notice 'ok 3: artículo para siempre, usos, una vez por cuenta, sin ficha, baneado, agotado y ya lo tiene';
end $$;

-- 4. Artículo temporal: se suman los días, vence, se compra y se regala
do $$ declare c text; r jsonb; v timestamptz; begin
  r := pg_temp.canje('a0', pg_temp.nuevo('item', pg_temp.item(2), null, 7));
  v := (r ->> 'until')::timestamptz;
  if v not between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days' then raise exception 'falla 4a: %', r; end if;
  r := pg_temp.canje('a0', pg_temp.nuevo('item', pg_temp.item(2), null, 30));
  if (r ->> 'until')::timestamptz <> v + interval '30 days' then raise exception 'falla 4b: %', r; end if;
  perform pg_temp.como('a0');
  if (select expires_at from user_items_of() where item_id = pg_temp.item(2)) <> v + interval '30 days' then raise exception 'falla 4c'; end if;
  -- se lo pone, vence: no se puede usar y desaparece de lo puesto
  perform set_my_cosmetics(jsonb_build_object('frame', pg_temp.item(2)));
  update user_items set expires_at = now() - interval '1 minute' where user_id = pg_temp.u('a0') and item_id = pg_temp.item(2);
  if can_use_item(pg_temp.u('a0'), pg_temp.item(2)) then raise exception 'falla 4d: se usa vencido'; end if;
  if (select frame from player_cosmetics_public where user_id = pg_temp.u('a0')) is not null then raise exception 'falla 4e: sigue puesto'; end if;
  if (select usable from user_items_of() where item_id = pg_temp.item(2)) then raise exception 'falla 4f'; end if;
  -- vencido: un código por días cuenta desde ahora
  r := pg_temp.canje('a0', pg_temp.nuevo('item', pg_temp.item(2), null, 1));
  if (r ->> 'until')::timestamptz > now() + interval '1 day' then raise exception 'falla 4g: %', r; end if;
  -- comprarlo lo vuelve permanente y cuenta como gastado
  perform pg_temp.como('d0');
  perform admin_points_grant(pg_temp.u('a0'), 1000, 'prueba 126');
  perform pg_temp.como('a0');
  r := shop_buy(pg_temp.item(2));
  if (select source || coalesce(expires_at::text, '-') || price_paid from user_items where user_id = pg_temp.u('a0') and item_id = pg_temp.item(2))
     <> 'purchase-100' then raise exception 'falla 4h'; end if;
  begin perform shop_buy(pg_temp.item(2)); raise exception 'falla 4i: compró dos veces';
  exception when raise_exception then if sqlerrm not like 'Ya lo tienes%' then raise; end if; end;
  -- regalado por un admin sobre lo temporal: permanente
  perform pg_temp.canje('c0', pg_temp.nuevo('item', pg_temp.item(3), null, 7));
  perform pg_temp.como('d0');
  perform admin_item_grant(pg_temp.u('c0'), pg_temp.item(3), 'prueba');
  if (select source || coalesce(expires_at::text, '-') from user_items where user_id = pg_temp.u('c0') and item_id = pg_temp.item(3)) <> 'grant-' then
    raise exception 'falla 4j';
  end if;
  begin perform admin_item_grant(pg_temp.u('c0'), pg_temp.item(3)); raise exception 'falla 4k';
  exception when raise_exception then if sqlerrm <> 'Ya lo tiene' then raise; end if; end;
  -- un código para siempre sobre uno temporal lo vuelve permanente
  perform pg_temp.canje('10', pg_temp.nuevo('item', pg_temp.item(3), null, 7));
  r := pg_temp.canje('10', pg_temp.nuevo('item', pg_temp.item(3)));
  if r ->> 'until' is not null or (select expires_at from user_items where user_id = pg_temp.u('10') and item_id = pg_temp.item(3)) is not null then
    raise exception 'falla 4l: %', r;
  end if;
  raise notice 'ok 4: temporal, suma de días, vencido, compra y regalo lo vuelven permanente';
end $$;

-- 5. Puntos y monedas VIP
do $$ declare antes int; vantes int; r jsonb; begin
  select granted, vip_granted into antes, vantes from points_totals(pg_temp.u('c0'));
  r := pg_temp.canje('c0', pg_temp.nuevo('points', null, 500));
  if not (r ->> 'ok')::boolean or (r ->> 'amount')::int <> 500 then raise exception 'falla 5a: %', r; end if;
  perform pg_temp.canje('c0', pg_temp.nuevo('vip_coins', null, 40));
  if (select granted from points_totals(pg_temp.u('c0'))) <> antes + 500 or (select vip_granted from points_totals(pg_temp.u('c0'))) <> vantes + 40 then
    raise exception 'falla 5b';
  end if;
  if (select count(*) from point_grants where user_id = pg_temp.u('c0') and redemption_id is not null) <> 2 then raise exception 'falla 5c'; end if;
  perform pg_temp.como('c0');
  if not exists (select 1 from points_history(pg_temp.u('c0'), 'points') where kind = 'code' and amount = 500 and label = 'Código: Sorteo prueba') then
    raise exception 'falla 5d: no sale en el historial';
  end if;
  raise notice 'ok 5: puntos y monedas VIP en point_grants y en el historial';
end $$;

-- 6. VIP por días
do $$ declare r jsonb; v timestamptz; begin
  if is_vip(pg_temp.u('c0')) then raise exception 'falla 6 previo'; end if;
  r := pg_temp.canje('c0', pg_temp.nuevo('vip', null, null, 7));
  v := (r ->> 'until')::timestamptz;
  if not is_vip(pg_temp.u('c0')) or v > now() + interval '7 days' or v < now() + interval '7 days' - interval '1 minute' then raise exception 'falla 6a: %', r; end if;
  r := pg_temp.canje('c0', pg_temp.nuevo('vip', null, null, 30));
  if (r ->> 'until')::timestamptz <> v + interval '30 days' then raise exception 'falla 6b: %', r; end if;
  if (select count(*) from vip_memberships where user_id = pg_temp.u('c0') and source = 'code') <> 2 then raise exception 'falla 6c'; end if;
  perform pg_temp.err(pg_temp.canje('e0', pg_temp.nuevo('vip', null, null, 7)), 'code_vip_lifetime', '6d');
  raise notice 'ok 6: VIP por días, se encadena y no a quien es VIP de por vida';
end $$;

-- 6b. Lo VIP de un código sin ser VIP (code_vip_free, Daniel 2026-11-17)
do $$ declare v text; c points_config; begin
  select id into v from shop_items where vip_only and not vip_reward and kind = 'sticker' order by id limit 1;
  if is_vip(pg_temp.u('a0')) then raise exception 'falla 6b previo'; end if;
  if not (select code_vip_free from points_config where id = 1) then raise exception 'falla 6b0: no viene encendido'; end if;
  perform pg_temp.err(pg_temp.canje('a0', pg_temp.nuevo('item', v)), 'ok', '6b1');
  if not can_use_item(pg_temp.u('a0'), v) then raise exception 'falla 6b2: encendido y no lo puede usar'; end if;
  perform pg_temp.como('a0');
  perform set_my_cosmetics(jsonb_build_object('stickers', jsonb_build_array(v)));
  if (select stickers -> 0 ->> 'id' from player_cosmetics_public where user_id = pg_temp.u('a0')) <> v then raise exception 'falla 6b3: no se ve puesto'; end if;
  -- apagado: queda congelado como lo comprado
  perform pg_temp.como('d0');
  c := jsonb_populate_record(null::points_config, set_points_config('{"code_vip_free": false}'));
  if c.code_vip_free then raise exception 'falla 6b4'; end if;
  if can_use_item(pg_temp.u('a0'), v) then raise exception 'falla 6b5: apagado y lo puede usar'; end if;
  if (select jsonb_array_length(stickers) from player_cosmetics_public where user_id = pg_temp.u('a0')) <> 0 then raise exception 'falla 6b6: sigue a la vista'; end if;
  begin perform set_points_config('{"code_vip_free": "si"}'); raise exception 'falla 6b7';
  exception when raise_exception then if sqlerrm not like 'code_vip_free tiene que ser%' then raise; end if; end;
  begin perform pg_temp.como('a0'); perform set_points_config('{"code_vip_free": true}'); raise exception 'falla 6b8';
  exception when insufficient_privilege then null; end;
  -- lo VIP comprado o regalado sigue la regla de siempre aunque esté encendido
  perform pg_temp.como('d0');
  perform set_points_config('{"code_vip_free": true}');
  update user_items set source = 'grant' where user_id = pg_temp.u('a0') and item_id = v;
  if can_use_item(pg_temp.u('a0'), v) then raise exception 'falla 6b9: lo regalado se usa sin VIP'; end if;
  update user_items set source = 'code' where user_id = pg_temp.u('a0') and item_id = v;
  if not can_use_item(pg_temp.u('a0'), v) then raise exception 'falla 6b10'; end if;
  raise notice 'ok 6b: lo VIP de un código se usa sin VIP si está encendido, se congela si se apaga, y lo regalado sigue la regla';
end $$;

-- 7. Para una cuenta, vencido, sin empezar y revocado
do $$ declare c text; begin
  c := pg_temp.nuevo('points', null, 5, null, 1, pg_temp.u('a0'));
  perform pg_temp.err(pg_temp.canje('c0', c), 'code_not_for_you', '7a');
  perform pg_temp.err(pg_temp.canje('a0', c), 'ok', '7b');
  c := pg_temp.nuevo('points', null, 5);
  update redeem_codes set starts_at = now() - interval '2 days', expires_at = now() - interval '1 day' where display = c;
  perform pg_temp.err(pg_temp.canje('10', c), 'code_expired', '7c');
  c := pg_temp.nuevo('points', null, 5);
  update redeem_codes set starts_at = now() + interval '1 day' where display = c;
  perform pg_temp.err(pg_temp.canje('10', c), 'code_invalid', '7d');
  c := pg_temp.nuevo('points', null, 5);
  perform pg_temp.como('d0');
  perform admin_code_revoke((select id from redeem_codes where display = c), 'prueba');
  perform pg_temp.err(pg_temp.canje('10', c), 'code_invalid', '7e');
  if (select count(*) from redeem_attempts where user_id = pg_temp.u('10')) <> 2 then raise exception 'falla 7f: fallos anotados'; end if;
  if (select string_agg(typed, ',') from redeem_attempts where user_id = pg_temp.u('10')) !~ '^CM1[0-9A-Z],CM1[0-9A-Z]$' then raise exception 'falla 7g: typed'; end if;
  raise notice 'ok 7: para una cuenta, vencido, sin empezar y revocado (los dos últimos son fallos)';
end $$;

-- 8. Topes contra la fuerza bruta
do $$ declare r jsonb; c text; begin
  c := pg_temp.nuevo('points', null, 5);
  delete from redeem_attempts where user_id = pg_temp.u('10');
  for i in 1 .. 4 loop perform pg_temp.err(pg_temp.canje('10', 'NOEXISTE' || i), 'code_invalid', '8a'); end loop;
  perform pg_temp.err(pg_temp.canje('10', c), 'ok', '8b');  -- con 4 fallos todavía puede
  perform pg_temp.err(pg_temp.canje('10', 'NOEXISTE5'), 'code_invalid', '8c');
  r := pg_temp.canje('10', pg_temp.nuevo('points', null, 5));
  perform pg_temp.err(r, 'code_rate_limited', '8d');
  if (r ->> 'retry_after')::int not between 890 and 900 then raise exception 'falla 8e: %', r; end if;
  -- los 5 fallos de hace 20 minutos ya no bloquean
  update redeem_attempts set at = at - interval '20 minutes' where user_id = pg_temp.u('10');
  if redeem_blocked_until(pg_temp.u('10')) is not null then raise exception 'falla 8f'; end if;
  -- 20 en 24 horas (de a uno por hora, el más viejo de hace 20): faltan 4 horas
  delete from redeem_attempts where user_id = pg_temp.u('10');
  insert into redeem_attempts (user_id, at) select pg_temp.u('10'), now() - make_interval(hours => h) from generate_series(1, 20) h;
  r := pg_temp.canje('10', 'NOEXISTE6');
  perform pg_temp.err(r, 'code_rate_limited', '8g');
  if (r ->> 'retry_after')::int not between 14390 and 14400 then raise exception 'falla 8h: %', r; end if;
  -- los de más de 30 días se borran con el próximo fallo
  delete from redeem_attempts where user_id = pg_temp.u('10');
  insert into redeem_attempts (user_id, at) values (pg_temp.u('10'), now() - interval '31 days');
  perform pg_temp.canje('10', 'NOEXISTE7');
  if (select count(*) from redeem_attempts where user_id = pg_temp.u('10')) <> 1 then raise exception 'falla 8i: no se borró el viejo'; end if;
  perform pg_temp.como('d0');
  delete from redeem_attempts where user_id = pg_temp.u('10');
  for i in 1 .. 5 loop perform pg_temp.canje('10', 'NOEXISTE' || i); end loop;
  perform pg_temp.como('d0');
  if not exists (select 1 from jsonb_array_elements(admin_redeem_attempts() -> 'blocked') b where b -> 'account' ->> 'alias' = 'p126g') then
    raise exception 'falla 8j: no sale bloqueada';
  end if;
  raise notice 'ok 8: 5 en 15 minutos, 20 en 24 horas, limpieza a los 30 días y la lista del admin';
end $$;

-- 9. Personalizados, lotes y validaciones
do $$ declare r jsonb; begin
  if pg_temp.nuevo('points', null, 50, null, 10, null, 'Navidad-2026') <> 'NAVIDAD-2026' then raise exception 'falla 9a'; end if;
  if (select code from redeem_codes where display = 'NAVIDAD-2026') <> 'NAV1DAD2026' then raise exception 'falla 9b'; end if;
  perform pg_temp.err(pg_temp.canje('c0', 'navidad 2026'), 'ok', '9c');
  perform pg_temp.como('d0');
  r := admin_code_create('points', null, 5, null, 1, 100);
  if jsonb_array_length(r -> 'codes') <> 100 or (select count(distinct x ->> 'code') from jsonb_array_elements(r -> 'codes') x) <> 100 then
    raise exception 'falla 9d';
  end if;
  if (select count(*) from redeem_codes where batch_id = (r ->> 'batch_id')::uuid) <> 100 then raise exception 'falla 9e'; end if;
  begin perform admin_code_create('points', null, 50, null, 1, 1, null, null, null, 'navidad-2026'); raise exception 'falla 9f';
  exception when raise_exception then if sqlerrm <> 'Ese código ya existe' then raise; end if; end;
  begin perform admin_code_create('points', null, 5, null, 1, 2, null, null, null, 'OTROCODIGO'); raise exception 'falla 9g';
  exception when raise_exception then if sqlerrm not like 'Un código personalizado se crea de a uno%' then raise; end if; end;
  begin perform admin_code_create('points', null, 5, null, 1, 101); raise exception 'falla 9h';
  exception when raise_exception then if sqlerrm not like 'Se crean de 1 a 100%' then raise; end if; end;
  begin perform admin_code_create('item', (select id from shop_items where vip_reward limit 1)); raise exception 'falla 9i';
  exception when raise_exception then if sqlerrm not like 'Ese artículo viene con el VIP%' then raise; end if; end;
  begin perform admin_code_create('points', null, 5, 7); raise exception 'falla 9j';
  exception when raise_exception then if sqlerrm not like 'Los puntos y las monedas no llevan%' then raise; end if; end;
  begin perform admin_code_create('vip'); raise exception 'falla 9k';
  exception when raise_exception then if sqlerrm not like 'Elige cuántos días%' then raise; end if; end;
  begin perform admin_code_create('points', null, 5, null, 2, 1, null, null, pg_temp.u('a0')); raise exception 'falla 9l';
  exception when raise_exception then if sqlerrm not like 'Un código para una cuenta%' then raise; end if; end;
  begin perform admin_code_create('points', null, 5, null, 1, 1, null, now() - interval '1 hour'); raise exception 'falla 9m';
  exception when raise_exception then if sqlerrm not like 'El vencimiento%' then raise; end if; end;
  begin perform admin_code_create('points', null, 5, null, 1, 1, null, null, null, 'CORTO'); raise exception 'falla 9n';
  exception when raise_exception then if sqlerrm not like 'El código personalizado va de 8 a 24%' then raise; end if; end;
  raise notice 'ok 9: personalizados, lotes de 100 y validaciones';
end $$;

-- 10. Revertir
do $$ declare c text; rid uuid; antes int; vip uuid; v timestamptz; begin
  -- puntos: fila negativa y el código recupera el uso
  select granted into antes from points_totals(pg_temp.u('10'));
  c := pg_temp.nuevo('points', null, 300);
  perform pg_temp.como('d0');
  delete from redeem_attempts where user_id = pg_temp.u('10');
  perform pg_temp.err(pg_temp.canje('10', c), 'ok', '10a');
  select r.id into rid from code_redemptions r join redeem_codes k on k.id = r.code_id where k.display = c;
  perform pg_temp.como('d0');
  perform admin_redemption_revert(rid, 'prueba');
  if (select granted from points_totals(pg_temp.u('10'))) <> antes then raise exception 'falla 10b: saldo'; end if;
  if (select uses from redeem_codes where display = c) <> 0 then raise exception 'falla 10c: usos'; end if;
  if not exists (select 1 from notifications where user_id = pg_temp.u('10') and type = 'code_reverted') then raise exception 'falla 10d: aviso'; end if;
  perform pg_temp.err(pg_temp.canje('10', c), 'code_already_redeemed', '10e');
  perform pg_temp.como('d0');
  begin perform admin_redemption_revert(rid, 'otra vez'); raise exception 'falla 10f';
  exception when raise_exception then if sqlerrm <> 'Ese canje ya se revirtió' then raise; end if; end;
  -- VIP: se revoca el período
  perform pg_temp.canje('10', pg_temp.nuevo('vip', null, null, 7));
  select r.id, r.vip_membership_id into rid, vip from code_redemptions r where r.user_id = pg_temp.u('10') and r.reward = 'vip';
  perform pg_temp.como('d0');
  perform admin_redemption_revert(rid, 'prueba');
  if (select revoked_at from vip_memberships where id = vip) is null or is_vip(pg_temp.u('10')) then raise exception 'falla 10g'; end if;
  -- artículo para siempre: se borra y se saca de lo puesto
  perform pg_temp.canje('10', pg_temp.nuevo('item', pg_temp.item(1)));
  perform pg_temp.como('10');
  perform set_my_cosmetics(jsonb_build_object('frame', pg_temp.item(1)));
  select r.id into rid from code_redemptions r where r.user_id = pg_temp.u('10') and r.item_id = pg_temp.item(1);
  perform pg_temp.como('d0');
  perform admin_redemption_revert(rid, 'prueba');
  if exists (select 1 from user_items where user_id = pg_temp.u('10') and item_id = pg_temp.item(1)) then raise exception 'falla 10h'; end if;
  if (select frame from user_cosmetics where user_id = pg_temp.u('10')) is not null then raise exception 'falla 10i: sigue puesto'; end if;
  -- artículo temporal con dos canjes: se le restan los días de uno
  perform pg_temp.canje('e0', pg_temp.nuevo('item', pg_temp.item(1), null, 7));
  perform pg_temp.canje('e0', pg_temp.nuevo('item', pg_temp.item(1), null, 30));
  select expires_at into v from user_items where user_id = pg_temp.u('e0') and item_id = pg_temp.item(1);
  select r.id into rid from code_redemptions r where r.user_id = pg_temp.u('e0') and r.item_id = pg_temp.item(1) and r.days = 30;
  perform pg_temp.como('d0');
  perform admin_redemption_revert(rid, 'prueba');
  if (select expires_at from user_items where user_id = pg_temp.u('e0') and item_id = pg_temp.item(1)) <> v - interval '30 days' then
    raise exception 'falla 10j';
  end if;
  -- el que quedó: se queda sin días y se borra
  select r.id into rid from code_redemptions r where r.user_id = pg_temp.u('e0') and r.item_id = pg_temp.item(1) and r.days = 7;
  perform admin_redemption_revert(rid, 'prueba');
  if exists (select 1 from user_items where user_id = pg_temp.u('e0') and item_id = pg_temp.item(1)) then raise exception 'falla 10k'; end if;
  -- lo compró después: no se toca
  select r.id into rid from code_redemptions r where r.user_id = pg_temp.u('a0') and r.item_id = pg_temp.item(2) and r.days = 7;
  perform admin_redemption_revert(rid, 'prueba');
  if not exists (select 1 from user_items where user_id = pg_temp.u('a0') and item_id = pg_temp.item(2) and source = 'purchase') then
    raise exception 'falla 10l: tocó lo comprado';
  end if;
  raise notice 'ok 10: revertir puntos, VIP, artículo para siempre, temporal y lo ya comprado';
end $$;

-- 11. Listas del jugador y del admin
do $$ declare n int; begin
  perform pg_temp.como('a0');
  if jsonb_array_length(my_redemptions()) < 5 then raise exception 'falla 11a'; end if;
  if exists (select 1 from jsonb_array_elements(my_redemptions()) x where char_length(x ->> 'code_tail') <> 4) then raise exception 'falla 11b'; end if;
  perform pg_temp.como('d0');
  select count(*) into n from admin_codes(null, 'revoked');
  if n < 1 or exists (select 1 from admin_codes(null, 'revoked') x where x.state <> 'revoked') then raise exception 'falla 11c'; end if;
  if (select count(*) from admin_codes('navidad')) <> 1 then raise exception 'falla 11d: buscar'; end if;
  if (select total from admin_codes(null, null, 1) limit 1) < 100 then raise exception 'falla 11e: total'; end if;
  if (select count(*) from admin_code_redemptions((select id from redeem_codes where display = 'NAVIDAD-2026'))) <> 1 then raise exception 'falla 11f'; end if;
  perform pg_temp.como('a0');
  begin perform admin_codes(); raise exception 'falla 11g';
  exception when insufficient_privilege then null; end;
  raise notice 'ok 11: mis canjes y las listas del admin';
end $$;

-- 12. La inversa deja la estructura igual que antes.
select set_config('request.jwt.claims', '', true);
\i :rev126
do $$
declare d text;
begin
  select string_agg(x.k, ', ') into d from (
    (select * from huella except select * from pg_temp.estructura())
    union (select * from pg_temp.estructura() except select * from huella)) x;
  if d is not null then raise exception 'falla 12: la estructura no quedó igual: %', d; end if;
  if exists (select 1 from vip_memberships where source not in ('manual', 'import')) then raise exception 'falla 12b'; end if;
  raise notice 'ok 12: la inversa deja la estructura idéntica';
end $$;

rollback;
