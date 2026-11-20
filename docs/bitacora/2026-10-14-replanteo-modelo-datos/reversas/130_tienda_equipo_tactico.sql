-- Inversa de la 130: borra los 22 artículos de Equipo táctico y los otros nombres y temas.
-- Se pierde lo que los jugadores compraron de estos artículos (user_items se borra en cascada) y, si alguno lo tenía
-- equipado, vuelve a no tener ese cosmético. Los puntos o monedas gastados no se devuelven.
-- Si un código canjeable (126) da uno de estos artículos, no se borra nada: primero hay que revocar o cambiar el código.
begin;

do $$ begin
  if exists (select 1 from public.redeem_codes where item_id in ('nombre-flashbang', 'nombre-humo', 'nombre-c4', 'nombre-nocturna', 'nombre-radar', 'nombre-headshot', 'tema-flashbang', 'tema-humo', 'tema-c4', 'tema-nocturna', 'tema-radar', 'tema-headshot', 'nombre-killfeed', 'nombre-spray', 'nombre-tormenta', 'nombre-eclipse', 'tema-medianoche', 'tema-cobre', 'tema-lavanda', 'tema-turquesa', 'tema-vino', 'tema-menta')) then
    raise exception 'inversa 130: hay códigos canjeables que dan estos artículos';
  end if;
end $$;

delete from public.shop_items where id in ('nombre-flashbang', 'nombre-humo', 'nombre-c4', 'nombre-nocturna', 'nombre-radar', 'nombre-headshot', 'tema-flashbang', 'tema-humo', 'tema-c4', 'tema-nocturna', 'tema-radar', 'tema-headshot', 'nombre-killfeed', 'nombre-spray', 'nombre-tormenta', 'nombre-eclipse', 'tema-medianoche', 'tema-cobre', 'tema-lavanda', 'tema-turquesa', 'tema-vino', 'tema-menta');

commit;
