#!/bin/sh
# Prueba de la 110 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/110_widget_streamers.sql > "$T/r110.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/110_widget_streamers.sql > "$T/rev110.sql"
for f in r110 rev110; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-10-widget-streamers-en-main/pruebas/probar_110.sql $C:/tmp/probar_110.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v ON_ERROR_STOP=1 -v r110=/tmp/r110.sql -v rev110=/tmp/rev110.sql -f /tmp/probar_110.sql
