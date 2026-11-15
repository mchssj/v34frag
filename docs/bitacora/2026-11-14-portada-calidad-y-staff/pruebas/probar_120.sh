#!/bin/sh
# Prueba de la 120 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/120_portada_staff.sql | tr -d '\r' > "$T/r120.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/120_portada_staff.sql | tr -d '\r' > "$T/rev120.sql"
for f in r120 rev120; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-14-portada-calidad-y-staff/pruebas/probar_120.sql $C:/tmp/probar_120.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v ON_ERROR_STOP=1 -v r120=/tmp/r120.sql -v rev120=/tmp/rev120.sql -f /tmp/probar_120.sql
