-- 130: colección Equipo táctico y otros nombres y temas en la tienda
-- (bitácora docs/bitacora/2026-11-20-tienda-equipo-tactico/, Daniel 2026-11-20).
--
-- 22 artículos que son solo CSS (web/frontend/src/features/shop/cosmeticos.css, clase = id): 10 efectos de nombre y
-- 12 temas. Colección nueva «tactico» (Equipo táctico) y el resto en «cs». Mismos datos que
-- web/frontend/public/cosmetics/catalogo.json (versión 15). Precios iniciales; el admin los cambia después.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/130_tienda_equipo_tactico.sql.
begin;

do $$ begin
  if exists (select 1 from public.shop_items where id in ('nombre-flashbang', 'nombre-humo', 'nombre-c4', 'nombre-nocturna', 'nombre-radar', 'nombre-headshot', 'tema-flashbang', 'tema-humo', 'tema-c4', 'tema-nocturna', 'tema-radar', 'tema-headshot', 'nombre-killfeed', 'nombre-spray', 'nombre-tormenta', 'nombre-eclipse', 'tema-medianoche', 'tema-cobre', 'tema-lavanda', 'tema-turquesa', 'tema-vino', 'tema-menta')) then
    raise exception 'replanteo 130: ya se aplicó (hay artículos con estos ids)';
  end if;
end $$;

insert into public.shop_items (id, kind, name, description, file, css_class, vip_only, vip_reward, animated, collection, price, vip_price, active, sort) values
  ('nombre-flashbang', 'name', 'Flashbang', 'Cada tanto tu nombre se pone blanco, se desenfoca y vuelve de a poco.', null, 'nombre-flashbang', false, false, true, 'tactico', 300, null, true, 3700),
  ('nombre-humo', 'name', 'Humo', 'Las letras se esfuman en humo gris y vuelven a aparecer.', null, 'nombre-humo', false, false, true, 'tactico', 300, null, true, 3710),
  ('nombre-c4', 'name', 'C4', 'Brillo rojo que late cada vez más rápido, como el pitido de la bomba.', null, 'nombre-c4', false, false, true, 'tactico', 300, null, true, 3720),
  ('nombre-nocturna', 'name', 'Visión nocturna', 'Verde fósforo con líneas de monitor que bajan.', null, 'nombre-nocturna', false, false, true, 'tactico', 300, null, true, 3730),
  ('nombre-radar', 'name', 'Radar', 'Un barrido verde recorre tu nombre.', null, 'nombre-radar', false, false, true, 'tactico', 300, null, true, 3740),
  ('nombre-headshot', 'name', 'Headshot', 'Cada tanto, un impacto: tu nombre se sacude y se pone rojo.', null, 'nombre-headshot', false, false, true, 'tactico', 300, null, true, 3750),
  ('tema-flashbang', 'theme', 'Flashbang', 'Blanco frío; el borde destella y se apaga.', null, 'tema-flashbang', true, false, true, 'tactico', null, 300, true, 3760),
  ('tema-humo', 'theme', 'Humo', 'Gris humo con un resplandor que respira.', null, 'tema-humo', true, false, true, 'tactico', null, 300, true, 3770),
  ('tema-c4', 'theme', 'C4', 'Rojo oscuro con un borde que late cada vez más rápido.', null, 'tema-c4', true, false, true, 'tactico', null, 300, true, 3780),
  ('tema-nocturna', 'theme', 'Visión nocturna', 'Verde sobre negro con líneas y un barrido que baja.', null, 'tema-nocturna', true, false, true, 'tactico', null, 300, true, 3790),
  ('tema-radar', 'theme', 'Radar', 'Un barrido verde da la vuelta al borde.', null, 'tema-radar', true, false, true, 'tactico', null, 300, true, 3800),
  ('tema-headshot', 'theme', 'Headshot', 'Carmesí; cada tanto un golpe rojo en el borde.', null, 'tema-headshot', true, false, true, 'tactico', null, 300, true, 3810),
  ('nombre-killfeed', 'name', 'Kill feed', 'Como el aviso de muerte del juego: recuadro oscuro con borde rojo.', null, 'nombre-killfeed', false, false, false, 'cs', 250, null, true, 3820),
  ('nombre-spray', 'name', 'Spray', 'Letras de aerosol, inclinadas, con la pintura que chorrea.', null, 'nombre-spray', false, false, true, 'cs', 250, null, true, 3830),
  ('nombre-tormenta', 'name', 'Tormenta', 'Azul de tormenta con relámpagos que iluminan las letras.', null, 'nombre-tormenta', true, false, true, 'cs', null, 250, true, 3840),
  ('nombre-eclipse', 'name', 'Eclipse', 'Letras negras con una corona de luz que gira alrededor.', null, 'nombre-eclipse', true, false, true, 'cs', null, 250, true, 3850),
  ('tema-medianoche', 'theme', 'Medianoche', 'Azul marino.', null, 'tema-medianoche', false, false, false, 'cs', 350, null, true, 3860),
  ('tema-cobre', 'theme', 'Cobre', 'Cobre cálido.', null, 'tema-cobre', false, false, false, 'cs', 350, null, true, 3870),
  ('tema-lavanda', 'theme', 'Lavanda', 'Violeta suave.', null, 'tema-lavanda', false, false, false, 'cs', 350, null, true, 3880),
  ('tema-turquesa', 'theme', 'Turquesa', 'Verde agua.', null, 'tema-turquesa', false, false, false, 'cs', 350, null, true, 3890),
  ('tema-vino', 'theme', 'Vino', 'Rojo vino.', null, 'tema-vino', false, false, false, 'cs', 350, null, true, 3900),
  ('tema-menta', 'theme', 'Menta', 'Verde menta.', null, 'tema-menta', false, false, false, 'cs', 350, null, true, 3910);

do $$ begin
  if (select count(*) from public.shop_items where id in ('nombre-flashbang', 'nombre-humo', 'nombre-c4', 'nombre-nocturna', 'nombre-radar', 'nombre-headshot', 'tema-flashbang', 'tema-humo', 'tema-c4', 'tema-nocturna', 'tema-radar', 'tema-headshot', 'nombre-killfeed', 'nombre-spray', 'nombre-tormenta', 'nombre-eclipse', 'tema-medianoche', 'tema-cobre', 'tema-lavanda', 'tema-turquesa', 'tema-vino', 'tema-menta')) <> 22 then
    raise exception 'replanteo 130: faltan artículos';
  end if;
end $$;

commit;
