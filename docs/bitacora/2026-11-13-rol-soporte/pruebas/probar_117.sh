#!/bin/sh
# Prueba de la 117 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/117_rol_soporte.sql > "$T/r117.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/117_rol_soporte.sql > "$T/rev117.sql"
for f in r117 rev117; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-13-rol-soporte/pruebas/probar_117.sql $C:/tmp/probar_117.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v ON_ERROR_STOP=1 -v r117=/tmp/r117.sql -v rev117=/tmp/rev117.sql -f /tmp/probar_117.sql
