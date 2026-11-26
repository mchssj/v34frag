-- 143: 7 marcos nuevos en la tienda (bitácora docs/bitacora/2026-11-24-marcos-nuevos/, Daniel 2026-11-24).
--
-- Archivos en web/frontend/public/cosmetics/marcos/ (SVG animados). Bosque y Siesta, para todos a 550 puntos; los otros
-- 5, exclusivos de VIP a 450 monedas VIP. Mismos datos que catalogo.json (versión 18). Va después de la web.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/143_tienda_marcos_nuevos.sql.
begin;

do $$ begin
  if exists (select 1 from public.shop_items where id in ('marco-fauces', 'marco-siesta', 'marco-siesta-azul', 'marco-mar-de-nubes', 'marco-bosque', 'marco-sabueso', 'marco-terminal')) then
    raise exception 'replanteo 143: ya se aplicó (hay artículos con estos ids)';
  end if;
end $$;

insert into public.shop_items (id, kind, name, description, file, css_class, vip_only, vip_reward, animated, collection, price, vip_price, active, sort) values
  ('marco-fauces', 'frame', 'Fauces', 'Una boca de monstruo con colmillos y la lengua afuera respira alrededor de tu foto.', 'marcos/fauces.svg', null, true, false, true, 'cs', null, 450, true, 4090),
  ('marco-siesta', 'frame', 'Siesta', 'Una ovejita cabecea sobre un marco garabateado, se duerme y se despierta de un susto.', 'marcos/siesta.svg', null, false, false, true, 'cs', 550, null, true, 4100),
  ('marco-siesta-azul', 'frame', 'Siesta azul', 'La ovejita dormilona, con el marco garabateado en azul oscuro.', 'marcos/siesta-azul.svg', null, true, false, true, 'cs', null, 450, true, 4110),
  ('marco-mar-de-nubes', 'frame', 'Mar de nubes', 'Pixel art nocturno: un mar de nubes violeta corre bajo la luna y las estrellas.', 'marcos/mar-de-nubes.svg', null, true, false, true, 'cs', null, 450, true, 4120),
  ('marco-bosque', 'frame', 'Bosque', 'Tu foto vista desde adentro de un bosque en silueta que se mece con el viento.', 'marcos/bosque.svg', null, false, false, true, 'cs', 550, null, true, 4130),
  ('marco-sabueso', 'frame', 'Sabueso', 'Un detective de dibujo animado de los años 30 te examina con su lupa.', 'marcos/sabueso.svg', null, true, false, true, 'cs', null, 450, true, 4140),
  ('marco-terminal', 'frame', 'Terminal', 'Un monitor viejo de fósforo verde: tu foto es la pantalla, con líneas de barrido.', 'marcos/terminal.svg', null, true, false, true, 'cs', null, 450, true, 4150);

do $$ begin
  if (select count(*) from public.shop_items where id in ('marco-fauces', 'marco-siesta', 'marco-siesta-azul', 'marco-mar-de-nubes', 'marco-bosque', 'marco-sabueso', 'marco-terminal') and vip_only and vip_price = 450 and price is null) <> 5
     or (select count(*) from public.shop_items where id in ('marco-fauces', 'marco-siesta', 'marco-siesta-azul', 'marco-mar-de-nubes', 'marco-bosque', 'marco-sabueso', 'marco-terminal') and not vip_only and price = 550) <> 2 then
    raise exception 'replanteo 143: faltan artículos';
  end if;
end $$;

commit;
