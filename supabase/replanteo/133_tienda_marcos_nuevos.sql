-- 133: 13 marcos nuevos en la tienda
-- (bitácora docs/bitacora/2026-11-20-marcos-nuevos/, Daniel 2026-11-20).
--
-- Archivos en web/frontend/public/cosmetics/marcos/ (SVG animados y WebP, uno fijo). Hechos con la guía de arte
-- (docs/guia_y_flujo_de_arte_conceptual_estilo_steam.md). Destellos, Conejo y Synthwave son exclusivos de VIP.
-- Mismos datos que web/frontend/public/cosmetics/catalogo.json (versión 16). Precios iniciales; el admin los cambia después.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/133_tienda_marcos_nuevos.sql.
begin;

do $$ begin
  if exists (select 1 from public.shop_items where id in ('marco-cyberpunk', 'marco-plasma-liquido', 'marco-plasma-fuego', 'marco-boceto', 'marco-boceto-tiza', 'marco-destellos', 'marco-conejo', 'marco-energia-violeta', 'marco-energia-toxico', 'marco-energia-ambar', 'marco-energia-hielo', 'marco-energia-magenta', 'marco-synthwave')) then
    raise exception 'replanteo 133: ya se aplicó (hay artículos con estos ids)';
  end if;
end $$;

insert into public.shop_items (id, kind, name, description, file, css_class, vip_only, vip_reward, animated, collection, price, vip_price, active, sort) values
  ('marco-cyberpunk', 'frame', 'Cyberpunk', 'Placas, circuitos y luces de neón.', 'marcos/cyberpunk.webp', null, false, false, false, 'cs', 550, null, true, 3920),
  ('marco-plasma-liquido', 'frame', 'Plasma líquido', 'Agua azul que corre por el borde.', 'marcos/plasma-liquido.webp', null, false, false, true, 'cs', 550, null, true, 3930),
  ('marco-plasma-fuego', 'frame', 'Plasma de fuego', 'Fuego líquido que corre por el borde.', 'marcos/plasma-fuego.webp', null, false, false, true, 'cs', 550, null, true, 3940),
  ('marco-boceto', 'frame', 'Boceto', 'Trazos de tinta negra que tiemblan como un dibujo animado.', 'marcos/boceto.webp', null, false, false, true, 'cs', 550, null, true, 3950),
  ('marco-boceto-tiza', 'frame', 'Boceto de tiza', 'Trazos de tiza blanca que tiemblan como un dibujo animado.', 'marcos/boceto-tiza.webp', null, false, false, true, 'cs', 550, null, true, 3960),
  ('marco-destellos', 'frame', 'Destellos', 'Estrellas y una luna que se encienden por turnos en cada esquina.', 'marcos/destellos.svg', null, true, false, true, 'cs', null, 450, true, 3970),
  ('marco-conejo', 'frame', 'Conejo', 'Un conejo que se asoma, se sorprende y se agacha contento entre nubes rosas.', 'marcos/conejo.svg', null, true, false, true, 'cs', null, 450, true, 3980),
  ('marco-energia-violeta', 'frame', 'Energía violeta', 'Una línea de energía violeta con chispas y destellos que recorren el borde.', 'marcos/energia-violeta.svg', null, false, false, true, 'cs', 550, null, true, 3990),
  ('marco-energia-toxico', 'frame', 'Energía tóxica', 'Una línea de energía verde tóxico con chispas y destellos que recorren el borde.', 'marcos/energia-toxico.svg', null, false, false, true, 'cs', 550, null, true, 4000),
  ('marco-energia-ambar', 'frame', 'Energía ámbar', 'Una línea de energía ámbar con chispas y destellos que recorren el borde.', 'marcos/energia-ambar.svg', null, false, false, true, 'cs', 550, null, true, 4010),
  ('marco-energia-hielo', 'frame', 'Energía de hielo', 'Una línea de energía de hielo con chispas y destellos que recorren el borde.', 'marcos/energia-hielo.svg', null, false, false, true, 'cs', 550, null, true, 4020),
  ('marco-energia-magenta', 'frame', 'Energía magenta', 'Una línea de energía magenta con chispas y destellos que recorren el borde.', 'marcos/energia-magenta.svg', null, false, false, true, 'cs', 550, null, true, 4030),
  ('marco-synthwave', 'frame', 'Synthwave', 'Sol retro de franjas y una grilla neón que avanza en perspectiva.', 'marcos/synthwave.webp', null, true, false, true, 'cs', null, 450, true, 4040);

do $$ begin
  if (select count(*) from public.shop_items where id in ('marco-cyberpunk', 'marco-plasma-liquido', 'marco-plasma-fuego', 'marco-boceto', 'marco-boceto-tiza', 'marco-destellos', 'marco-conejo', 'marco-energia-violeta', 'marco-energia-toxico', 'marco-energia-ambar', 'marco-energia-hielo', 'marco-energia-magenta', 'marco-synthwave')) <> 13 then
    raise exception 'replanteo 133: faltan artículos';
  end if;
end $$;

commit;
