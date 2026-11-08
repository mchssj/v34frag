#!/usr/bin/env bash
# Corre las pruebas del replanteo 59 en la base local del backend (contenedor supabase_db_v34frag-api), dentro de una sola
# transacción que se deshace: aplica la 45 y de la 48 a la 58, después la 59, las pruebas y la inversa. No deja nada.
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
             53_match_list_sin_mm 54_mm_imagen_mvp 55_mm_foto_jugador 56_iniciar_torneo_pcw 57_mm_aviso_cola 58_claim_varios_steamid; do
      sin_tx "$repo/supabase/replanteo/$n.sql"
    done
  fi
  sin_tx "$repo/supabase/replanteo/59_mm_avisos_livianos.sql"
  echo 'set client_min_messages = notice;'
  # Las pruebas reemplazan mm_emit por una que anota los avisos; antes de la inversa se repone la de la 59.
  cat "$aqui/59_mm_avisos_livianos.sql"
  echo "create or replace function public.mm_emit(p_type text, p_lobby uuid, p_users uuid[], p_data jsonb default null) returns void language sql as \$f\$ select pg_notify('mm', json_build_object('t', p_type, 'lobby', p_lobby, 'users', coalesce(p_users, '{}'), 'd', p_data)::text) \$f\$;"
  sin_tx "$repo/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/59_mm_avisos_livianos.sql"
  echo "do \$\$ begin if to_regprocedure('public.mm_my_live(boolean)') is not null or to_regprocedure('public.mm_emit(text, uuid, uuid[])') is null then raise exception 'FALLA inversa'; end if; perform jsonb_object_keys(mm_my_state()) from (select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users limit 1), 'role', 'authenticated')::text, true)) x; raise notice 'OK: la inversa deja mm_my_state y mm_emit como en la 58'; end \$\$;"
  echo 'rollback;'
} | docker exec -i "$db" psql -U postgres -q -v ON_ERROR_STOP=1
