-- Inversa de la 133: borra los 13 marcos nuevos.
-- Se pierde lo que los jugadores compraron de estos marcos (user_items se borra en cascada) y, si alguno lo tenía
-- equipado, vuelve a no tener marco. Los puntos o monedas gastados no se devuelven.
-- Si un código canjeable (126) da uno de estos marcos, no se borra nada: primero hay que revocar o cambiar el código.
begin;

do $$ begin
  if exists (select 1 from public.redeem_codes where item_id in ('marco-cyberpunk', 'marco-plasma-liquido', 'marco-plasma-fuego', 'marco-boceto', 'marco-boceto-tiza', 'marco-destellos', 'marco-conejo', 'marco-energia-violeta', 'marco-energia-toxico', 'marco-energia-ambar', 'marco-energia-hielo', 'marco-energia-magenta', 'marco-synthwave')) then
    raise exception 'inversa 133: hay códigos canjeables que dan estos marcos';
  end if;
end $$;

delete from public.shop_items where id in ('marco-cyberpunk', 'marco-plasma-liquido', 'marco-plasma-fuego', 'marco-boceto', 'marco-boceto-tiza', 'marco-destellos', 'marco-conejo', 'marco-energia-violeta', 'marco-energia-toxico', 'marco-energia-ambar', 'marco-energia-hielo', 'marco-energia-magenta', 'marco-synthwave');

commit;
