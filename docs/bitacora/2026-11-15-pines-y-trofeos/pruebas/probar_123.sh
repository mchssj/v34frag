#!/bin/sh
# Prueba de la 123 en la base local (contenedor supabase_db_v34frag-api, copia de producción), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/123_pines_de_torneo.sql > "$T/r123.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/123_pines_de_torneo.sql > "$T/rev123.sql"
for f in r123 rev123; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-15-pines-y-trofeos/pruebas/probar_123.sql $C:/tmp/probar_123.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v ON_ERROR_STOP=1 -v r123=/tmp/r123.sql -v rev123=/tmp/rev123.sql -f /tmp/probar_123.sql
