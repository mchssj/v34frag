// Genera, desde una sola lista, la migración 138, su inversa y las entradas de catalogo.json (versión 17).
// Uso (desde la raíz del repo): node docs/bitacora/2026-11-23-marcos-vip/pruebas/generar_138.mjs
import { readFileSync, writeFileSync } from "node:fs"

const MARCOS = [
  ["marco-nevada", "Nevada", "Una chibi de gorro rosa se asoma entre la nieve mientras caen copos.", "marcos/nevada.webp"],
  ["marco-celda", "Celda", "Dos puños esposados trepan por los barrotes y los doblan para escapar.", "marcos/celda.svg"],
  ["marco-polaroid", "Polaroid", "Fotos instantáneas viejas con clip y cinta, y un velo de película antigua que parpadea sobre tu foto.", "marcos/polaroid.webp"],
  ["marco-pintura", "Pintura", "Una ventana de programa de dibujo de los 90 en rosa pastel: tu foto es el lienzo.", "marcos/pintura.svg"],
]
const VIP_PRICE = 450, SORT0 = 4050 // como los demás marcos VIP; después de Synthwave (4040)
const q = (s) => `'${s.replace(/'/g, "''")}'`
const ids = MARCOS.map(([id]) => q(id)).join(", ")

writeFileSync("supabase/replanteo/138_tienda_marcos_vip.sql", `-- 138: 4 marcos VIP nuevos en la tienda
-- (bitácora docs/bitacora/2026-11-23-marcos-vip/, Daniel 2026-11-23).
--
-- Archivos en web/frontend/public/cosmetics/marcos/ (WebP y SVG animados). Hechos con la guía de arte
-- (docs/guia_y_flujo_de_arte_conceptual_estilo_steam.md). Los 4 son exclusivos de VIP, a ${VIP_PRICE} monedas VIP como los
-- demás marcos VIP. Mismos datos que web/frontend/public/cosmetics/catalogo.json (versión 17). Va después de la web.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/138_tienda_marcos_vip.sql.
begin;

do $$ begin
  if exists (select 1 from public.shop_items where id in (${ids})) then
    raise exception 'replanteo 138: ya se aplicó (hay artículos con estos ids)';
  end if;
end $$;

insert into public.shop_items (id, kind, name, description, file, css_class, vip_only, vip_reward, animated, collection, price, vip_price, active, sort) values
${MARCOS.map(([id, name, desc, file], k) => `  (${q(id)}, 'frame', ${q(name)}, ${q(desc)}, ${q(file)}, null, true, false, true, 'cs', null, ${VIP_PRICE}, true, ${SORT0 + 10 * k})`).join(",\n")};

do $$ begin
  if (select count(*) from public.shop_items where id in (${ids}) and vip_only and vip_price = ${VIP_PRICE}) <> ${MARCOS.length} then
    raise exception 'replanteo 138: faltan artículos';
  end if;
end $$;

commit;
`)

writeFileSync("docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/138_tienda_marcos_vip.sql", `-- Inversa de la 138: borra los 4 marcos VIP nuevos.
-- Se pierde lo que los jugadores compraron de estos marcos (user_items se borra en cascada) y, si alguno lo tenía
-- equipado, vuelve a no tener marco. Las monedas VIP gastadas no se devuelven.
-- Si un código canjeable (126) da uno de estos marcos, no se borra nada: primero hay que revocar o cambiar el código.
begin;

do $$ begin
  if exists (select 1 from public.redeem_codes where item_id in (${ids})) then
    raise exception 'inversa 138: hay códigos canjeables que dan estos marcos';
  end if;
end $$;

delete from public.shop_items where id in (${ids});

commit;
`)

const ruta = "web/frontend/public/cosmetics/catalogo.json"
const cat = JSON.parse(readFileSync(ruta, "utf8"))
if (cat.items.some((i) => MARCOS.some(([id]) => id === i.id))) throw new Error("catalogo.json ya tiene estos marcos")
cat.version = 17
for (const [id, name, description, file] of MARCOS)
  cat.items.push({ id, kind: "frame", name, description, file, css_class: null, vip_only: true, animated: true, price: null, collection: "cs", vip_reward: false, active: true })
writeFileSync(ruta, JSON.stringify(cat, null, 2) + "\n")
console.log(`138, inversa y catalogo.json (versión 17, ${cat.items.length} artículos)`)
