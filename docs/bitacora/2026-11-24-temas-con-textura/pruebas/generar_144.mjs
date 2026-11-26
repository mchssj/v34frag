// Genera, desde una sola lista, la migración 144, su inversa y las entradas de catalogo.json (versión 19).
// Uso (desde la raíz del repo): node docs/bitacora/2026-11-24-temas-con-textura/pruebas/generar_144.mjs
import { readFileSync, writeFileSync } from "node:fs"

// Mitad solo VIP, a 300 monedas VIP como los demás temas VIP; sorteada al azar (Daniel, 2026-11-25).
const VIP = new Set(["pantallazo", "cuaderno", "baraja", "plano", "curvas", "salar", "paramo", "luciernagas", "bus", "obra"])
// [sufijo del id, nombre, descripción, animado]
const TEMAS = [
  ["tubo", "Monitor de tubo", "Fósforo ámbar con líneas de barrido; cada tanto parpadea.", true],
  ["pantallazo", "Pantallazo azul", "Azul puro y letras blancas, como el cuelgue en plena ronda.", false],
  ["ficha", "Ficha de una hora", "Ticket en amarillo y negro con los bordes perforados.", false],
  ["cuaderno", "Cuaderno de clase", "Hoja cuadriculada con margen rojo. Es un tema claro.", false],
  ["pano", "Paño verde", "Paño de póker con luz al centro y borde de madera.", false],
  ["baraja", "Baraja española", "Reverso de naipe rojo con rombos dorados.", false],
  ["domino", "Dominó", "Fichas negras con puntos marfil y una hilera arriba.", false],
  ["ajedrez", "Ajedrez", "Un tablero de madera que se asoma por la derecha.", false],
  ["plano", "Plano técnico", "Azul de plano con cuadrícula fina y gruesa.", false],
  ["curvas", "Curvas de nivel", "Mapa topográfico verde oliva con acento naranja.", false],
  ["historieta", "Historieta", "Trama de puntos rosa, amarillo fuerte y noche violeta.", false],
  ["tintas", "Dos tintas", "Impresión rosa y celeste con las planchas corridas.", false],
  ["salar", "Salar", "Costra de sal en hexágonos al atardecer.", false],
  ["paramo", "Páramo", "Verde frío con niebla que cruza despacio.", true],
  ["luciernagas", "Luciérnagas", "Monte de noche con luces que se prenden y se apagan.", true],
  ["fileteado", "Fileteado", "Volutas doradas pintadas a mano sobre azul.", false],
  ["azulejo", "Azulejo", "Baldosa pintada azul y blanca con centro amarillo.", false],
  ["bus", "Bus pintado", "Franjas de bus de barrio sobre violeta.", false],
  ["carbono", "Fibra de carbono", "Trama negra con un filo rojo arriba.", false],
  ["obra", "Zona de obra", "Cinta amarilla y negra sobre el nick.", false],
].map(([s, name, description, animated]) => {
  const vip = VIP.has(s)
  return { id: `tema-tex-${s}`, name, description, animated, vip, price: vip ? null : animated ? 450 : 350, vip_price: vip ? 300 : null }
})
const SORT0 = 4160 // después de Terminal (4150)
const q = (s) => `'${s.replace(/'/g, "''")}'`
const ids = TEMAS.map((t) => q(t.id)).join(", ")
const libres = TEMAS.filter((t) => !t.vip)
const anim = libres.filter((t) => t.animated).length
const vips = TEMAS.length - libres.length

writeFileSync("supabase/replanteo/144_tienda_temas_con_textura.sql", `-- 144: 20 temas de perfil con textura en la tienda (bitácora docs/bitacora/2026-11-24-temas-con-textura/, Daniel 2026-11-24).
--
-- Solo CSS (clases tema-tex-* de cosmeticos.css), colección nueva \`texturas\`. ${vips} solo VIP a 300 monedas VIP (sorteados) y, para todos,
-- ${libres.length - anim} fijos a 350 puntos y ${anim} animado a 450. Mismos datos que catalogo.json (versión 19). Va después de la web.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/144_tienda_temas_con_textura.sql.
begin;

do $$ begin
  if exists (select 1 from public.shop_items where id in (${ids})) then
    raise exception 'replanteo 144: ya se aplicó (hay artículos con estos ids)';
  end if;
end $$;

insert into public.shop_items (id, kind, name, description, file, css_class, vip_only, vip_reward, animated, collection, price, vip_price, active, sort) values
${TEMAS.map((t, k) => `  (${q(t.id)}, 'theme', ${q(t.name)}, ${q(t.description)}, null, ${q(t.id)}, ${t.vip}, false, ${t.animated}, 'texturas', ${t.price ?? "null"}, ${t.vip_price ?? "null"}, true, ${SORT0 + 10 * k})`).join(",\n")};

do $$ begin
  if (select count(*) from public.shop_items where collection = 'texturas' and kind = 'theme' and not vip_only and price = 350 and not animated) <> ${libres.length - anim}
     or (select count(*) from public.shop_items where collection = 'texturas' and kind = 'theme' and not vip_only and price = 450 and animated) <> ${anim}
     or (select count(*) from public.shop_items where collection = 'texturas' and kind = 'theme' and vip_only and price is null and vip_price = 300) <> ${vips} then
    raise exception 'replanteo 144: faltan artículos';
  end if;
end $$;

commit;
`)

writeFileSync("docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/144_tienda_temas_con_textura.sql", `-- Inversa de la 144: borra los 20 temas con textura.
-- Se pierde lo que los jugadores compraron de estos temas (user_items se borra en cascada) y, si alguno lo tenía
-- equipado, vuelve a no tener tema. Los puntos gastados no se devuelven.
-- Si un código canjeable (126) da uno de estos temas, no se borra nada: primero hay que revocar o cambiar el código.
begin;

do $$ begin
  if exists (select 1 from public.redeem_codes where item_id in (${ids})) then
    raise exception 'inversa 144: hay códigos canjeables que dan estos temas';
  end if;
end $$;

delete from public.shop_items where id in (${ids});

commit;
`)

const ruta = "web/frontend/public/cosmetics/catalogo.json"
const cat = JSON.parse(readFileSync(ruta, "utf8"))
cat.items = cat.items.filter((i) => !TEMAS.some((t) => t.id === i.id)) // se puede volver a correr
cat.version = 19
cat.collections.texturas = "Texturas"
for (const t of TEMAS)
  cat.items.push({ id: t.id, kind: "theme", name: t.name, description: t.description, file: null, css_class: t.id, vip_only: t.vip, animated: t.animated, price: t.price, collection: "texturas", vip_reward: false, ...(t.vip ? { vip_price: t.vip_price } : {}), active: true })
writeFileSync(ruta, JSON.stringify(cat, null, 2) + "\n")
console.log(`144, inversa y catalogo.json (versión 19, ${cat.items.length} artículos)`)
