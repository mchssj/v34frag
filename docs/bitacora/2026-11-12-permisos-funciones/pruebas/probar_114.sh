#!/usr/bin/env bash
# Prueba de la 118 sobre la copia de producción de la base local (web/backend/scripts/copia-produccion.sh), contra la
# base de referencia (referencia.sh). Deja la copia CON la 118 aplicada, como va a quedar producción.
#   1. Antes: la copia tiene permisos de más (comparar.sh da diferencias).
#   2. Aplica la 118: comparar.sh da 0 diferencias.
#   3. Por la API local, anon no puede ejecutar season_close_run ni csstv_after_ingest; el plugin (csstv_ingest con un
#      token falso) sigue llegando a la función.
#   4. La inversa vuelve exactamente a los permisos de antes; se aplica otra vez la 118.
set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
raiz="$(cd "$aqui/../../../.." && pwd)"
C="supabase_db_$(sed -n 's/^project_id = "\(.*\)"/\1/p' "$raiz/web/backend/supabase/config.toml")"
comparar() { bash "$aqui/comparar.sh" local:referencia_permisos local:postgres "$1" > /dev/null; }
aplicar() { tr -d '\r' < "$1" | docker exec -i "$C" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q > /dev/null; }
tmp="$(mktemp -d)"
falla() { echo "FALLA: $*" >&2; exit 1; }

if comparar "$tmp/antes.txt"; then falla "1: la copia ya no tiene permisos de más (¿ya tiene la 118?)"; fi
echo "ok 1: antes, $(wc -l < "$tmp/antes.txt") objetos con permisos de más"

# La referencia con la 118: las migraciones desde cero, incluida esta (la de matches da todas las columnas menos link_code).
bash "$aqui/referencia.sh" 118 referencia_118 > /dev/null
aplicar "$raiz/supabase/replanteo/118_permisos.sql"
bash "$aqui/comparar.sh" local:referencia_118 local:postgres "$tmp/despues.txt" > /dev/null   || falla "2: después de la 118 quedan $(wc -l < "$tmp/despues.txt") diferencias con la referencia armada hasta la 118"
echo "ok 2: con la 118, los permisos son los de las migraciones armadas desde cero (también hasta la 118)"

# La API local (Kong de la Supabase local) con la clave pública.
st="$(cd "$raiz/web/backend" && pnpm exec supabase status -o json 2>/dev/null)"
url="$(python -I -c 'import json,sys; print(json.load(sys.stdin)["API_URL"])' <<< "$st")"
anon="$(python -I -c 'import json,sys; print(json.load(sys.stdin)["ANON_KEY"])' <<< "$st")"
rpc() { curl -s -o "$tmp/r.json" -w '%{http_code}' -X POST "$url/rest/v1/rpc/$1" -H "apikey: $anon" -H "Authorization: Bearer $anon" -H 'Content-Type: application/json' -d "$2"; }
z='00000000-0000-4000-8000-000000000114'
for f in "season_close_run|{\"p_season\":\"$z\",\"p_by\":\"$z\"}" "csstv_after_ingest|{\"p_match\":\"$z\",\"p\":{},\"p_source\":\"prueba\"}" "notify_due|{}"; do
  code="$(rpc "${f%%|*}" "${f#*|}")"
  grep -q '"42501"' "$tmp/r.json" || falla "3: anon llegó a ${f%%|*} (HTTP $code: $(cat "$tmp/r.json"))"
done
# Un servidor que no existe: la función rechaza el token (no un 42501 de permisos, ni un 404 de PostgREST).
code="$(rpc csstv_ingest "{\"p_server\":\"$z\",\"p\":{}}")"
[[ "$code" != 404 ]] || falla "3: PostgREST no encuentra csstv_ingest"
grep -q '"42501"' "$tmp/r.json" && falla "3: el plugin ya no llega a csstv_ingest"
echo "ok 3: anon no ejecuta season_close_run, csstv_after_ingest ni notify_due; el plugin sigue llegando a csstv_ingest (HTTP $code)"

aplicar "$raiz/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/118_permisos.sql"
comparar "$tmp/inversa.txt" || true
diff -q "$tmp/antes.txt" "$tmp/inversa.txt" > /dev/null || falla "4: la inversa no volvió a los permisos de antes"
aplicar "$raiz/supabase/replanteo/118_permisos.sql"
bash "$aqui/comparar.sh" local:referencia_118 local:postgres "$tmp/final.txt" > /dev/null || falla "4: al volver a aplicar la 118 quedan diferencias"
echo "ok 4: la inversa vuelve a los permisos de antes y la 118 se puede volver a aplicar"
