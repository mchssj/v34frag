#!/bin/sh
# Prueba de la 113 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/113_historico_jugadores_sin_ficha.sql > "$T/r113.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/113_historico_jugadores_sin_ficha.sql > "$T/rev113.sql"
for f in r113 rev113; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-13-chat-y-jugadores-historicos/pruebas/probar_113.sql $C:/tmp/probar_113.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v ON_ERROR_STOP=1 -v r113=/tmp/r113.sql -v rev113=/tmp/rev113.sql -f /tmp/probar_113.sql
