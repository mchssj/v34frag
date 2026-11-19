#!/bin/sh
# Prueba de la 128 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/128_mm_bloqueo_admin_sin_limite.sql > "$T/r128.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/128_mm_bloqueo_admin_sin_limite.sql > "$T/rev128.sql"
for f in r128 rev128; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-18-bloqueo-admin-sin-limite/pruebas/probar_128.sql $C:/tmp/probar_128.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v r128=/tmp/r128.sql -v rev128=/tmp/rev128.sql -f /tmp/probar_128.sql
