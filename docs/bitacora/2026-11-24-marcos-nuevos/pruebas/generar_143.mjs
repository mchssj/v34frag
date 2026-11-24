// Genera, desde una sola lista, la migración 143, su inversa y las entradas de catalogo.json (versión 18).
// Uso (desde la raíz del repo): node docs/bitacora/2026-11-24-marcos-nuevos/pruebas/generar_143.mjs
import { readFileSync, writeFileSync } from "node:fs"

// [id, nombre, descripción, archivo, puntos (null: VIP)]
const MARCOS = [
  ["marco-fauces", "Fauces", "Una boca de monstruo con colmillos y la lengua afuera respira alrededor de tu foto.", "fauces", null],
  ["marco-siesta", "Siesta", "Una ovejita cabecea sobre un marco garabateado, se duerme y se despierta de un susto.", "siesta", 550],
  ["marco-siesta-azul", "Siesta azul", "La ovejita dormilona, con el marco garabateado en azul oscuro.", "siesta-azul", null],
  ["marco-mar-de-nubes", "Mar de nubes", "Pixel art nocturno: un mar de nubes violeta corre bajo la luna y las estrellas.", "mar-de-nubes", null],
  ["marco-bosque", "Bosque", "Tu foto vista desde adentro de un bosque en silueta que se mece con el viento.", "bosque", 550],
  ["marco-sabueso", "Sabueso", "Un detective de dibujo animado de los años 30 te examina con su lupa.", "sabueso", null],
  ["marco-terminal", "Terminal", "Un monitor viejo de fósforo verde: tu foto es la pantalla, con líneas de barrido.", "terminal", null],
]
const VIP_PRICE = 450, SORT0 = 4090 // después de Pintura (4080)
const q = (s) => `'${s.replace(/'/g, "''")}'`
const ids = MARCOS.map(([id]) => q(id)).join(", ")
const vips = MARCOS.filter((m) => m[4] === null).length

writeFileSync("supabase/replanteo/143_tienda_marcos_nuevos.sql", `-- 143: 7 marcos nuevos en la tienda (bitácora docs/bitacora/2026-11-24-marcos-nuevos/, Daniel 2026-11-24).
--
-- Archivos en web/frontend/public/cosmetics/marcos/ (SVG animados). Bosque y Siesta, para todos a 550 puntos; los otros
-- ${vips}, exclusivos de VIP a ${VIP_PRICE} monedas VIP. Mismos datos que catalogo.json (versión 18). Va después de la web.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/143_tienda_marcos_nuevos.sql.
begin;

do $$ begin
  if exists (select 1 from public.shop_items where id in (${ids})) then
    raise exception 'replanteo 143: ya se aplicó (hay artículos con estos ids)';
  end if;
end $$;

insert into public.shop_items (id, kind, name, description, file, css_class, vip_only, vip_reward, animated, collection, price, vip_price, active, sort) values
${MARCOS.map(([id, name, desc, file, pts], k) => `  (${q(id)}, 'frame', ${q(name)}, ${q(desc)}, ${q(`marcos/${file}.svg`)}, null, ${pts === null}, false, true, 'cs', ${pts}, ${pts === null ? VIP_PRICE : null}, true, ${SORT0 + 10 * k})`).join(",\n")};

do $$ begin
  if (select count(*) from public.shop_items where id in (${ids}) and vip_only and vip_price = ${VIP_PRICE} and price is null) <> ${vips}
     or (select count(*) from public.shop_items where id in (${ids}) and not vip_only and price = 550) <> ${MARCOS.length - vips} then
    raise exception 'replanteo 143: faltan artículos';
  end if;
end $$;

commit;
`)

writeFileSync("docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/143_tienda_marcos_nuevos.sql", `-- Inversa de la 143: borra los 7 marcos nuevos.
-- Se pierde lo que los jugadores compraron de estos marcos (user_items se borra en cascada) y, si alguno lo tenía
-- equipado, vuelve a no tener marco. Los puntos y las monedas VIP gastados no se devuelven.
-- Si un código canjeable (126) da uno de estos marcos, no se borra nada: primero hay que revocar o cambiar el código.
begin;

do $$ begin
  if exists (select 1 from public.redeem_codes where item_id in (${ids})) then
    raise exception 'inversa 143: hay códigos canjeables que dan estos marcos';
  end if;
end $$;

delete from public.shop_items where id in (${ids});

commit;
`)

const ruta = "web/frontend/public/cosmetics/catalogo.json"
const cat = JSON.parse(readFileSync(ruta, "utf8"))
if (cat.items.some((i) => MARCOS.some(([id]) => id === i.id))) throw new Error("catalogo.json ya tiene estos marcos")
cat.version = 18
for (const [id, name, description, file, pts] of MARCOS)
  cat.items.push({ id, kind: "frame", name, description, file: `marcos/${file}.svg`, css_class: null, vip_only: pts === null, animated: true, price: pts, collection: "cs", vip_reward: false, active: true })
writeFileSync(ruta, JSON.stringify(cat, null, 2) + "\n")
console.log(`143, inversa y catalogo.json (versión 18, ${cat.items.length} artículos)`)
