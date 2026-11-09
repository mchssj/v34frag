#!/bin/sh
# Prueba de la 98 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/98_elo_minimo.sql > "$T/r98.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/98_elo_minimo.sql > "$T/rev98.sql"
MSYS_NO_PATHCONV=1 docker cp "$T/r98.sql" $C:/tmp/r98.sql
MSYS_NO_PATHCONV=1 docker cp "$T/rev98.sql" $C:/tmp/rev98.sql
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-09-elo-minimo-15/pruebas/probar_98.sql $C:/tmp/probar_98.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v r98=/tmp/r98.sql -v rev98=/tmp/rev98.sql -f /tmp/probar_98.sql
