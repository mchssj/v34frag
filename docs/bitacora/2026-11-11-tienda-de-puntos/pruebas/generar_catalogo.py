"""Genera la carga de shop_items de supabase/replanteo/119_tienda.sql (antes 113) desde web/frontend/public/cosmetics/catalogo.json.

Reemplaza el bloque entre "--- inicio: catálogo generado ---" y "--- fin: catálogo generado ---".
Precios en puntos: el `price` de cada artículo del catálogo (desde la versión 14, el que Daniel dejó en su base local el
2026-11-14); si un artículo no lo trae, las reglas de precio() de abajo. Precio en monedas VIP: el del catálogo. `active`:
si está a la venta (si no viene, sí). Comprueba que existan los archivos de cada artículo.
Uso (desde la raíz del repo): python -I docs/bitacora/2026-11-11-tienda-de-puntos/pruebas/generar_catalogo.py
"""
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[4]
DIR = RAIZ / "web" / "frontend" / "public" / "cosmetics"
CAT = json.loads((DIR / "catalogo.json").read_text(encoding="utf-8"))
SQL = RAIZ / "supabase" / "replanteo" / "119_tienda.sql"


def precio(i):
    """Precio inicial en puntos. Lo VIP no tiene: se compra con monedas VIP.

    Daniel, 2026-11-14 (bitácora 2026-11-13-avatar-y-fondo-propios): los de Kyan divididos por 2,5, redondeados a 50,
    y 50 más. Antes: stickers 150-200, nombres 400-600, temas 600-700, marcos 900-1200, fondos 800-1000, avatares 1000.
    """
    if i["vip_only"]:
        return None
    cs = i["collection"] == "cs"
    k = i["kind"]
    if k == "sticker":
        return 100 if cs else 150
    if k == "name":
        return (300 if i["animated"] else 250) if cs else 200
    if k == "theme":
        return 350 if cs else 300
    if k == "frame":
        if cs:
            return 550 if i["animated"] else 400
        return 450 if i["collection"].startswith("paises") else 400
    if k == "background":
        return 450 if cs else 350
    if k == "avatar":
        return 450
    raise ValueError(k)


def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


faltan = [i["file"] for i in CAT["items"] if i["file"] and not (DIR / i["file"]).is_file()]
if faltan:
    sys.exit("Faltan archivos: " + ", ".join(faltan))

cols = ["id", "kind", "name", "description", "file", "css_class", "vip_only", "vip_reward", "animated", "collection",
        "price", "vip_price", "active", "sort"]
filas = []
for n, i in enumerate(CAT["items"]):
    vals = [i["id"], i["kind"], i["name"], i["description"], i["file"], i["css_class"], i["vip_only"],
            bool(i.get("vip_reward")), i["animated"], i["collection"], i["price"] if "active" in i else precio(i),
            None if i.get("vip_reward") else i.get("vip_price"), i.get("active", True), (n + 1) * 10]
    filas.append("  (" + ", ".join(q(v) for v in vals) + ")")
bloque = (f"insert into public.shop_items ({', '.join(cols)}) values\n" + ",\n".join(filas) + ";\n"
          "do $$ begin\n"
          f"  if (select count(*) from public.shop_items) <> {len(filas)} then raise exception 'replanteo 119: faltan artículos'; end if;\n"
          "end $$;\n")
INI, FIN = "-- --- inicio: catálogo generado ---\n", "-- --- fin: catálogo generado ---"
s = SQL.read_text(encoding="utf-8")
a, b = s.index(INI) + len(INI), s.index(FIN)
SQL.write_text(s[:a] + bloque + s[b:], encoding="utf-8", newline="\n")
print(len(filas), "artículos")
