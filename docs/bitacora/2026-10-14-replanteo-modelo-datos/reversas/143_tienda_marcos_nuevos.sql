-- Inversa de la 143: borra los 7 marcos nuevos.
-- Se pierde lo que los jugadores compraron de estos marcos (user_items se borra en cascada) y, si alguno lo tenía
-- equipado, vuelve a no tener marco. Los puntos y las monedas VIP gastados no se devuelven.
-- Si un código canjeable (126) da uno de estos marcos, no se borra nada: primero hay que revocar o cambiar el código.
begin;

do $$ begin
  if exists (select 1 from public.redeem_codes where item_id in ('marco-fauces', 'marco-siesta', 'marco-siesta-azul', 'marco-mar-de-nubes', 'marco-bosque', 'marco-sabueso', 'marco-terminal')) then
    raise exception 'inversa 143: hay códigos canjeables que dan estos marcos';
  end if;
end $$;

delete from public.shop_items where id in ('marco-fauces', 'marco-siesta', 'marco-siesta-azul', 'marco-mar-de-nubes', 'marco-bosque', 'marco-sabueso', 'marco-terminal');

commit;
