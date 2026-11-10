#!/bin/sh
# Prueba de la 109 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/109_mm_reemplazo_espera.sql > "$T/r109.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/109_mm_reemplazo_espera.sql > "$T/rev109.sql"
for f in r109 rev109; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-10-reemplazo-espera-minima/pruebas/probar_109.sql $C:/tmp/probar_109.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v ON_ERROR_STOP=1 -v r109=/tmp/r109.sql -v rev109=/tmp/rev109.sql -f /tmp/probar_109.sql
