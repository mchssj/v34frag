#!/usr/bin/env bash
# Arma la prueba de la 160: 156 a 160 sin sus begin/commit, las pruebas, la inversa de la 160 y rollback.
# Uso: bash armar_prueba.sh > prueba.sql && docker exec -i supabase_db_v34frag-api psql -U postgres -d postgres < prueba.sql
set -euo pipefail
raiz="$(cd "$(dirname "$0")/../../../.." && pwd)"
limpio() { sed -e '/^begin;$/d' -e '/^commit;$/d' "$1"; }
echo 'begin;'
for n in 156_anticheat_juego 157_anticheat_deteccion 158_anticheat_maquinas 159_anticheat_aim 160_anticheat_sin_eac; do
  echo "\\echo == $n"; limpio "$raiz/supabase/replanteo/$n.sql"
done
cat "$(dirname "$0")/bridge_160.sql"
echo '\echo == inversa 160'
limpio "$raiz/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/160_anticheat_sin_eac.sql"
echo "select count(*) as columnas_que_quedan from information_schema.columns where table_name in ('ac_devices', 'ac_server_policy') and column_name in ('game_eac', 'game_eac_why', 'enforce_always');"
echo 'rollback;'
