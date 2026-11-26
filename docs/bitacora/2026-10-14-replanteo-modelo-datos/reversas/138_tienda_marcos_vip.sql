-- Inversa de la 138: borra los 4 marcos VIP nuevos.
-- Se pierde lo que los jugadores compraron de estos marcos (user_items se borra en cascada) y, si alguno lo tenía
-- equipado, vuelve a no tener marco. Las monedas VIP gastadas no se devuelven.
-- Si un código canjeable (126) da uno de estos marcos, no se borra nada: primero hay que revocar o cambiar el código.
begin;

do $$ begin
  if exists (select 1 from public.redeem_codes where item_id in ('marco-nevada', 'marco-celda', 'marco-polaroid', 'marco-pintura')) then
    raise exception 'inversa 138: hay códigos canjeables que dan estos marcos';
  end if;
end $$;

delete from public.shop_items where id in ('marco-nevada', 'marco-celda', 'marco-polaroid', 'marco-pintura');

commit;
