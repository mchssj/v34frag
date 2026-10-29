"""Genera la carga de shop_items de supabase/migrations/20261029180000_tienda.sql desde assets/perfil/catalogo.json.

Reemplaza el bloque entre "--- inicio: catálogo generado ---" y "--- fin: catálogo generado ---".
Uso (desde la raíz del repo): python docs/bitacora/2026-10-29-tienda-web/pruebas/generar_catalogo_sql.py
"""
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[4]
CAT = json.loads((RAIZ / "assets" / "perfil" / "catalogo.json").read_text(encoding="utf-8"))
SQL = RAIZ / "supabase" / "migrations" / "20261029180000_tienda.sql"


def precio(i):
    """Precio inicial en puntos. Los VIP no tienen: se usan con el VIP."""
    if i["vip_only"]:
        return None
    cs = i["collection"] == "cs"
    if i["kind"] == "sticker":
        return 150 if cs else 200
    if i["kind"] == "name":
        return (600 if i["animated"] else 500) if cs else 400
    if i["kind"] == "theme":
        return 700 if cs else 600
    if i["kind"] == "frame":
        if cs:
            return 1200 if i["animated"] else 900
        return 1000 if i["collection"].startswith("paises") else 900
    raise ValueError(i["kind"])


def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


filas = []
# Los fondos (kind background) van en 20261029200000_fondo_miniperfil.sql (generar_fondos.py) y el Marco Oro VIP
# en 20261029210000_vip_progresion.sql (generar_vip.py).
for n, i in enumerate(x for x in CAT["items"] if x["kind"] != "background" and not x.get("vip_reward")):
    filas.append("  (" + ", ".join(q(x) for x in [i["id"], i["kind"], i["name"], i["description"], i["file"], i["css_class"],
                                                    i["vip_only"], i["animated"], i["collection"], precio(i), (n + 1) * 10]) + ")")
bloque = ("insert into public.shop_items (id, kind, name, description, file, css_class, vip_only, animated, collection, price, sort) values\n"
          + ",\n".join(filas)
          + "\non conflict (id) do update set kind = excluded.kind, name = excluded.name, description = excluded.description,\n"
            "  file = excluded.file, css_class = excluded.css_class, vip_only = excluded.vip_only, animated = excluded.animated,\n"
            "  collection = excluded.collection, sort = excluded.sort,\n"
            "  price = case when excluded.vip_only then null else shop_items.price end;\n")
INI, FIN = "-- --- inicio: catálogo generado ---\n", "-- --- fin: catálogo generado ---"
s = SQL.read_text(encoding="utf-8")
a, b = s.index(INI) + len(INI), s.index(FIN)
SQL.write_text(s[:a] + bloque + s[b:], encoding="utf-8")
print(len(filas), "artículos")
