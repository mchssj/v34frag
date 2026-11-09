#!/bin/sh
# Prueba de la 99 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/99_resultado_tardio_mm.sql > "$T/r99.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/99_resultado_tardio_mm.sql > "$T/rev99.sql"
MSYS_NO_PATHCONV=1 docker cp "$T/r99.sql" $C:/tmp/r99.sql
MSYS_NO_PATHCONV=1 docker cp "$T/rev99.sql" $C:/tmp/rev99.sql
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-09-resultado-tardio-mm/pruebas/probar_99.sql $C:/tmp/probar_99.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v r99=/tmp/r99.sql -v rev99=/tmp/rev99.sql -f /tmp/probar_99.sql
