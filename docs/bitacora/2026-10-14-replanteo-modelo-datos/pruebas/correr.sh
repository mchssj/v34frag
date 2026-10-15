#!/usr/bin/env bash
# Prueba las migraciones de supabase/replanteo/ en la Supabase LOCAL (nunca en producción).
# Para cada migración, en orden:
#   1. la aplica y corre su prueba (pruebas/NN_*.sql)
#   2. verifica que una segunda aplicación aborte sin cambiar nada
#   3. aplica su inversa (reversas/NN_*.sql) y compara la estructura con la de antes: tiene que ser idéntica
#   4. la vuelve a aplicar, para seguir con la siguiente
# Uso (desde la raíz del repo): docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/correr.sh
set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
bitacora="$(cd "$aqui/.." && pwd)"
raiz="$(cd "$bitacora/../../.." && pwd)"
backend="$raiz/web/backend"
contenedor="supabase_db_$(sed -n 's/^project_id = "\(.*\)"/\1/p' "$backend/supabase/config.toml")"
tmp="$(mktemp -d)"

psql_local() { docker exec -i "$contenedor" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
foto() { psql_local -At < "$aqui/estructura.sql" > "$1"; }

echo "== Base local sin replanteo"
(cd "$backend" && REPLANTEO=0 bash scripts/db-local.sh reset) | grep -E "Cargando|pendiente|omitido|cargado"

for m in "$raiz"/supabase/replanteo/[0-9]*.sql; do
  n="$(basename "$m")"
  echo "== $n"
  foto "$tmp/antes"

  psql_local < "$m" >/dev/null
  psql_local < "$aqui/$n" 2>&1 | grep -E "NOTICE|ERROR" | sed 's/^/   /'

  if psql_local < "$m" >/dev/null 2>&1; then
    echo "   FALLA: se pudo aplicar dos veces"; exit 1
  fi
  echo "   ok: una segunda aplicación aborta"

  psql_local < "$bitacora/reversas/$n" >/dev/null
  foto "$tmp/revertida"
  if ! diff "$tmp/antes" "$tmp/revertida" > "$tmp/diff"; then
    echo "   FALLA: la inversa no deja la estructura igual:"; sed 's/^/     /' "$tmp/diff"; exit 1
  fi
  echo "   ok: la inversa deja la estructura idéntica"

  psql_local < "$m" >/dev/null
  echo "   ok: se vuelve a aplicar después de la inversa"
done

psql_local -c "notify pgrst, 'reload schema';" >/dev/null
rm -rf "$tmp"
echo "== Todo ok"
