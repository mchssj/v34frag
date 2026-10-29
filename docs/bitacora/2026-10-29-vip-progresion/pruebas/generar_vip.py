"""Dibuja el Marco Oro VIP y pone los precios en monedas VIP del catálogo.

Escribe assets/perfil/marcos/vip-oro.svg, suma marco-vip-oro y vip_price/vip_reward a assets/perfil/catalogo.json
(versión 8) y reemplaza el bloque de precios de supabase/migrations/20261029210000_vip_progresion.sql.
Uso (desde la raíz del repo): python docs/bitacora/2026-10-29-vip-progresion/pruebas/generar_vip.py
"""
import json
import math
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[4]
PERFIL = RAIZ / "assets" / "perfil"
SQL = RAIZ / "supabase" / "migrations" / "20261029210000_vip_progresion.sql"

# Precio en monedas VIP de cada tipo (plan, sección 2).
PRECIO_VIP = {"sticker": 200, "name": 500, "theme": 600, "frame": 1000, "background": 1000}


def chispas():
    out = []
    for k, (x, y, s) in enumerate(((30, 60, 7), (228, 40, 6), (232, 200, 8), (22, 214, 6), (128, 246, 5))):
        p = " ".join(f"{x + (s if i % 2 == 0 else s * .3) * math.cos(math.pi / 4 * i):.1f},"
                     f"{y + (s if i % 2 == 0 else s * .3) * math.sin(math.pi / 4 * i):.1f}" for i in range(8))
        out.append(f'  <polygon points="{p}" fill="#fff8d8"><animate attributeName="opacity" values="0;1;0" '
                   f'dur="2.4s" begin="{k * .48:.2f}s" repeatCount="indefinite"/></polygon>')
    return "\n".join(out)


def marco():
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset=".3" stop-color="#f2c14a"/>
      <stop offset=".55" stop-color="#9a6a14"/><stop offset=".8" stop-color="#f7d76a"/><stop offset="1" stop-color="#b8862a"/></linearGradient>
    <linearGradient id="br" x1="0" y1="0" x2="1" y2="1"><stop offset=".35" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".5" stop-color="#fff" stop-opacity=".7"/><stop offset=".65" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="m"><rect width="256" height="256" fill="#fff"/><rect x="34" y="34" width="188" height="188" rx="8" fill="#000"/></mask>
    <filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>
  <rect x="20" y="20" width="216" height="216" rx="18" fill="#f2c14a" opacity=".55" filter="url(#g)" mask="url(#m)">
    <animate attributeName="opacity" values=".35;.75;.35" dur="2.6s" repeatCount="indefinite"/></rect>
  <rect x="22" y="22" width="212" height="212" rx="16" fill="url(#o)" mask="url(#m)"/>
  <rect x="29" y="29" width="198" height="198" rx="11" fill="none" stroke="#5a3c08" stroke-width="2" opacity=".6"/>
  <rect x="24" y="24" width="208" height="208" rx="14" fill="none" stroke="#fff6c8" stroke-width="1.5" opacity=".7"/>
  <rect x="-256" y="0" width="256" height="256" fill="url(#br)" mask="url(#m)">
    <animate attributeName="x" values="-256;256;256" keyTimes="0;.45;1" dur="3.5s" repeatCount="indefinite"/></rect>
  <g transform="translate(128 20)">
    <path d="M-34 10L-40 -18L-18 -2L0 -26L18 -2L40 -18L34 10Z" fill="url(#o)" stroke="#5a3c08" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="-36" y="8" width="72" height="9" rx="3" fill="url(#o)" stroke="#5a3c08" stroke-width="2.5"/>
    <circle cx="0" cy="-26" r="4" fill="#ff3b6b"/><circle cx="-40" cy="-18" r="3.5" fill="#3bd1ff"/><circle cx="40" cy="-18" r="3.5" fill="#3bd1ff"/>
    <circle cx="0" cy="2" r="4.5" fill="#ff3b6b" stroke="#5a3c08" stroke-width="1.5"/>
  </g>
  <g transform="translate(128 232)">
    <rect x="-38" y="-14" width="76" height="28" rx="8" fill="#1b1407" stroke="url(#o)" stroke-width="4"/>
    <text y="8" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="21" letter-spacing="3" fill="url(#o)">VIP</text>
  </g>
{chispas()}
</svg>
'''


def main():
    (PERFIL / "marcos" / "vip-oro.svg").write_text(marco(), encoding="utf-8", newline="\n")
    ruta = PERFIL / "catalogo.json"
    cat = json.loads(ruta.read_text(encoding="utf-8"))
    cat["version"] = 8
    cat["collections"]["vip"] = "VIP"
    cat["note"] = ("Catálogo de cosméticos del perfil. vip_only: artículo VIP, se compra con monedas VIP (vip_price) "
                   "siendo VIP y se usa mientras la cuenta sea VIP. vip_reward: viene con el VIP, sin comprarlo "
                   "(el Marco Oro VIP). price: puntos normales; lo pone la base (shop_items). collection agrupa los "
                   "artículos para la tienda. Las colecciones de series son homenajes originales: sin logos, "
                   "personajes ni nombres registrados.")
    items = [i for i in cat["items"] if i["id"] != "marco-vip-oro"]
    for i in items:
        i["vip_reward"] = False
        i["vip_price"] = PRECIO_VIP[i["kind"]] if i["vip_only"] else None
    items.insert(0, {"id": "marco-vip-oro", "kind": "frame", "name": "Oro VIP",
                     "description": "Viene con el VIP: marco de oro con corona.", "file": "marcos/vip-oro.svg",
                     "css_class": None, "vip_only": True, "animated": True, "price": None, "collection": "vip",
                     "vip_reward": True, "vip_price": None})
    cat["items"] = items
    ruta.write_text(json.dumps(cat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

    casos = " ".join(f"when '{k}' then {v}" for k, v in PRECIO_VIP.items())
    bloque = (f"update public.shop_items set vip_price = case kind {casos} end\n"
              f" where vip_only and not vip_reward and vip_price is null;")
    texto = SQL.read_text(encoding="utf-8")
    ini, fin = "-- --- inicio: precios VIP generados ---", "-- --- fin: precios VIP generados ---"
    a, b = texto.index(ini) + len(ini), texto.index(fin)
    SQL.write_text(texto[:a] + "\n" + bloque + "\n" + texto[b:], encoding="utf-8", newline="\n")
    print(f"{sum(1 for i in items if i['vip_only'])} artículos VIP; catálogo con {len(items)} artículos")


if __name__ == "__main__":
    main()
