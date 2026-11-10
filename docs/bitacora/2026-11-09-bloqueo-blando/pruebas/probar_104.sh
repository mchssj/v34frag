#!/bin/sh
# Prueba de la 104 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/104_mm_bloqueo_blando.sql > "$T/r104.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/104_mm_bloqueo_blando.sql > "$T/rev104.sql"
for f in r104 rev104; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-09-bloqueo-blando/pruebas/probar_104.sql $C:/tmp/probar_104.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v r104=/tmp/r104.sql -v rev104=/tmp/rev104.sql -f /tmp/probar_104.sql
