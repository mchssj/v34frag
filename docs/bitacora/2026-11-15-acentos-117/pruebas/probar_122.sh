#!/bin/sh
# Prueba de la 122 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
tr -d '\r' < supabase/replanteo/122_acentos_117.sql | grep -v -E '^(begin|commit);$' > "$T/r122.sql"
tr -d '\r' < docs/bitacora/2026-11-15-acentos-117/pruebas/probar_122.sql > "$T/probar_122.sql"
for f in r122 probar_122; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v ON_ERROR_STOP=1 -v r122=/tmp/r122.sql -f /tmp/probar_122.sql
