#!/usr/bin/env bash
# Corre las pruebas del replanteo 64 en la base local del backend (contenedor supabase_db_v34frag-api), dentro de una sola
# transacción que se deshace: aplica la 45 y de la 48 a la 63 si faltan, después la 64, las pruebas y la inversa de la 64.
# No deja nada.
#
#   bash correr_local.sh <carpeta del repo>   (feat/frontend-fase-1 o feat/mm-claim-en-sala)
set -euo pipefail
repo="${1:?falta la carpeta del repo}"
aqui="$(cd "$(dirname "$0")" && pwd)"
db="${DB_CONTAINER:-supabase_db_v34frag-api}"
sin_tx() { grep -v -E '^(begin|commit);\r?$' "$1"; }
q() { docker exec "$db" psql -U postgres -tAc "$1"; }

{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo 'set client_min_messages = warning;'
  [ -n "$(q "select to_regclass('public.ac_devices')")" ] || sin_tx "$repo/supabase/replanteo/45_anticheat.sql"
  if [ -z "$(q "select to_regclass('public.mm_queue_pings')")" ]; then
    for n in 48_matchmaking 49_mm_claim_en_sala 50_mm_min_mixes_cero 51_mm_min_account_days_cero 52_mm_cuentas_sin_ficha \
             53_match_list_sin_mm 54_mm_imagen_mvp 55_mm_foto_jugador 56_iniciar_torneo_pcw 57_mm_aviso_cola 58_claim_varios_steamid; do
      sin_tx "$repo/supabase/replanteo/$n.sql"
    done
  fi
  [ -n "$(q "select to_regprocedure('public.mm_my_live(boolean)')")" ] || sin_tx "$repo/supabase/replanteo/59_mm_avisos_livianos.sql"
  [ -n "$(q "select 1 from information_schema.columns where table_name = 'mm_queue' and column_name = 'ready_at'")" ] \
    || sin_tx "$repo/supabase/replanteo/60_mm_flujo_sala.sql"
  [ -n "$(q "select 1 from information_schema.columns where table_name = 'mm_penalty_log' and column_name = 'lifted_at'")" ] \
    || sin_tx "$repo/supabase/replanteo/61_mm_sanciones_admin.sql"
  sin_tx "$repo/supabase/replanteo/62_mm_imagen_mvp_where.sql"
  sin_tx "$repo/supabase/replanteo/63_mm_salir_cola_al_cerrar.sql"
  sin_tx "$repo/supabase/replanteo/64_mm_pasos_en_el_acto.sql"
  echo 'set client_min_messages = notice;'
  cat "$aqui/64_mm_pasos_en_el_acto.sql"
  # Las pruebas reemplazan mm_emit y mm_free_server: se deshacen con el rollback; la inversa no los toca.
  sin_tx "$repo/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/64_mm_pasos_en_el_acto.sql"
  cat <<'SQL'
do $$ begin
  if to_regprocedure('public.mm_try_build_now(text)') is not null or to_regprocedure('public.mm_assign_server(uuid)') is not null
     or position('mm_start_veto' in pg_get_functiondef('public.mm_accept()'::regprocedure)) > 0
     or position('mm_try_build_now' in pg_get_functiondef('public.mm_join(text,text)'::regprocedure)) > 0
     or position('mm_assign_server' in pg_get_functiondef('public.mm_ban_map(uuid,text,uuid)'::regprocedure)) > 0
     or position('cardinality(v_users) then continue' in pg_get_functiondef('public.mm_try_build(text)'::regprocedure)) > 0 then
    raise exception 'FALLA inversa';
  end if;
  raise notice 'OK: la inversa deja todo como en la 63';
end $$;
SQL
  echo 'rollback;'
} | docker exec -i "$db" psql -U postgres -q -v ON_ERROR_STOP=1
