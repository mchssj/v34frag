#!/usr/bin/env bash
# Corre las pruebas del replanteo 56 en la base local del backend (contenedor supabase_db_v34frag-api), dentro de una sola
# transacción que se deshace: aplica la 45 y de la 48 a la 55 si faltan, después la 56, las pruebas y la inversa. No deja nada.
#
#   bash correr_local.sh <carpeta de la rama feat/mm-claim-en-sala>
set -euo pipefail
repo="${1:?falta la carpeta del repo con la rama feat/mm-claim-en-sala}"
aqui="$(cd "$(dirname "$0")" && pwd)"
db="${DB_CONTAINER:-supabase_db_v34frag-api}"
sin_tx() { grep -v -E '^(begin|commit);$' "$1"; }

{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo 'set client_min_messages = notice;'
  if [ -z "$(docker exec "$db" psql -U postgres -tAc "select to_regclass('public.ac_devices')")" ]; then
    sin_tx "$repo/supabase/replanteo/45_anticheat.sql"
  fi
  if [ -z "$(docker exec "$db" psql -U postgres -tAc "select to_regclass('public.mm_config')")" ]; then
    for n in 48_matchmaking 49_mm_claim_en_sala 50_mm_min_mixes_cero 51_mm_min_account_days_cero 52_mm_cuentas_sin_ficha \
             53_match_list_sin_mm 54_mm_imagen_mvp 55_mm_foto_jugador; do
      sin_tx "$repo/supabase/replanteo/$n.sql"
    done
  fi
  sin_tx "$repo/supabase/replanteo/56_iniciar_torneo_pcw.sql"
  cat "$aqui/56_iniciar_torneo_pcw.sql"
  # La inversa también tiene que aplicar limpia, y después el poll vuelve a ser el de dos parámetros.
  sin_tx "$repo/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/56_iniciar_torneo_pcw.sql"
  cat <<'SQL'
do $$
begin
  if to_regclass('public.match_bookings') is not null then raise exception 'FALLA inversa: match_bookings sigue'; end if;
  if to_regprocedure('public.csstv_mm_poll(text, text)') is null then raise exception 'FALLA inversa: falta el poll de dos parámetros'; end if;
  if position('booking_tick' in pg_get_functiondef('public.mm_tick()'::regprocedure)) > 0 then raise exception 'FALLA inversa: mm_tick sigue con las reservas'; end if;
  raise notice 'OK: la inversa deja el matchmaking como en la 55';
end $$;
SQL
  echo 'rollback;'
} | docker exec -i "$db" psql -U postgres -q -v ON_ERROR_STOP=1
