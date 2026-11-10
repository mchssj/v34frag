#!/bin/sh
# Prueba de la 108 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/108_mm_plazo_ready.sql > "$T/r108.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/108_mm_plazo_ready.sql > "$T/rev108.sql"
for f in r108 rev108; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-10-mm-plazo-ready/pruebas/probar_108.sql $C:/tmp/probar_108.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v ON_ERROR_STOP=1 -v r108=/tmp/r108.sql -v rev108=/tmp/rev108.sql -f /tmp/probar_108.sql
