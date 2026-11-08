#!/usr/bin/env bash
# Corre las pruebas del replanteo 58 en la base local del backend (contenedor supabase_db_v34frag-api), dentro de una sola
# transacción que se deshace: aplica la 45 y de la 48 a la 57, después la 58, las pruebas y la inversa. No deja nada.
#
#   bash correr_local.sh <carpeta de la rama feat/mm-claim-en-sala>
set -euo pipefail
repo="${1:?falta la carpeta del repo con la rama feat/mm-claim-en-sala}"
aqui="$(cd "$(dirname "$0")" && pwd)"
db="${DB_CONTAINER:-supabase_db_v34frag-api}"
sin_tx() { grep -v -E '^(begin|commit);\r?$' "$1"; }

{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo 'set client_min_messages = warning;'
  [ -n "$(docker exec "$db" psql -U postgres -tAc "select to_regclass('public.ac_devices')")" ] || sin_tx "$repo/supabase/replanteo/45_anticheat.sql"
  if [ -z "$(docker exec "$db" psql -U postgres -tAc "select to_regclass('public.mm_queue_pings')")" ]; then
    for n in 48_matchmaking 49_mm_claim_en_sala 50_mm_min_mixes_cero 51_mm_min_account_days_cero 52_mm_cuentas_sin_ficha \
             53_match_list_sin_mm 54_mm_imagen_mvp 55_mm_foto_jugador 56_iniciar_torneo_pcw 57_mm_aviso_cola; do
      sin_tx "$repo/supabase/replanteo/$n.sql"
    done
  fi
  sin_tx "$repo/supabase/replanteo/58_claim_varios_steamid.sql"
  echo 'set client_min_messages = notice;'
  cat "$aqui/58_claim_varios_steamid.sql"
  sin_tx "$repo/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/58_claim_varios_steamid.sql"
  echo "do \$\$ begin if position('admin_steam_linked' in pg_get_functiondef('public.claim_with_code(text, text, text, text)'::regprocedure)) > 0 then raise exception 'FALLA inversa'; end if; raise notice 'OK: la inversa vuelve al pedido al admin'; end \$\$;"
  echo 'rollback;'
} | docker exec -i "$db" psql -U postgres -q -v ON_ERROR_STOP=1
