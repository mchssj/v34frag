#!/usr/bin/env bash
# Arma la prueba del replanteo 107 con la 107 y su inversa adentro (sin sus begin/commit) y la escribe por stdout.
# Uso, desde la raíz del repo:
#   bash docs/bitacora/2026-11-09-mm-baneo-saca-de-cola/pruebas/prueba_107.sh | docker exec -i supabase_db_v34frag-api psql -U postgres -X -q
#   bash docs/bitacora/2026-11-09-mm-baneo-saca-de-cola/pruebas/prueba_107.sh | ssh ubuntu@<VPS> 'sudo docker exec -i supabase-db psql -U postgres -X -q'
# Todo termina en rollback: no deja cambios.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../../.."
strip() { sed -e '/^begin;$/d' -e '/^commit;$/d' "$1"; }
while IFS= read -r line; do
  case "$line" in
    '-- @@107@@') strip "$root/supabase/replanteo/107_mm_baneo_saca_de_cola.sql" ;;
    '-- @@INVERSA@@') strip "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/107_mm_baneo_saca_de_cola.sql" ;;
    *) printf '%s\n' "$line" ;;
  esac
done < "$here/prueba_107.sql"
