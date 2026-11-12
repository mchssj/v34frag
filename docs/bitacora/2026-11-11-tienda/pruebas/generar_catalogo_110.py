"""Genera la carga de shop_items del replanteo 110 desde web/frontend/public/cosmetics/catalogo.json.

Reemplaza el bloque entre "--- inicio: catálogo generado ---" y "--- fin: catálogo generado ---".
Precios: los de generar_catalogo_sql.py (puntos) y generar_vip.py (monedas VIP).
Uso (desde la raíz del repo): python docs/bitacora/2026-11-11-tienda/pruebas/generar_catalogo_110.py
"""
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[4]
CAT = json.loads((RAIZ / "web" / "frontend" / "public" / "cosmetics" / "catalogo.json").read_text(encoding="utf-8"))
SQL = RAIZ / "supabase" / "replanteo" / "110_economia_tienda.sql"
PRECIO_VIP = {"sticker": 200, "name": 500, "theme": 600, "frame": 1000, "background": 1000}


def precio(i):
    if i["vip_only"]:
        return None
    cs = i["collection"] == "cs"
    k = i["kind"]
    if k == "sticker":
        return 150 if cs else 200
    if k == "name":
        return (600 if i["animated"] else 500) if cs else 400
    if k == "theme":
        return 700 if cs else 600
    if k == "background":
        return 1000 if cs else 800
    if cs:
        return 1200 if i["animated"] else 900
    return 1000 if i["collection"].startswith("paises") else 900


def precio_vip(i):
    if not i["vip_only"] or i.get("vip_reward"):
        return None
    return i.get("vip_price") or PRECIO_VIP[i["kind"]]


def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


filas = []
for n, i in enumerate(CAT["items"]):
    filas.append("  (" + ", ".join(q(x) for x in [
        i["id"], i["kind"], i["name"], i["description"], i["file"], i["css_class"], i["vip_only"],
        bool(i.get("vip_reward")), i["animated"], i["collection"], precio(i), precio_vip(i), (n + 1) * 10]) + ")")
bloque = ("insert into public.shop_items (id, kind, name, description, file, css_class, vip_only, vip_reward, animated,"
          " collection, price, vip_price, sort) values\n" + ",\n".join(filas) + ";")
texto = SQL.read_text(encoding="utf-8")
ini, fin = "-- --- inicio: catálogo generado ---", "-- --- fin: catálogo generado ---"
a, b = texto.index(ini) + len(ini), texto.index(fin)
SQL.write_text(texto[:a] + "\n" + bloque + "\n" + texto[b:], encoding="utf-8", newline="\n")
print(f"{len(filas)} artículos")
