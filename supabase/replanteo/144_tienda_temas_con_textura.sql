-- 144: 20 temas de perfil con textura en la tienda (bitácora docs/bitacora/2026-11-24-temas-con-textura/, Daniel 2026-11-24).
--
-- Solo CSS (clases tema-tex-* de cosmeticos.css), colección nueva `texturas`. 10 solo VIP a 300 monedas VIP (sorteados) y, para todos,
-- 9 fijos a 350 puntos y 1 animado a 450. Mismos datos que catalogo.json (versión 19). Va después de la web.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/144_tienda_temas_con_textura.sql.
begin;

do $$ begin
  if exists (select 1 from public.shop_items where id in ('tema-tex-tubo', 'tema-tex-pantallazo', 'tema-tex-ficha', 'tema-tex-cuaderno', 'tema-tex-pano', 'tema-tex-baraja', 'tema-tex-domino', 'tema-tex-ajedrez', 'tema-tex-plano', 'tema-tex-curvas', 'tema-tex-historieta', 'tema-tex-tintas', 'tema-tex-salar', 'tema-tex-paramo', 'tema-tex-luciernagas', 'tema-tex-fileteado', 'tema-tex-azulejo', 'tema-tex-bus', 'tema-tex-carbono', 'tema-tex-obra')) then
    raise exception 'replanteo 144: ya se aplicó (hay artículos con estos ids)';
  end if;
end $$;

insert into public.shop_items (id, kind, name, description, file, css_class, vip_only, vip_reward, animated, collection, price, vip_price, active, sort) values
  ('tema-tex-tubo', 'theme', 'Monitor de tubo', 'Fósforo ámbar con líneas de barrido; cada tanto parpadea.', null, 'tema-tex-tubo', false, false, true, 'texturas', 450, null, true, 4160),
  ('tema-tex-pantallazo', 'theme', 'Pantallazo azul', 'Azul puro y letras blancas, como el cuelgue en plena ronda.', null, 'tema-tex-pantallazo', true, false, false, 'texturas', null, 300, true, 4170),
  ('tema-tex-ficha', 'theme', 'Ficha de una hora', 'Ticket en amarillo y negro con los bordes perforados.', null, 'tema-tex-ficha', false, false, false, 'texturas', 350, null, true, 4180),
  ('tema-tex-cuaderno', 'theme', 'Cuaderno de clase', 'Hoja cuadriculada con margen rojo. Es un tema claro.', null, 'tema-tex-cuaderno', true, false, false, 'texturas', null, 300, true, 4190),
  ('tema-tex-pano', 'theme', 'Paño verde', 'Paño de póker con luz al centro y borde de madera.', null, 'tema-tex-pano', false, false, false, 'texturas', 350, null, true, 4200),
  ('tema-tex-baraja', 'theme', 'Baraja española', 'Reverso de naipe rojo con rombos dorados.', null, 'tema-tex-baraja', true, false, false, 'texturas', null, 300, true, 4210),
  ('tema-tex-domino', 'theme', 'Dominó', 'Fichas negras con puntos marfil y una hilera arriba.', null, 'tema-tex-domino', false, false, false, 'texturas', 350, null, true, 4220),
  ('tema-tex-ajedrez', 'theme', 'Ajedrez', 'Un tablero de madera que se asoma por la derecha.', null, 'tema-tex-ajedrez', false, false, false, 'texturas', 350, null, true, 4230),
  ('tema-tex-plano', 'theme', 'Plano técnico', 'Azul de plano con cuadrícula fina y gruesa.', null, 'tema-tex-plano', true, false, false, 'texturas', null, 300, true, 4240),
  ('tema-tex-curvas', 'theme', 'Curvas de nivel', 'Mapa topográfico verde oliva con acento naranja.', null, 'tema-tex-curvas', true, false, false, 'texturas', null, 300, true, 4250),
  ('tema-tex-historieta', 'theme', 'Historieta', 'Trama de puntos rosa, amarillo fuerte y noche violeta.', null, 'tema-tex-historieta', false, false, false, 'texturas', 350, null, true, 4260),
  ('tema-tex-tintas', 'theme', 'Dos tintas', 'Impresión rosa y celeste con las planchas corridas.', null, 'tema-tex-tintas', false, false, false, 'texturas', 350, null, true, 4270),
  ('tema-tex-salar', 'theme', 'Salar', 'Costra de sal en hexágonos al atardecer.', null, 'tema-tex-salar', true, false, false, 'texturas', null, 300, true, 4280),
  ('tema-tex-paramo', 'theme', 'Páramo', 'Verde frío con niebla que cruza despacio.', null, 'tema-tex-paramo', true, false, true, 'texturas', null, 300, true, 4290),
  ('tema-tex-luciernagas', 'theme', 'Luciérnagas', 'Monte de noche con luces que se prenden y se apagan.', null, 'tema-tex-luciernagas', true, false, true, 'texturas', null, 300, true, 4300),
  ('tema-tex-fileteado', 'theme', 'Fileteado', 'Volutas doradas pintadas a mano sobre azul.', null, 'tema-tex-fileteado', false, false, false, 'texturas', 350, null, true, 4310),
  ('tema-tex-azulejo', 'theme', 'Azulejo', 'Baldosa pintada azul y blanca con centro amarillo.', null, 'tema-tex-azulejo', false, false, false, 'texturas', 350, null, true, 4320),
  ('tema-tex-bus', 'theme', 'Bus pintado', 'Franjas de bus de barrio sobre violeta.', null, 'tema-tex-bus', true, false, false, 'texturas', null, 300, true, 4330),
  ('tema-tex-carbono', 'theme', 'Fibra de carbono', 'Trama negra con un filo rojo arriba.', null, 'tema-tex-carbono', false, false, false, 'texturas', 350, null, true, 4340),
  ('tema-tex-obra', 'theme', 'Zona de obra', 'Cinta amarilla y negra sobre el nick.', null, 'tema-tex-obra', true, false, false, 'texturas', null, 300, true, 4350);

do $$ begin
  if (select count(*) from public.shop_items where collection = 'texturas' and kind = 'theme' and not vip_only and price = 350 and not animated) <> 9
     or (select count(*) from public.shop_items where collection = 'texturas' and kind = 'theme' and not vip_only and price = 450 and animated) <> 1
     or (select count(*) from public.shop_items where collection = 'texturas' and kind = 'theme' and vip_only and price is null and vip_price = 300) <> 10 then
    raise exception 'replanteo 144: faltan artículos';
  end if;
end $$;

commit;
