#!/bin/sh
# Prueba de la 114 en la base local (contenedor supabase_db_v34frag-api, copia de producción), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/114_medallas_de_torneo.sql > "$T/r114.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/114_medallas_de_torneo.sql > "$T/rev114.sql"
for f in r114 rev114; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-13-medallas-de-torneo/pruebas/probar_114.sql $C:/tmp/probar_114.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v ON_ERROR_STOP=1 -v r114=/tmp/r114.sql -v rev114=/tmp/rev114.sql -f /tmp/probar_114.sql
