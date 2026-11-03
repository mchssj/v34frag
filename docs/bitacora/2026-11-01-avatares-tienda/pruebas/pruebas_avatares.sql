-- Prueba de 20261101120000_avatares_fondos.sql, sobre una base con el stub y las migraciones de la tienda.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into public.profiles (id) values
  ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into public.players (id, user_id, steam_id) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001', 'STEAM_0:0:1'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000002', 'STEAM_0:0:2');

do $$
declare n int; v jsonb; a text;
begin
  select count(*) into n from shop_items where kind = 'avatar';
  assert n = 24, 'tienen que ser 24 avatares: ' || n;
  select count(*) into n from shop_items where kind = 'avatar' and vip_only;
  assert n = 12, '12 avatares VIP: ' || n;
  select count(*) into n from shop_items where id like 'fondo-extra-%';
  assert n = 12, '12 fondos nuevos: ' || n;
  select count(*) into n from shop_items where vip_only and vip_price is null and not vip_reward;
  assert n = 0, 'todo lo VIP tiene precio en monedas: ' || n;

  -- Sin el artículo no se puede equipar.
  perform set_config('test.uid', '00000000-0000-0000-0000-000000000001', true);
  begin
    perform set_my_cosmetics('{"avatar": "avatar-rana"}');
    assert false, 'equipó un avatar que no tiene';
  exception when raise_exception then
    assert sqlerrm like 'Todavía no tenés%', sqlerrm;
  end;

  -- Con el artículo se equipa y se ve en la vista pública.
  insert into user_items (user_id, item_id, price_paid) values ('00000000-0000-0000-0000-000000000001', 'avatar-rana', 0);
  v := set_my_cosmetics('{"avatar": "avatar-rana"}');
  assert v ->> 'avatar' = 'avatar-rana', v::text;
  select avatar into a from player_cosmetics_public where user_id = '00000000-0000-0000-0000-000000000001';
  assert a = 'avatar-rana', 'la vista no lo muestra';

  -- Un fondo no entra como avatar.
  begin
    perform set_my_cosmetics('{"avatar": "fondo-extra-gatos"}');
    assert false, 'aceptó un fondo como avatar';
  exception when raise_exception then
    assert sqlerrm like 'Ese artículo no es del tipo%', sqlerrm;
  end;

  -- Lo demás sigue igual y se puede sacar.
  v := set_my_cosmetics('{"avatar": null}');
  assert v ->> 'avatar' is null, v::text;

  -- Un avatar VIP equipado deja de verse sin VIP.
  insert into user_items (user_id, item_id, price_paid) values ('00000000-0000-0000-0000-000000000001', 'avatar-oni', 0);
  update user_cosmetics set avatar = 'avatar-oni' where user_id = '00000000-0000-0000-0000-000000000001';
  select avatar into a from player_cosmetics_public where user_id = '00000000-0000-0000-0000-000000000001';
  assert a is null, 'el avatar VIP se ve sin VIP';

  raise notice 'todo bien';
end $$;

rollback;
