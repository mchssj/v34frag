#!/bin/sh
# Prueba de la 111 en la base local (contenedor supabase_db_v34frag-api), todo con rollback.
set -e
cd "$(dirname "$0")/../../../.."
C=supabase_db_v34frag-api
T="${TMPDIR:-${TMP:-/tmp}}"
grep -v -E '^(begin|commit);$' supabase/replanteo/111_widget_foto.sql > "$T/r111.sql"
grep -v -E '^(begin|commit);$' docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/111_widget_foto.sql > "$T/rev111.sql"
for f in r111 rev111; do MSYS_NO_PATHCONV=1 docker cp "$T/$f.sql" $C:/tmp/$f.sql; done
MSYS_NO_PATHCONV=1 docker cp docs/bitacora/2026-11-11-widget-foto-de-perfil/pruebas/probar_111.sql $C:/tmp/probar_111.sql
MSYS_NO_PATHCONV=1 docker exec $C psql -U postgres -q -v ON_ERROR_STOP=1 -v r111=/tmp/r111.sql -v rev111=/tmp/rev111.sql -f /tmp/probar_111.sql
