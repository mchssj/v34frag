-- Prueba de la 119 (antes 113) en una transacción que se deshace (base local o una copia de producción).
-- Uso: probar_113.sh (le pasa las rutas de la 119 y de su inversa).
\set ON_ERROR_STOP 1
begin;

-- Si la base ya tiene la tienda (la copia local), se revierte primero: todo se deshace al final.
select to_regclass('public.shop_items') is not null as ya_113 \gset
\if :ya_113
\i :rev113
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
    from pg_policy p join pg_class c on c.oid = p.polrelid where c.relnamespace = 'public'::regnamespace $$;
create temp table huella as select * from pg_temp.estructura();

\i :r113

-- La 119 sale con los valores y el catálogo de la base local de Daniel (2026-11-14). La prueba usa los de antes
-- (10 y 5, fondo fijo a 500) y todo el catálogo a la venta: se cambian acá y se deshacen con el rollback.
do $$ begin
  if (select row(per_mix, per_win, vip_per_mix, vip_per_win, custom_bg_static_price, custom_max_avatar, custom_max_background)::text
        from points_config where id = 1) <> '(20,10,20,10,300,5,5)' then
    raise exception 'falla 0: la 119 no carga los valores de Daniel';
  end if;
  if (select count(*) filter (where active) from shop_items) <> 326 then raise exception 'falla 0b: activos'; end if;
  raise notice 'ok 0: la 119 carga los valores y los 326 activos de la base local';
end $$;
update points_config set per_mix = 10, per_win = 5, vip_per_mix = 10, vip_per_win = 5, custom_bg_static_price = 500 where id = 1;
update shop_items set active = true;

-- Cuentas: A (ficha con dos SteamID, VIP desde hace 5 días), B (sin ficha), C (con ficha, sin VIP) y D (admin).
-- El alias sale de raw_user_meta_data.tag, y el nick de una ficha con cuenta es su alias.
insert into auth.users (id, email, raw_user_meta_data) values
  ('22222222-2222-4222-8222-0000000113a0', 'p113a@example.com', '{"tag":"p113a"}'),
  ('22222222-2222-4222-8222-0000000113b0', 'p113b@example.com', '{"tag":"q113b"}'),
  ('22222222-2222-4222-8222-0000000113c0', 'p113c@example.com', '{"tag":"p113c"}'),
  ('22222222-2222-4222-8222-0000000113d0', 'p113d@example.com', '{"tag":"q113d"}');
update profiles set role = 'admin' where id = '22222222-2222-4222-8222-0000000113d0';
insert into players (id, nick, steam_id, user_id) values
  ('11111111-1111-4111-8111-0000000113a0', 'p113a', '76561190000011301', '22222222-2222-4222-8222-0000000113a0'),
  ('11111111-1111-4111-8111-0000000113c0', 'p113c', '76561190000011303', '22222222-2222-4222-8222-0000000113c0');
insert into player_extra_steam_ids (player_id, steam_id) values ('11111111-1111-4111-8111-0000000113a0', '76561190000011302');
insert into vip_memberships (user_id, starts_at, ends_at, source)
values ('22222222-2222-4222-8222-0000000113a0', now() - interval '5 days', now() + interval '30 days', 'manual');

-- Partidas. Cada una con A (o su SteamID adicional) y C, y lo que cuenta o no.
create temp table pm (k text primary key, id uuid);
create function pg_temp.mix(p_k text, p_days int, p_winner int, p_end text default null, p_parent uuid default null,
                            p_kind text default 'mix', p_status text default 'finished') returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into matches (kind, status, best_of, side1_name, side2_name, map, played_at, score1, score2, winner_side, end_reason,
                       parent_match_id, parent_side1)
  values (p_kind, p_status, 1, 'a', 'b', 'de_dust2', now() - make_interval(days => p_days), 13, 7, p_winner, p_end,
          p_parent, case when p_parent is not null then 1 end)
  returning id into v;
  insert into pm values (p_k, v);
  return v;
end $$;
create function pg_temp.stat(p_match uuid, p_steam text, p_player uuid, p_team int, p_elo int) returns void language sql as $$
  insert into match_player_stats (match_id, steam_id, player_id, nick, team, kills, deaths, rounds, elo_after)
  values (p_match, p_steam, p_player, 'x', p_team, 10, 10, 20, p_elo) $$;

do $$
declare a uuid := '11111111-1111-4111-8111-0000000113a0'; c uuid := '11111111-1111-4111-8111-0000000113c0';
        m uuid; mm1 uuid; mm2 uuid; l uuid;
begin
  -- m1: hace 10 días (A no era VIP), A gana: 15 puntos, 0 monedas. C pierde: 10.
  m := pg_temp.mix('m1', 10, 1);
  perform pg_temp.stat(m, '76561190000011301', a, 1, 1010);
  perform pg_temp.stat(m, '76561190000011303', c, 2, 990);
  -- m2: hace 2 días, A con su SteamID adicional y sin player_id, pierde siendo VIP: 10 puntos, 10 monedas.
  m := pg_temp.mix('m2', 2, 1);
  perform pg_temp.stat(m, '76561190000011302', null, 2, 1000);
  -- m3: interrumpido: no cuenta.
  m := pg_temp.mix('m3', 1, 1, 'crash');
  perform pg_temp.stat(m, '76561190000011301', a, 1, 1001);
  -- m4: sin ELO (no llegó al 35 % de las rondas): no cuenta.
  m := pg_temp.mix('m4', 1, 1);
  perform pg_temp.stat(m, '76561190000011301', a, 1, null);
  -- m5: mapa del matchmaking, A gana siendo VIP: 15 puntos y 15 monedas.
  insert into matches (kind, status, best_of, side1_name, side2_name) values ('mm', 'finished', 1, 'a', 'b') returning id into mm1;
  m := pg_temp.mix('m5', 1, 1, null, mm1);
  perform pg_temp.stat(m, '76561190000011301', a, 1, 1015);
  -- m6: mapa del matchmaking en el que A abandonó: no cuenta (aunque tenga ELO). C gana: 15.
  insert into matches (kind, status, best_of, side1_name, side2_name) values ('mm', 'finished', 1, 'a', 'b') returning id into mm2;
  insert into mm_lobbies (mode, status, match_id) values ('5v5', 'finished', mm2) returning id into l;
  insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at, abandoned)
  values (l, '22222222-2222-4222-8222-0000000113a0', a, 1, 1000, now(), true);
  m := pg_temp.mix('m6', 1, 2, null, mm2);
  perform pg_temp.stat(m, '76561190000011301', a, 1, 980);
  perform pg_temp.stat(m, '76561190000011303', c, 2, 1005);
  -- m7: no es un mix: no cuenta.
  m := pg_temp.mix('m7', 1, 1, null, null, 'official');
  perform pg_temp.stat(m, '76561190000011301', a, 1, 1000);
  -- m8: un mix sin terminar: no cuenta.
  m := pg_temp.mix('m8', 0, null, null, null, 'mix', 'live');
  perform pg_temp.stat(m, '76561190000011301', a, 1, 1000);
end $$;

-- 1. Puntos y monedas calculados.
do $$
declare t record;
begin
  select * into t from points_totals('22222222-2222-4222-8222-0000000113a0');
  if (t.earned, t.mixes, t.vip_earned, t.vip_mixes) is distinct from (40, 3, 25, 2) then
    raise exception 'falla 1a: A %', row_to_json(t);
  end if;
  select * into t from points_totals('22222222-2222-4222-8222-0000000113c0');
  if (t.earned, t.mixes, t.vip_earned) is distinct from (25, 2, 0) then raise exception 'falla 1b: C %', row_to_json(t); end if;
  if (select count(*) from points_mixes_of('22222222-2222-4222-8222-0000000113a0') where mm) <> 1 then
    raise exception 'falla 1c: el mapa del matchmaking';
  end if;
  raise notice 'ok 1: cuenta mixes, matchmaking y el SteamID adicional; no el interrumpido, sin ELO, abandonado, oficial ni en vivo';
end $$;

-- 2. Sin sesión no se ve ni se compra; points_config y el catálogo son públicos.
set local role anon;
do $$ begin
  if (select count(*) from shop_catalog) < 300 then raise exception 'falla 2a: catálogo'; end if;
  if (select per_mix from points_config) <> 10 then raise exception 'falla 2b'; end if;
  begin perform shop_buy('marco-mira'); raise exception 'falla 2c';
  exception when insufficient_privilege then null; end;
  begin perform points_summary('22222222-2222-4222-8222-0000000113a0'); raise exception 'falla 2d';
  exception when insufficient_privilege then null; end;
  raise notice 'ok 2: anon ve el catálogo y no compra ni ve saldos';
end $$;
reset role;

-- 3. A: su saldo, el de otro no.
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-0000000113a0","role":"authenticated"}', true); end $$;
do $$
declare j jsonb;
begin
  j := points_summary();
  if (j #>> '{points,balance}')::int <> 40 or (j #>> '{vip_coins,balance}')::int <> 25 or (j ->> 'vip')::boolean is not true
     or (j #>> '{vip_coins,frozen}')::boolean then
    raise exception 'falla 3a: %', j;
  end if;
  begin perform points_summary('22222222-2222-4222-8222-0000000113c0'); raise exception 'falla 3b';
  exception when insufficient_privilege then null; end;
  if (select count(*) from points_history(p_currency => 'points')) <> 3 then raise exception 'falla 3c: historial'; end if;
  if (select max(total) from points_history(p_currency => 'vip', p_limit => 1)) <> 2 then raise exception 'falla 3d: total'; end if;
  raise notice 'ok 3: saldo propio, historial con total y nada ajeno';
end $$;

-- 4. Comprar: sin saldo, lo VIP con monedas, repetido, el premio VIP y lo que no se vende.
reset role;
update shop_items set price = 30 where id = 'marco-camuflaje';
update shop_items set price = null where id = 'marco-balas';
update shop_items set vip_price = 20 where id = (select id from shop_items where vip_only and not vip_reward and kind = 'sticker' order by sort limit 1);
update points_config set weekly_count = 0;  -- sin ofertas, para que el precio sea el de la lista
set local role authenticated;
do $$
declare r jsonb; v_vip text := (select id from shop_items where vip_only and not vip_reward and kind = 'sticker' order by sort limit 1);
begin
  begin perform shop_buy('marco-mira'); raise exception 'falla 4a';
  exception when raise_exception then if sqlerrm not like 'Te faltan % puntos' then raise; end if; end;
  r := shop_buy('marco-camuflaje');
  if (r ->> 'balance')::int <> 10 or r ->> 'currency' <> 'points' then raise exception 'falla 4b: %', r; end if;
  begin perform shop_buy('marco-camuflaje'); raise exception 'falla 4c';
  exception when raise_exception then if sqlerrm <> 'Ya lo tienes' then raise; end if; end;
  r := shop_buy(v_vip);
  if (r ->> 'balance')::int <> 5 or r ->> 'currency' <> 'vip' then raise exception 'falla 4d: %', r; end if;
  begin perform shop_buy('marco-vip-oro'); raise exception 'falla 4e';
  exception when raise_exception then if sqlerrm not like '%viene con el VIP%' then raise; end if; end;
  begin perform shop_buy('marco-balas'); raise exception 'falla 4f';
  exception when raise_exception then if sqlerrm <> 'Ese artículo no está a la venta' then raise; end if; end;
  raise notice 'ok 4: compra con puntos y con monedas VIP; rechaza sin saldo, repetido, premio VIP y sin precio';
end $$;

-- 5. Equipar.
do $$
declare r jsonb; v_vip text := (select id from shop_items where vip_only and not vip_reward and kind = 'sticker' order by sort limit 1);
        s1 text := (select id from shop_items where kind = 'sticker' and not vip_only order by sort limit 1);
begin
  r := set_my_cosmetics(jsonb_build_object('frame', 'marco-vip-oro', 'stickers', jsonb_build_array(v_vip, v_vip)));
  if r ->> 'frame' <> 'marco-vip-oro' or jsonb_array_length(r -> 'stickers') <> 1 then raise exception 'falla 5a: %', r; end if;
  begin perform set_my_cosmetics('{"frame":"marco-mira"}'); raise exception 'falla 5b';
  exception when raise_exception then if sqlerrm <> 'Todavía no tienes ese artículo' then raise; end if; end;
  begin perform set_my_cosmetics(jsonb_build_object('theme', 'marco-camuflaje')); raise exception 'falla 5c';
  exception when raise_exception then if sqlerrm not like 'Ese artículo no es del tipo%' then raise; end if; end;
  begin perform set_my_cosmetics(jsonb_build_object('stickers', jsonb_build_array(s1))); raise exception 'falla 5d';
  exception when raise_exception then if sqlerrm <> 'Todavía no tienes ese sticker' then raise; end if; end;
  r := set_my_cosmetics('{"frame":"marco-camuflaje"}');
  if r ->> 'frame' <> 'marco-camuflaje' or jsonb_array_length(r -> 'stickers') <> 1 then raise exception 'falla 5e: no se conservaron los stickers %', r; end if;
  r := set_my_cosmetics('{"frame":"marco-vip-oro"}');
  raise notice 'ok 5: equipa lo propio y el premio VIP; rechaza lo ajeno y el tipo equivocado; conserva lo que no viene';
end $$;

-- 6. Sin escritura directa en las tablas.
do $$ begin
  begin insert into user_items (user_id, item_id, source) values (auth.uid(), 'marco-mira', 'grant'); raise exception 'falla 6a';
  exception when insufficient_privilege then null; end;
  begin insert into point_grants (user_id, amount, reason) values (auth.uid(), 1000, 'x'); raise exception 'falla 6b';
  exception when insufficient_privilege then null; end;
  begin perform admin_points_grant(auth.uid(), 1000, 'yo'); raise exception 'falla 6c';
  exception when insufficient_privilege then null; end;
  raise notice 'ok 6: sin escritura directa ni funciones de admin';
end $$;

-- 6b. Un avatar animado (VIP): regalado y equipado por A, en su lugar y no como marco.
reset role;
insert into user_items (user_id, item_id, source) values ('22222222-2222-4222-8222-0000000113a0', 'avatar-relampago', 'grant');
set local role authenticated;
do $$
declare r jsonb;
begin
  r := set_my_cosmetics('{"avatar":"avatar-relampago"}');
  if r ->> 'avatar' <> 'avatar-relampago' or r ->> 'frame' <> 'marco-vip-oro' then raise exception 'falla 6b1: %', r; end if;
  begin perform set_my_cosmetics('{"frame":"avatar-relampago"}'); raise exception 'falla 6b2';
  exception when raise_exception then if sqlerrm not like 'Ese artículo no es del tipo%' then raise; end if; end;
  raise notice 'ok 6b: el avatar va en su lugar, junto al marco';
end $$;

-- 7. Lo público y el VIP vencido: lo VIP queda congelado y vuelve al renovar.
reset role;
do $$
declare v record;
begin
  select * into v from player_cosmetics_public where player_id = '11111111-1111-4111-8111-0000000113a0';
  if v.frame ->> 'id' <> 'marco-vip-oro' or jsonb_array_length(v.stickers) <> 1 or v.frame ->> 'file' is null
     or v.avatar ->> 'file' is distinct from 'avatares/relampago.svg' then
    raise exception 'falla 7a: %', row_to_json(v);
  end if;
  update vip_memberships set ends_at = now() - interval '1 second', starts_at = now() - interval '5 days'
   where user_id = '22222222-2222-4222-8222-0000000113a0';
  select * into v from player_cosmetics_public where player_id = '11111111-1111-4111-8111-0000000113a0';
  if v.frame is not null or v.avatar is not null or jsonb_array_length(v.stickers) <> 0 or v.vip then raise exception 'falla 7b: %', row_to_json(v); end if;
  -- las monedas ganadas siendo VIP siguen (congeladas)
  if (select vip_earned from points_totals('22222222-2222-4222-8222-0000000113a0')) <> 25 then raise exception 'falla 7c'; end if;
  insert into vip_memberships (user_id, starts_at, ends_at, source)
  values ('22222222-2222-4222-8222-0000000113a0', now(), now() + interval '30 days', 'manual');
  select * into v from player_cosmetics_public where player_id = '11111111-1111-4111-8111-0000000113a0';
  if v.frame ->> 'id' <> 'marco-vip-oro' or v.avatar is null or jsonb_array_length(v.stickers) <> 1 then raise exception 'falla 7d'; end if;
  raise notice 'ok 7: lo VIP (también el avatar) se oculta al vencer y vuelve al renovar; las monedas quedan';
end $$;

-- 8. Admin: regalos con aviso, quitar, precios y configuración.
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-0000000113d0","role":"authenticated"}', true); end $$;
do $$
declare a uuid := '22222222-2222-4222-8222-0000000113a0'; r jsonb; n int;
begin
  perform admin_points_grant(a, -50, 'corrección');
  if (points_summary(a) #>> '{points,balance}')::int <> -40 then raise exception 'falla 8a: saldo negativo'; end if;
  perform admin_points_grant(a, 7, 'regalo', 'vip');
  if (points_summary(a) #>> '{vip_coins,balance}')::int <> 12 then raise exception 'falla 8b'; end if;
  perform admin_item_grant(a, 'marco-mira', 'premio');
  perform admin_item_revoke(a, 'marco-camuflaje', 'prueba');
  if exists (select 1 from user_cosmetics where user_id = a and 'marco-camuflaje' in (frame)) then raise exception 'falla 8c'; end if;
  -- Quitar una compra no devuelve lo pagado: queda un descuento por los 30 puntos y el saldo no cambia.
  if (points_summary(a) #>> '{points,balance}')::int <> -40 then raise exception 'falla 8p: quitar devolvió puntos %', points_summary(a); end if;
  if not exists (select 1 from points_history(a, 'points', 100, 0) where kind = 'grant' and amount = -30 and label like 'Compra quitada: %') then
    raise exception 'falla 8q: falta el descuento de la compra quitada';
  end if;
  begin perform admin_item_grant(a, 'marco-vip-oro'); raise exception 'falla 8e';
  exception when raise_exception then if sqlerrm not like '%dale VIP%' then raise; end if; end;
  r := admin_shop_item_update('marco-mira', '{"price": 999, "active": false}');
  if (r ->> 'price')::int <> 999 or (r ->> 'active')::boolean then raise exception 'falla 8f: %', r; end if;
  r := admin_shop_item_update('marco-mira', '{"price": null}');
  if r ->> 'price' is not null then raise exception 'falla 8g'; end if;
  begin perform admin_shop_item_update('marco-vip-oro', '{"vip_price": 10}'); raise exception 'falla 8h';
  exception when raise_exception then null; end;
  begin perform admin_shop_item_update('marco-mira', '{"kind": "sticker"}'); raise exception 'falla 8i';
  exception when raise_exception then null; end;
  -- Pasar a VIP borra el precio en puntos y toma el de monedas VIP; volver a todos, al revés.
  r := admin_shop_item_update('marco-mira', '{"vip_only": true, "vip_price": 300}');
  if not (r ->> 'vip_only')::boolean or r ->> 'price' is not null or (r ->> 'vip_price')::int <> 300 then raise exception 'falla 8r: %', r; end if;
  if can_use_item(a, 'marco-mira') <> is_vip(a) then raise exception 'falla 8s: lo VIP se usa solo siendo VIP'; end if;
  r := admin_shop_item_update('marco-mira', '{"vip_only": false, "price": 400}');
  if (r ->> 'vip_only')::boolean or r ->> 'vip_price' is not null or (r ->> 'price')::int <> 400 then raise exception 'falla 8t: %', r; end if;
  if not can_use_item(a, 'marco-mira') then raise exception 'falla 8u'; end if;
  begin perform admin_shop_item_update('marco-vip-oro', '{"vip_only": false}'); raise exception 'falla 8v';
  exception when raise_exception then if sqlerrm not like '%sigue siendo VIP%' then raise; end if; end;
  r := set_points_config('{"per_mix": 20}');
  if (r ->> 'per_mix')::int <> 20 or (points_summary(a) #>> '{points,earned}')::int <> 70 then raise exception 'falla 8j: %', r; end if;
  begin perform points_totals(a); raise exception 'falla 8o';
  exception when insufficient_privilege then null; end;
  begin perform set_points_config('{"per_mix": "20"}'); raise exception 'falla 8k';
  exception when raise_exception then null; end;
  if (select count(*) from admin_points_accounts(p_q => 'p113')) <> 2 then raise exception 'falla 8l: %', (select json_agg(x) from admin_points_accounts(p_q => 'p113') x); end if;
  if (select alias from admin_points_accounts(p_q => 'p113', p_sort => 'balance:desc', p_limit => 1)) is null then raise exception 'falla 8m'; end if;
  if (select count(*) from user_items_of(a)) <> 4 then raise exception 'falla 8n: inventario (sticker VIP, marco-mira, avatar y el premio VIP)'; end if;
  raise notice 'ok 8: regalos y correcciones con aviso, quitar, precios, configuración, cuentas e inventario';
end $$;

-- 9. Portada: el admin la quita con aviso.
reset role;
do $$
declare n int;
begin
  select count(*) into n from notifications
   where user_id = '22222222-2222-4222-8222-0000000113a0' and type in ('points_granted', 'item_granted', 'item_revoked')
     and category = 'account';
  if n <> 4 then raise exception 'falla 8d: % avisos', n; end if;
  raise notice 'ok 8d: 4 avisos en la categoría account';
end $$;
update profile_details set cover_url = 'https://x/cover.jpg' where user_id = '22222222-2222-4222-8222-0000000113a0';
set local role authenticated;
do $$ begin
  if admin_cover_clear('22222222-2222-4222-8222-0000000113a0', 'imagen inapropiada') <> 'https://x/cover.jpg' then raise exception 'falla 9a'; end if;
  if (select cover_url from profile_details where user_id = '22222222-2222-4222-8222-0000000113a0') is not null then raise exception 'falla 9b'; end if;
  begin perform admin_cover_clear('22222222-2222-4222-8222-0000000113a0', 'otra vez'); raise exception 'falla 9c';
  exception when raise_exception then if sqlerrm <> 'Esa cuenta no tiene portada' then raise; end if; end;
  raise notice 'ok 9: el admin quita la portada';
end $$;

-- 10. Dos compras al mismo tiempo: el lock por cuenta las ordena (se prueba que el lock es por cuenta y se libera).
reset role;
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'shop_buy' and prosrc like '%pg_advisory_xact_lock(hashtext(''shop:''%') then
    raise exception 'falla 10: shop_buy sin lock por cuenta';
  end if;
  raise notice 'ok 10: shop_buy toma el lock por cuenta antes de mirar el saldo';
end $$;

-- 11. Cuenta sin ficha: no compra.
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-0000000113b0","role":"authenticated"}', true); end $$;
do $$ begin
  if (points_summary() ->> 'has_player')::boolean then raise exception 'falla 11a'; end if;
  begin perform shop_buy('marco-camuflaje'); raise exception 'falla 11b';
  exception when raise_exception then if sqlerrm not like 'Necesitas tu ficha%' then raise; end if; end;
  raise notice 'ok 11: sin ficha no compra';
end $$;
reset role;

-- 13. Lo propio: subir y cobrar, lo subido queda guardado (hasta el tope), ponerse uno guardado sin pagar, VIP
--     vencido, borrar de a uno, denunciar y sacar solo esa imagen con aviso, y precios y topes en la configuración.
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-0000000113d0","role":"authenticated"}', true); end $$;
do $$ begin
  perform admin_points_grant('22222222-2222-4222-8222-0000000113a0', 5000, 'prueba de lo propio', 'points');
  perform admin_points_grant('22222222-2222-4222-8222-0000000113a0', 5000, 'prueba de lo propio', 'vip');
  perform admin_points_grant('22222222-2222-4222-8222-0000000113c0', 5000, 'prueba de lo propio', 'points');
end $$;
reset role;
-- Las subidas de la prueba, por nombre.
create temp table up (k text primary key, id uuid);
grant all on up to authenticated;
set local role authenticated;

-- A (VIP): sube dos avatares y un fondo fijo; los dos avatares quedan guardados y vuelve al primero sin pagar.
do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-0000000113a0","role":"authenticated"}', true); end $$;
do $$
declare r jsonb; b0 int; v0 int; v record; a uuid := '11111111-1111-4111-8111-0000000113a0'; a1 uuid; a2 uuid;
begin
  b0 := (points_summary() #>> '{points,balance}')::int;
  v0 := (points_summary() #>> '{vip_coins,balance}')::int;
  begin perform custom_cosmetic_set('avatar', true, 'https://x/a1.webm', 'https://x/a1.webp', 1); raise exception 'falla 13a';
  exception when raise_exception then if sqlerrm <> 'El precio cambió: ahora cuesta 550' then raise; end if; end;
  if (points_summary() #>> '{vip_coins,balance}')::int <> v0 then raise exception 'falla 13a2: cobró con el precio equivocado'; end if;
  r := custom_cosmetic_set('avatar', true, 'https://x/a1.webm', 'https://x/a1.webp', 550);
  if (r ->> 'price_paid')::int <> 550 or r ->> 'currency' <> 'vip' or r ->> 'id' is null then raise exception 'falla 13b: %', r; end if;
  a1 := (r ->> 'id')::uuid;
  if (points_summary() #>> '{vip_coins,balance}')::int <> v0 - 550 then raise exception 'falla 13c'; end if;
  r := custom_cosmetic_set('avatar', true, 'https://x/a2.webm', 'https://x/a2.webp', 550);
  a2 := (r ->> 'id')::uuid;
  if (points_summary() #>> '{vip_coins,balance}')::int <> v0 - 1100 then raise exception 'falla 13e: cada subida cobra'; end if;
  if (select count(*) from custom_cosmetics where user_id = auth.uid() and kind = 'avatar' and cleared_at is null) <> 2 then
    raise exception 'falla 13d: el anterior no quedó guardado';
  end if;
  r := custom_cosmetic_set('background', false, 'https://x/f1.webp', null, 500);
  if r ->> 'currency' <> 'points' or (points_summary() #>> '{points,balance}')::int <> b0 - 500 then raise exception 'falla 13f: %', r; end if;
  insert into up values ('a1', a1), ('a2', a2), ('f1', (r ->> 'id')::uuid);
  select * into v from player_cosmetics_public where player_id = a;
  if v.avatar ->> 'id' <> 'custom' or v.avatar ->> 'url' <> 'https://x/a2.webm' or v.avatar ->> 'poster_url' <> 'https://x/a2.webp'
     or v.background ->> 'url' <> 'https://x/f1.webp' or (v.background ->> 'animated')::boolean then
    raise exception 'falla 13g: %', row_to_json(v);
  end if;
  if (select count(*) from points_history(auth.uid(), 'vip', 100, 0) where kind = 'custom' and amount = -550 and label = 'Avatar propio') <> 2
     or not exists (select 1 from points_history(auth.uid(), 'points', 100, 0)
                     where kind = 'custom' and amount = -500 and label = 'Fondo de miniperfil propio') then
    raise exception 'falla 13h: historial';
  end if;
  -- volver al primero, sacárselo y ponérselo no cuesta
  r := set_my_cosmetics(jsonb_build_object('avatar', 'custom:' || a1));
  if r ->> 'avatar' <> 'custom:' || a1 or (select avatar ->> 'url' from player_cosmetics_public where player_id = a) <> 'https://x/a1.webm'
     or (points_summary() #>> '{vip_coins,balance}')::int <> v0 - 1100 then
    raise exception 'falla 13i: %', r;
  end if;
  r := set_my_cosmetics('{"avatar": null}');
  if r ->> 'avatar' is not null or (select avatar from player_cosmetics_public where player_id = a) is not null then raise exception 'falla 13i2: %', r; end if;
  r := set_my_cosmetics(jsonb_build_object('avatar', 'custom:' || a2));
  if r ->> 'avatar' <> 'custom:' || a2 or (points_summary() #>> '{vip_coins,balance}')::int <> v0 - 1100 then raise exception 'falla 13j: %', r; end if;
  -- un avatar de la tienda en su lugar saca el propio (que sigue guardado)
  r := set_my_cosmetics('{"avatar": "avatar-relampago"}');
  if r ->> 'avatar' <> 'avatar-relampago' then raise exception 'falla 13k: %', r; end if;
  r := set_my_cosmetics(jsonb_build_object('avatar', 'custom:' || a2));
  begin perform set_my_cosmetics(jsonb_build_object('frame', 'custom:' || a2)); raise exception 'falla 13k2';
  exception when raise_exception then if sqlerrm not like 'Ese artículo no es del tipo%' then raise; end if; end;
  begin perform set_my_cosmetics(jsonb_build_object('background', 'custom:' || a2)); raise exception 'falla 13k3';
  exception when raise_exception then if sqlerrm <> 'No tienes ese fondo de miniperfil guardado' then raise; end if; end;
  begin perform set_my_cosmetics('{"avatar": "custom:nada"}'); raise exception 'falla 13k4';
  exception when raise_exception then if sqlerrm <> 'Subida inválida' then raise; end if; end;
  raise notice 'ok 13a: A (VIP) sube, paga cada vez, lo subido queda guardado y vuelve a uno anterior sin pagar';
end $$;

-- A: el tope (5 avatares): la sexta no cobra; borrar una guardada (no la puesta) deja subir otra.
do $$
declare v0 int; r jsonb; i int; a2 uuid := (select id from up where k = 'a2'); a1 uuid := (select id from up where k = 'a1');
begin
  for i in 3..5 loop perform custom_cosmetic_set('avatar', true, 'https://x/a' || i || '.webm', 'https://x/a' || i || '.webp', 550); end loop;
  -- cada subida se pone sola: vuelve a la segunda
  perform set_my_cosmetics(jsonb_build_object('avatar', 'custom:' || a2));
  v0 := (points_summary() #>> '{vip_coins,balance}')::int;
  begin perform custom_cosmetic_set('avatar', true, 'https://x/a6.webm', 'https://x/a6.webp', 550); raise exception 'falla 13l0';
  exception when raise_exception then if sqlerrm <> 'Llegaste a 5 avatares guardados: borra uno para subir otro' then raise; end if; end;
  if (points_summary() #>> '{vip_coins,balance}')::int <> v0 then raise exception 'falla 13l0b: cobró con el tope'; end if;
  r := custom_cosmetic_delete(a1);
  if r ->> 'url' <> 'https://x/a1.webm' or r ->> 'poster_url' <> 'https://x/a1.webp' then raise exception 'falla 13l0c: %', r; end if;
  if (select avatar ->> 'url' from player_cosmetics_public where player_id = '11111111-1111-4111-8111-0000000113a0') <> 'https://x/a2.webm' then
    raise exception 'falla 13l0d: borrar una guardada le sacó la puesta';
  end if;
  begin perform custom_cosmetic_delete(a1); raise exception 'falla 13l0e';
  exception when no_data_found then if sqlerrm <> 'No tienes esa subida guardada' then raise; end if; end;
  begin perform set_my_cosmetics(jsonb_build_object('avatar', 'custom:' || a1)); raise exception 'falla 13l0f';
  exception when raise_exception then if sqlerrm <> 'No tienes ese avatar guardado' then raise; end if; end;
  r := custom_cosmetic_set('avatar', true, 'https://x/a6.webm', 'https://x/a6.webp', 550);
  insert into up values ('a6', (r ->> 'id')::uuid);
  perform set_my_cosmetics(jsonb_build_object('avatar', 'custom:' || a2));
  if (points_summary() #>> '{vip_coins,balance}')::int <> v0 - 550 then raise exception 'falla 13l0g'; end if;
  raise notice 'ok 13a2: tope de 5 sin cobrar; borrar una guardada no toca la puesta y deja subir otra';
end $$;

-- C (sin VIP): lo animado no, el fondo fijo sí; denuncia el avatar de A; no se pone ni borra una subida ajena.
do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-0000000113c0","role":"authenticated"}', true); end $$;
do $$
declare a uuid := '11111111-1111-4111-8111-0000000113a0'; c uuid := '11111111-1111-4111-8111-0000000113c0'; b0 int;
begin
  begin perform custom_cosmetic_set('avatar', true, 'https://x/c.webm', 'https://x/c.webp', 550); raise exception 'falla 13l';
  exception when raise_exception then if sqlerrm not like '%son para los VIP' then raise; end if; end;
  begin perform custom_cosmetic_set('background', true, 'https://x/c.webm', 'https://x/c.webp', 650); raise exception 'falla 13l2';
  exception when raise_exception then if sqlerrm not like '%son para los VIP' then raise; end if; end;
  begin perform custom_cosmetic_set('avatar', false, 'https://x/c.png', null, 550); raise exception 'falla 13l3';
  exception when raise_exception then if sqlerrm <> 'El avatar propio es animado' then raise; end if; end;
  begin perform set_my_cosmetics(jsonb_build_object('background', 'custom:' || (select id from up where k = 'f1'))); raise exception 'falla 13l4';
  exception when raise_exception then if sqlerrm <> 'No tienes ese fondo de miniperfil guardado' then raise; end if; end;
  begin perform custom_cosmetic_delete((select id from up where k = 'f1')); raise exception 'falla 13l5';
  exception when no_data_found then if sqlerrm <> 'No tienes esa subida guardada' then raise; end if; end;
  b0 := (points_summary() #>> '{points,balance}')::int;
  perform custom_cosmetic_set('background', false, 'https://x/c1.webp', null, 500);
  if (points_summary() #>> '{points,balance}')::int <> b0 - 500 then raise exception 'falla 13m'; end if;
  perform profile_media_report(a, 'avatar', 'copyright', 'es de un artista');
  begin perform profile_media_report(a, 'avatar', 'nsfw'); raise exception 'falla 13n';
  exception when raise_exception then if sqlerrm <> 'Ya denunciaste esa imagen' then raise; end if; end;
  begin perform profile_media_report(c, 'background', 'other'); raise exception 'falla 13n2';
  exception when raise_exception then if sqlerrm <> 'No puedes denunciar tu propia imagen' then raise; end if; end;
  begin perform profile_media_report(a, 'cover', 'other'); raise exception 'falla 13n3';
  exception when no_data_found then if sqlerrm <> 'Esa imagen ya no está en el perfil' then raise; end if; end;
  begin perform profile_media_reports_admin(); raise exception 'falla 13n4';
  exception when insufficient_privilege then null; end;
  begin perform admin_custom_clear('22222222-2222-4222-8222-0000000113a0', (select id from up where k = 'a2'), 'x'); raise exception 'falla 13n5';
  exception when insufficient_privilege then null; end;
  raise notice 'ok 13b: sin VIP solo el fondo fijo; denuncia una vez y no lo propio; nada ajeno';
end $$;

-- D (admin): ve la denuncia y saca solo ese avatar (los otros guardados siguen), saca el fondo desde Gestionar y
-- cambia precios y topes.
do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-0000000113d0","role":"authenticated"}', true); end $$;
do $$
declare j jsonb; r jsonb; a uuid := '11111111-1111-4111-8111-0000000113a0'; ua uuid := '22222222-2222-4222-8222-0000000113a0';
begin
  j := profile_media_reports_admin('open', 'avatar');
  if (j ->> 'total')::int <> 1 or not (j #>> '{items,0,current}')::boolean or j #>> '{items,0,url}' <> 'https://x/a2.webm'
     or j #>> '{items,0,profile,id}' <> a::text then
    raise exception 'falla 13o: %', j;
  end if;
  r := profile_media_report_resolve((j #>> '{items,0,id}')::uuid, 'remove');
  if r ->> 'url' <> 'https://x/a2.webm' or r ->> 'poster_url' <> 'https://x/a2.webp' then raise exception 'falla 13p: %', r; end if;
  if (select avatar from player_cosmetics_public where player_id = a) is not null then raise exception 'falla 13q'; end if;
  if (select count(*) from custom_cosmetics where user_id = ua and kind = 'avatar' and cleared_at is null) <> 4 then
    raise exception 'falla 13q2: sacar una imagen tocó las demás guardadas';
  end if;
  if (profile_media_reports_admin('open') ->> 'total')::int <> 0 then raise exception 'falla 13r'; end if;
  if (profile_media_reports_admin('resolved') #>> '{items,0,status}') <> 'removed' then raise exception 'falla 13r2'; end if;
  begin perform profile_media_report_resolve((j #>> '{items,0,id}')::uuid, 'dismiss'); raise exception 'falla 13r3';
  exception when raise_exception then if sqlerrm <> 'Esa denuncia ya se resolvió' then raise; end if; end;
  r := admin_custom_clear(ua, (select id from up where k = 'f1'), 'no respeta las reglas');
  if r ->> 'url' <> 'https://x/f1.webp' then raise exception 'falla 13s: %', r; end if;
  begin perform admin_custom_clear(ua, (select id from up where k = 'f1'), 'otra vez'); raise exception 'falla 13t';
  exception when no_data_found then if sqlerrm <> 'Esa cuenta no tiene esa subida guardada' then raise; end if; end;
  -- una subida guardada que no está puesta también se saca
  r := admin_custom_clear(ua, (select id from up where k = 'a6'), 'tampoco');
  if r ->> 'url' <> 'https://x/a6.webm' then raise exception 'falla 13t2: %', r; end if;
  r := set_points_config('{"custom_bg_static_price": 450, "custom_max_background": 1}');
  if (r ->> 'custom_bg_static_price')::int <> 450 or (r ->> 'custom_max_background')::int <> 1 then raise exception 'falla 13u: %', r; end if;
  begin perform set_points_config('{"custom_max_avatar": 0}'); raise exception 'falla 13u2';
  exception when check_violation then null; end;
  raise notice 'ok 13c: el moderador o el admin saca solo esa imagen con aviso; precios y topes en la configuración';
end $$;
reset role;
do $$ begin
  if (select count(*) from notifications where user_id = '22222222-2222-4222-8222-0000000113a0'
         and type = 'custom_removed' and category = 'account') <> 3 then
    raise exception 'falla 13v: faltan los avisos custom_removed';
  end if;
  raise notice 'ok 13d: 3 avisos custom_removed en account';
end $$;

-- A: fondo animado (tope de fondos en 1, ya sin el fijo que sacó el admin); con el VIP vencido se oculta y no se lo
-- puede poner, y vuelve al renovar. Después lo borra.
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-0000000113a0","role":"authenticated"}', true); end $$;
do $$
declare r jsonb; a uuid := '11111111-1111-4111-8111-0000000113a0';
begin
  begin perform custom_cosmetic_set('background', false, 'https://x/f2.webp', null, 500); raise exception 'falla 13w';
  exception when raise_exception then if sqlerrm <> 'El precio cambió: ahora cuesta 450' then raise; end if; end;
  r := custom_cosmetic_set('background', true, 'https://x/f3.webm', 'https://x/f3.webp', 650);
  insert into up values ('f3', (r ->> 'id')::uuid);
  if (select background ->> 'url' from player_cosmetics_public where player_id = a) <> 'https://x/f3.webm' then raise exception 'falla 13x'; end if;
  begin perform custom_cosmetic_set('background', false, 'https://x/f4.webp', null, 450); raise exception 'falla 13x2';
  exception when raise_exception then if sqlerrm <> 'Llegaste a 1 fondos de miniperfil guardados: borra uno para subir otro' then raise; end if; end;
end $$;
reset role;
do $$
declare a uuid := '11111111-1111-4111-8111-0000000113a0'; ua uuid := '22222222-2222-4222-8222-0000000113a0';
begin
  update vip_memberships set starts_at = least(starts_at, now() - interval '5 days'), ends_at = now() - interval '1 second'
   where user_id = ua and (ends_at is null or ends_at > now());
  if (select background from player_cosmetics_public where player_id = a) is not null then raise exception 'falla 13y: lo animado se ve sin VIP'; end if;
end $$;
set local role authenticated;
do $$ begin
  perform set_my_cosmetics('{"background": null}');
  begin perform set_my_cosmetics(jsonb_build_object('background', 'custom:' || (select id from up where k = 'f3'))); raise exception 'falla 13y2';
  exception when raise_exception then if sqlerrm <> 'Lo animado se usa siendo VIP' then raise; end if; end;
end $$;
reset role;
insert into vip_memberships (user_id, starts_at, ends_at, source)
values ('22222222-2222-4222-8222-0000000113a0', now(), now() + interval '30 days', 'manual');
set local role authenticated;
do $$
declare r jsonb; f3 uuid := (select id from up where k = 'f3');
begin
  r := set_my_cosmetics(jsonb_build_object('background', 'custom:' || f3));
  if (select background ->> 'url' from player_cosmetics_public where player_id = '11111111-1111-4111-8111-0000000113a0') <> 'https://x/f3.webm' then
    raise exception 'falla 13z';
  end if;
  r := custom_cosmetic_delete(f3);
  if r ->> 'url' <> 'https://x/f3.webm' or r ->> 'poster_url' <> 'https://x/f3.webp' then raise exception 'falla 13za: %', r; end if;
  if (select background_custom from user_cosmetics where user_id = auth.uid()) is not null then raise exception 'falla 13zb: sigue puesto'; end if;
  if (select count(*) from custom_cosmetics where cleared_at is null and user_id = auth.uid() and kind = 'background') <> 0 then
    raise exception 'falla 13zc';
  end if;
  raise notice 'ok 13e: lo animado guardado se congela con el VIP vencido y vuelve; el dueño lo borra sin devolución';
end $$;
reset role;

-- 12. La inversa deja la estructura igual que antes.
\i :rev113
do $$
declare d text;
begin
  select string_agg(x.k, ', ') into d from (
    (select * from huella except select * from pg_temp.estructura())
    union (select * from pg_temp.estructura() except select * from huella)) x;
  if d is not null then raise exception 'falla 12: la estructura no quedó igual: %', d; end if;
  raise notice 'ok 12: la inversa deja la estructura idéntica';
end $$;

rollback;
