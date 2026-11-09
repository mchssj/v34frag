#!/bin/sh
# Prueba de la 100 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
# Aplica antes la 98 (la base local no la tiene) y les saca begin/commit.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
R=docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas
grep -v -E '^(begin|commit);$' supabase/replanteo/98_elo_minimo.sql > "$T/r98.sql"
grep -v -E '^(begin|commit);$' supabase/replanteo/100_elo_por_partida.sql > "$T/r100.sql"
grep -v -E '^(begin|commit);$' $R/100_elo_por_partida.sql > "$T/rev100.sql"
for f in r98 r100 rev100; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-09-elo-por-partida/pruebas/probar_100.sql $C:/tmp/probar_100.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v r98=/tmp/r98.sql -v r100=/tmp/r100.sql -v rev100=/tmp/rev100.sql -f /tmp/probar_100.sql
