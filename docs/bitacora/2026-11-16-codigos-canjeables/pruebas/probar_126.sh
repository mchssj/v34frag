#!/bin/sh
# Prueba de la 126 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/126_codigos_canjeables.sql > "$T/r126.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/126_codigos_canjeables.sql > "$T/rev126.sql"
for f in r126 rev126; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-16-codigos-canjeables/pruebas/probar_126.sql $C:/tmp/probar_126.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v ON_ERROR_STOP=1 -v r126=/tmp/r126.sql -v rev126=/tmp/rev126.sql -f /tmp/probar_126.sql
