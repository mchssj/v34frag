#!/bin/sh
# Prueba de la 115 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
# Por la entrada estándar: docker cp no entiende las rutas de Git Bash.
grep -v -E '^(begin|commit);$' supabase/replanteo/115_mm_ultima_sala_aparte.sql | docker exec -i $C sh -c 'cat > /tmp/r115.sql'
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/115_mm_ultima_sala_aparte.sql | docker exec -i $C sh -c 'cat > /tmp/rev115.sql'
docker exec -i $C sh -c 'cat > /tmp/probar_115.sql' < docs/bitacora/2026-11-13-pool-de-conexiones/pruebas/probar_115.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v ON_ERROR_STOP=1 -v r115=/tmp/r115.sql -v rev115=/tmp/rev115.sql -f /tmp/probar_115.sql
