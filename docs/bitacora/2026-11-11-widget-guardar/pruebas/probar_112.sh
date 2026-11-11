#!/bin/sh
# Prueba de la 112 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/112_widget_guardar.sql > "$T/r112.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/112_widget_guardar.sql > "$T/rev112.sql"
for f in r112 rev112; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-11-widget-guardar/pruebas/probar_112.sql $C:/tmp/probar_112.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v ON_ERROR_STOP=1 -v r112=/tmp/r112.sql -v rev112=/tmp/rev112.sql -f /tmp/probar_112.sql
