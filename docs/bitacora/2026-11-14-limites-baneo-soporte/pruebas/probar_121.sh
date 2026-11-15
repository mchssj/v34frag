#!/bin/sh
# Prueba de la 121 en la base local (contenedor supabase_db_v34frag-api, sin la 121 aplicada), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
tr -d '\r' < supabase/replanteo/121_limites_baneo_soporte.sql | grep -v -E '^(begin|commit);$' > "$T/r121.sql"
tr -d '\r' < docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/121_limites_baneo_soporte.sql | grep -v -E '^(begin|commit);$' > "$T/rev121.sql"
for f in r121 rev121; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
tr -d '\r' < docs/bitacora/2026-11-14-limites-baneo-soporte/pruebas/probar_121.sql > "$T/probar_121.sql"
MSYS_NO_PATHCONV=1 docker cp "$T/probar_121.sql" $C:/tmp/probar_121.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v ON_ERROR_STOP=1 -v r121=/tmp/r121.sql -v rev121=/tmp/rev121.sql -f /tmp/probar_121.sql
