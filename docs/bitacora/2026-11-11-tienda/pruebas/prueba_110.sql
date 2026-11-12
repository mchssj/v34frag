-- Pruebas del replanteo 110 (economía, tienda e inventario). Todo dentro de una transacción que se deshace.
-- Uso: psql -v ON_ERROR_STOP=1 -f prueba_110.sql sobre una base con el 110 aplicado. Cada paso falla con
-- "PRUEBA n:" si algo no da lo esperado.
begin;

-- Cuentas: normal (n), VIP (v) y admin (a), cada una con su ficha.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'n@prueba.test', '{"tag":"normal_t"}', now(), now()),
       ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v@prueba.test', '{"tag":"vip_t"}', now(), now()),
       ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@prueba.test', '{"tag":"admin_t"}', now(), now());
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a3';
insert into players (id, nick, user_id, steam_id) values
  ('00000000-0000-0000-0000-0000000000b1', 'normal_t', '00000000-0000-0000-0000-0000000000a1', 'STEAM_0:1:9001'),
  ('00000000-0000-0000-0000-0000000000b2', 'vip_t', '00000000-0000-0000-0000-0000000000a2', 'STEAM_0:1:9002'),
  ('00000000-0000-0000-0000-0000000000b4', 'sin_cuenta', null, 'STEAM_0:1:9004');
update economy_config set starts_at = now() - interval '1 day';
insert into teams (id, name, kind) values ('00000000-0000-0000-0000-0000000000e1', 'Equipo prueba 1', 'official'),
  ('00000000-0000-0000-0000-0000000000e2', 'Equipo prueba 2', 'official');
insert into vip_memberships (id, user_id, starts_at, ends_at, source)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2', now() - interval '1 hour', now() + interval '30 days', 'manual');

do $$ begin
  if (select vip_coins from wallet_of('00000000-0000-0000-0000-0000000000a2')) <> 100 then
    raise exception 'PRUEBA 1: la bienvenida VIP tiene que dar 100 monedas';
  end if;
end $$;

-- Una partida: mix terminado, gana el bando 1. n y v en el 1, la ficha sin cuenta en el 2.
create function pg_temp.partida(p_kind text, p_side smallint) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  -- Oficiales y PCW llevan equipos: el bando ganador sale de winner (trigger matches_winner_side).
  if p_kind in ('official', 'pcw') then
    insert into matches (kind, status, played_at, map, team1, team2, winner)
    values (p_kind, 'finished', now(), 'de_dust2', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2',
            case p_side when 1 then '00000000-0000-0000-0000-0000000000e1'::uuid else '00000000-0000-0000-0000-0000000000e2'::uuid end)
    returning id into v_id;
  else
    insert into matches (kind, status, played_at, map, winner_side) values (p_kind, 'finished', now(), 'de_dust2', p_side)
    returning id into v_id;
  end if;
  insert into match_player_stats (match_id, steam_id, team, player_id, elo_after) values
    (v_id, 'STEAM_0:1:9001', 1, '00000000-0000-0000-0000-0000000000b1', 1000),
    (v_id, 'STEAM_0:1:9002', 1, '00000000-0000-0000-0000-0000000000b2', 1000),
    (v_id, 'STEAM_0:1:9004', 2, '00000000-0000-0000-0000-0000000000b4', 1000);
  return v_id;
end $$;

select pg_temp.partida('mix', 1::smallint);
do $$ begin
  -- 10 (partida) + 5 (victoria) + 10 (primera del día) = 25 para los dos; monedas VIP solo para v.
  if (select points from wallet_of('00000000-0000-0000-0000-0000000000a1')) <> 25 then raise exception 'PRUEBA 2: n tiene que tener 25 puntos'; end if;
  if (select vip_coins from wallet_of('00000000-0000-0000-0000-0000000000a1')) <> 0 then raise exception 'PRUEBA 2: n no gana monedas VIP'; end if;
  if (select points from wallet_of('00000000-0000-0000-0000-0000000000a2')) <> 25 then raise exception 'PRUEBA 2: v tiene que tener 25 puntos'; end if;
  if (select vip_coins from wallet_of('00000000-0000-0000-0000-0000000000a2')) <> 125 then raise exception 'PRUEBA 2: v tiene que tener 100 + 25 monedas'; end if;
end $$;

-- La misma fila recibe otro ELO (recálculo): no paga de nuevo.
update match_player_stats set elo_after = 1010 where steam_id = 'STEAM_0:1:9001';
do $$ begin
  if (select points from wallet_of('00000000-0000-0000-0000-0000000000a1')) <> 25 then raise exception 'PRUEBA 3: un recálculo no paga de nuevo'; end if;
end $$;

-- Tope: 9 partidas más perdidas (10 en el día) y la 11 ya no da nada.
select pg_temp.partida('mm', 2::smallint) from generate_series(1, 10);
do $$ begin
  -- 25 + 9 × 10 = 115; la 11 no suma.
  if (select points from wallet_of('00000000-0000-0000-0000-0000000000a1')) <> 115 then
    raise exception 'PRUEBA 4: con el tope de 10 tiene que tener 115, tiene %', (select points from wallet_of('00000000-0000-0000-0000-0000000000a1'));
  end if;
  if matches_awarded_today('00000000-0000-0000-0000-0000000000a1') <> 10 then raise exception 'PRUEBA 4: 10 partidas con premio hoy'; end if;
end $$;

-- Oficial: sin tope. PCW: nada.
select pg_temp.partida('official', 1::smallint);
select pg_temp.partida('pcw', 1::smallint);
do $$ begin
  -- + 15 (oficial) + 5 (victoria) = 135.
  if (select points from wallet_of('00000000-0000-0000-0000-0000000000a1')) <> 135 then
    raise exception 'PRUEBA 5: la oficial suma 20 sin tope y la PCW nada; tiene %', (select points from wallet_of('00000000-0000-0000-0000-0000000000a1'));
  end if;
end $$;

-- Antes de starts_at no se da nada.
update economy_config set starts_at = now() + interval '1 day';
select pg_temp.partida('official', 1::smallint);
update economy_config set starts_at = now() - interval '1 day';
do $$ begin
  if (select points from wallet_of('00000000-0000-0000-0000-0000000000a1')) <> 135 then raise exception 'PRUEBA 6: antes de starts_at no hay premio'; end if;
end $$;

-- Una partida borrada devuelve lo que dio (fila 'reversal'); otra vez no.
do $$ declare v_m uuid; v_antes int; begin
  v_antes := (select points from wallet_of('00000000-0000-0000-0000-0000000000a1'));
  v_m := (select ref::uuid from point_ledger where source = 'official' and user_id = '00000000-0000-0000-0000-0000000000a1' limit 1);
  delete from matches where id = v_m;
  if (select points from wallet_of('00000000-0000-0000-0000-0000000000a1')) <> v_antes - 20 then
    raise exception 'PRUEBA 6b: borrar la oficial ganada devuelve 20; tiene %', (select points from wallet_of('00000000-0000-0000-0000-0000000000a1'));
  end if;
  -- Para el resto de las pruebas, se recupera con un regalo.
  insert into point_ledger (user_id, currency, amount, source, ref, label)
  values ('00000000-0000-0000-0000-0000000000a1', 'points', 20, 'grant', 'prueba-6b', 'Prueba');
end $$;

-- Medallas: una de plata (100) y una de temporada en el puesto 5 (season_10: 250).
insert into medal_definitions (id, key, template, title, metric, aggregation, target, design)
values ('00000000-0000-0000-0000-0000000000d1', 'prueba_plata', 'prueba', 'Prueba', 'kills', 'total', 1, '{"metal":"plata"}');
insert into player_medals (player_id, title, definition_id, source) values ('00000000-0000-0000-0000-0000000000b1', 'Prueba', '00000000-0000-0000-0000-0000000000d1', 'auto');
insert into seasons (id, number, name, starts_at, ends_at, top_n, min_matches, reset_pct, reset_floor, tiers, status, closed_at)
values ('00000000-0000-0000-0000-0000000000f1', 99, 'Temporada de prueba', now() - interval '30 days', now(), 20, 1, 0, 0, (select tiers from season_config limit 1), 'closed', now());
insert into player_medals (player_id, title, season_id, rank, tier, source)
values ('00000000-0000-0000-0000-0000000000b1', 'Temporada', '00000000-0000-0000-0000-0000000000f1', 5, 'Top 10', 'season');
do $$ begin
  if (select points from wallet_of('00000000-0000-0000-0000-0000000000a1')) <> 485 then
    raise exception 'PRUEBA 7: 135 + 100 + 250 = 485; tiene %', (select points from wallet_of('00000000-0000-0000-0000-0000000000a1'));
  end if;
  if not exists (select 1 from point_ledger where user_id = '00000000-0000-0000-0000-0000000000a1' and source = 'season' and amount = 250) then
    raise exception 'PRUEBA 7: falta la fila de temporada';
  end if;
end $$;

-- Como la cuenta n: comprar, equipar, deseos, billetera e inventario.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

do $$ declare r jsonb; begin
  r := shop_buy('sticker-gg');
  if (r->>'price_paid')::int <> coalesce((select price from shop_catalog where id = 'sticker-gg'), -1) then raise exception 'PRUEBA 8: precio pagado'; end if;
  begin perform shop_buy('sticker-gg'); raise exception 'PRUEBA 8: comprar dos veces tiene que fallar';
  exception when unique_violation then null; end;
  begin perform shop_buy('marco-serie-ninja'); raise exception 'PRUEBA 9: lo VIP no se compra sin ser VIP';
  exception when insufficient_privilege then null; end;
  begin perform shop_buy('marco-vip-oro'); raise exception 'PRUEBA 9: el premio VIP no se compra';
  exception when raise_exception then null; end;
  begin perform shop_buy('marco-fuego'); raise exception 'PRUEBA 10: sin saldo tiene que fallar';
  exception when raise_exception then null; end;
  perform set_my_cosmetics('{"stickers":["sticker-gg"]}');
  begin perform set_my_cosmetics('{"frame":"marco-fuego"}'); raise exception 'PRUEBA 11: no se equipa lo que no tiene';
  exception when insufficient_privilege then null; end;
  if not wishlist_toggle('marco-fuego') then raise exception 'PRUEBA 12: agregar a deseos'; end if;
  if wishlist_toggle('marco-fuego') then raise exception 'PRUEBA 12: sacar de deseos'; end if;
  r := my_wallet();
  if (r->>'matches_today')::int <> 10 or (r->>'vip')::boolean then raise exception 'PRUEBA 13: billetera %', r; end if;
  if (select count(*) from my_inventory() where equipped) <> 1 then raise exception 'PRUEBA 13: un artículo puesto'; end if;
  if (select count(*) from my_ledger()) < 5 then raise exception 'PRUEBA 13: historial'; end if;
  begin perform my_ledger('00000000-0000-0000-0000-0000000000a2'); raise exception 'PRUEBA 13: no ve el historial de otro';
  exception when insufficient_privilege then null; end;
  begin perform admin_points_grant('00000000-0000-0000-0000-0000000000a1', 'points', 1000, 'x'); raise exception 'PRUEBA 14: no es admin';
  exception when insufficient_privilege then null; end;
end $$;

-- Como admin: regalo y configuración.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select admin_points_grant('00000000-0000-0000-0000-0000000000a1', 'points', 5000, 'Prueba');
select admin_points_grant('00000000-0000-0000-0000-0000000000a2', 'vip', 3000, 'Prueba');
select admin_economy_rule_set('match', 12, null, null);
do $$ begin
  if (select points from economy_rules where key = 'match') <> 12 then raise exception 'PRUEBA 15: regla'; end if;
  if (select count(*) from admin_wallets()) < 2 then raise exception 'PRUEBA 15: admin_wallets'; end if;
end $$;
select admin_economy_rule_set('match', 10, null, null);

-- n compra un pack de país; v compra lo VIP con monedas y se le vence el VIP.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ declare r jsonb; v_before int; begin
  v_before := (my_wallet()->>'points')::int;
  r := shop_buy_bundle('pais-ar');
  if (r->>'items')::int <> 4 then raise exception 'PRUEBA 16: el pack de Argentina trae 4: %', r; end if;
  if (r->>'price_paid')::int <> round((r->>'full')::int * 0.8) then raise exception 'PRUEBA 16: 20 %% de descuento: %', r; end if;
  if (my_wallet()->>'points')::int <> v_before - (r->>'price_paid')::int then raise exception 'PRUEBA 16: saldo'; end if;
  begin perform shop_buy_bundle('pais-ar'); raise exception 'PRUEBA 16: ya tiene todo';
  exception when unique_violation then null; end;
  perform set_my_cosmetics('{"frame":"marco-pais-ar","theme":"tema-pais-ar"}');
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
do $$ declare r jsonb; begin
  r := shop_buy('marco-serie-ninja');
  if r->>'currency' <> 'vip' then raise exception 'PRUEBA 17: lo VIP se paga en monedas'; end if;
  perform set_my_cosmetics('{"frame":"marco-serie-ninja"}');
  begin perform set_my_cosmetics('{"background":"fondo-neon"}'); raise exception 'PRUEBA 17: no tiene fondo-neon';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update vip_memberships set revoked_at = now() where user_id = '00000000-0000-0000-0000-0000000000a2';
do $$ begin
  if (select frame from player_cosmetics_public where player_id = '00000000-0000-0000-0000-0000000000b2') is not null then
    raise exception 'PRUEBA 18: con el VIP vencido el marco VIP no se ve';
  end if;
  if (select frame from player_cosmetics_public where player_id = '00000000-0000-0000-0000-0000000000b1') <> 'marco-pais-ar' then
    raise exception 'PRUEBA 18: el perfil público muestra lo puesto';
  end if;
  if not exists (select 1 from user_items where user_id = '00000000-0000-0000-0000-0000000000a2' and item_id = 'marco-serie-ninja') then
    raise exception 'PRUEBA 18: lo VIP comprado queda en el inventario (congelado)';
  end if;
end $$;

select 'OK: todas las pruebas del 110 pasaron' as resultado;
rollback;
