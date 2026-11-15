#!/bin/sh
# Prueba de la 121 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/121_limites_baneo_soporte.sql > "$T/r121.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/121_limites_baneo_soporte.sql > "$T/rev121.sql"
for f in r121 rev121; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-14-limites-baneo-soporte/pruebas/probar_121.sql $C:/tmp/probar_121.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v ON_ERROR_STOP=1 -v r121=/tmp/r121.sql -v rev121=/tmp/rev121.sql -f /tmp/probar_121.sql
