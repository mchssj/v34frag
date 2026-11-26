-- 138: 4 marcos VIP nuevos en la tienda
-- (bitácora docs/bitacora/2026-11-23-marcos-vip/, Daniel 2026-11-23).
--
-- Archivos en web/frontend/public/cosmetics/marcos/ (WebP y SVG animados). Hechos con la guía de arte
-- (docs/guia_y_flujo_de_arte_conceptual_estilo_steam.md). Los 4 son exclusivos de VIP, a 450 monedas VIP como los
-- demás marcos VIP. Mismos datos que web/frontend/public/cosmetics/catalogo.json (versión 17). Va después de la web.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/138_tienda_marcos_vip.sql.
begin;

do $$ begin
  if exists (select 1 from public.shop_items where id in ('marco-nevada', 'marco-celda', 'marco-polaroid', 'marco-pintura')) then
    raise exception 'replanteo 138: ya se aplicó (hay artículos con estos ids)';
  end if;
end $$;

insert into public.shop_items (id, kind, name, description, file, css_class, vip_only, vip_reward, animated, collection, price, vip_price, active, sort) values
  ('marco-nevada', 'frame', 'Nevada', 'Una chibi de gorro rosa se asoma entre la nieve mientras caen copos.', 'marcos/nevada.webp', null, true, false, true, 'cs', null, 450, true, 4050),
  ('marco-celda', 'frame', 'Celda', 'Dos puños esposados trepan por los barrotes y los doblan para escapar.', 'marcos/celda.svg', null, true, false, true, 'cs', null, 450, true, 4060),
  ('marco-polaroid', 'frame', 'Polaroid', 'Fotos instantáneas viejas con clip y cinta, y un velo de película antigua que parpadea sobre tu foto.', 'marcos/polaroid.webp', null, true, false, true, 'cs', null, 450, true, 4070),
  ('marco-pintura', 'frame', 'Pintura', 'Una ventana de programa de dibujo de los 90 en rosa pastel: tu foto es el lienzo.', 'marcos/pintura.svg', null, true, false, true, 'cs', null, 450, true, 4080);

do $$ begin
  if (select count(*) from public.shop_items where id in ('marco-nevada', 'marco-celda', 'marco-polaroid', 'marco-pintura') and vip_only and vip_price = 450) <> 4 then
    raise exception 'replanteo 138: faltan artículos';
  end if;
end $$;

commit;
