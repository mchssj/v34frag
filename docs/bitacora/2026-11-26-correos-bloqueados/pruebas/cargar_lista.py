"""Arma el SQL que carga la lista pública de correos temporales en email_domain_blocks (replanteo 148).

    python -I cargar_lista.py > lista.sql        (baja la lista de GitHub)
    python -I cargar_lista.py archivo.conf > lista.sql

Solo agrega los dominios que no están: no toca los que agregó un admin ni las excepciones (blocked = false), así una
carga nueva no vuelve a bloquear uno que un admin desbloqueó. Lista: https://github.com/disposable-email-domains/
disposable-email-domains (CC0).
"""
import re
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")  # en Windows la salida sería cp1252

URL = "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf"
VALIDO = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$")

texto = open(sys.argv[1], encoding="utf-8").read() if len(sys.argv) > 1 else urllib.request.urlopen(URL, timeout=60).read().decode("utf-8")
dominios = sorted({d for d in (l.strip().lower().rstrip(".") for l in texto.splitlines()) if d and not d.startswith("#") and len(d) <= 253 and VALIDO.match(d)})
if len(dominios) < 1000:
    sys.exit(f"la lista vino con {len(dominios)} dominios: demasiado pocos, no se carga")

print("begin;")
print("create temp table _lista (domain text primary key) on commit drop;")
for i in range(0, len(dominios), 1000):
    print("insert into _lista values " + ",".join(f"('{d}')" for d in dominios[i:i + 1000]) + ";")
print("insert into public.email_domain_blocks (domain, source, reason)")
print("  select domain, 'lista', 'Lista pública de correos temporales' from _lista on conflict (domain) do nothing;")
print("select 'en la lista: ' || (select count(*) from _lista) || ', bloqueados: ' || count(*) filter (where blocked)"
      " || ', excepciones: ' || count(*) filter (where not blocked) || ', de admins: ' || count(*) filter (where source = 'admin')"
      " from public.email_domain_blocks;")
print("commit;")
print(f"-- {len(dominios)} dominios", file=sys.stderr)
