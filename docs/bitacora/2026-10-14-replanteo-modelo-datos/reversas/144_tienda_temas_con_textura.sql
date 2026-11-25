-- Inversa de la 144: borra los 20 temas con textura.
-- Se pierde lo que los jugadores compraron de estos temas (user_items se borra en cascada) y, si alguno lo tenía
-- equipado, vuelve a no tener tema. Los puntos gastados no se devuelven.
-- Si un código canjeable (126) da uno de estos temas, no se borra nada: primero hay que revocar o cambiar el código.
begin;

do $$ begin
  if exists (select 1 from public.redeem_codes where item_id in ('tema-tex-tubo', 'tema-tex-pantallazo', 'tema-tex-ficha', 'tema-tex-cuaderno', 'tema-tex-pano', 'tema-tex-baraja', 'tema-tex-domino', 'tema-tex-ajedrez', 'tema-tex-plano', 'tema-tex-curvas', 'tema-tex-historieta', 'tema-tex-tintas', 'tema-tex-salar', 'tema-tex-paramo', 'tema-tex-luciernagas', 'tema-tex-fileteado', 'tema-tex-azulejo', 'tema-tex-bus', 'tema-tex-carbono', 'tema-tex-obra')) then
    raise exception 'inversa 144: hay códigos canjeables que dan estos temas';
  end if;
end $$;

delete from public.shop_items where id in ('tema-tex-tubo', 'tema-tex-pantallazo', 'tema-tex-ficha', 'tema-tex-cuaderno', 'tema-tex-pano', 'tema-tex-baraja', 'tema-tex-domino', 'tema-tex-ajedrez', 'tema-tex-plano', 'tema-tex-curvas', 'tema-tex-historieta', 'tema-tex-tintas', 'tema-tex-salar', 'tema-tex-paramo', 'tema-tex-luciernagas', 'tema-tex-fileteado', 'tema-tex-azulejo', 'tema-tex-bus', 'tema-tex-carbono', 'tema-tex-obra');

commit;
