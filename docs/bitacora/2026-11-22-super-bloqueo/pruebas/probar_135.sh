#!/bin/sh
# Prueba de la 135 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/135_mm_super_bloqueo.sql > "$T/r135.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/135_mm_super_bloqueo.sql > "$T/rev135.sql"
for f in r135 rev135; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-22-super-bloqueo/pruebas/probar_135.sql $C:/tmp/probar_135.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v r135=/tmp/r135.sql -v rev135=/tmp/rev135.sql -f /tmp/probar_135.sql
