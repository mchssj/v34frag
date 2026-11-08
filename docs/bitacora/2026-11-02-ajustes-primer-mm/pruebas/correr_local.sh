#!/usr/bin/env bash
# Corre las pruebas de los replanteos 53, 54 y 55 en la base local del backend (contenedor supabase_db_v34frag-api), dentro de
# una sola transacción que se deshace: aplica 45, 48 y de la 49 a la 52 si faltan, después de la 53 a la 55, las pruebas
# y las inversas. No deja nada.
#
#   bash correr_local.sh <carpeta de la rama feat/mm-claim-en-sala>
set -euo pipefail
repo="${1:?falta la carpeta del repo con la rama feat/mm-claim-en-sala}"
aqui="$(cd "$(dirname "$0")" && pwd)"
db="${DB_CONTAINER:-supabase_db_v34frag-api}"
sin_tx() { grep -v -E '^(begin|commit);$' "$1"; }
rep="$repo/supabase/replanteo"
inv="$repo/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas"

{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  if [ -z "$(docker exec "$db" psql -U postgres -tAc "select to_regclass('public.ac_devices')")" ]; then sin_tx "$rep/45_anticheat.sql"; fi
  if [ -z "$(docker exec "$db" psql -U postgres -tAc "select to_regclass('public.mm_config')")" ]; then
    for n in 48_matchmaking 49_mm_claim_en_sala 50_mm_min_mixes_cero 51_mm_min_account_days_cero 52_mm_cuentas_sin_ficha; do sin_tx "$rep/$n.sql"; done
  fi
  sin_tx "$rep/53_match_list_sin_mm.sql"
  sin_tx "$rep/54_mm_imagen_mvp.sql"
  sin_tx "$rep/55_mm_foto_jugador.sql"
  cat "$aqui/53_54.sql" "$aqui/55.sql"
  sin_tx "$inv/55_mm_foto_jugador.sql"
  sin_tx "$inv/54_mm_imagen_mvp.sql"
  sin_tx "$inv/53_match_list_sin_mm.sql"
  cat <<'SQL'
do $$
begin
  if pg_get_viewdef('public.match_list'::regclass) ~* 'kind <> ''mm''' then raise exception 'FALLA inversa 53'; end if;
  if exists (select 1 from information_schema.columns where table_name = 'mm_config' and column_name = 'mvp_image_url') then raise exception 'FALLA inversa 54'; end if;
  if to_regprocedure('public.mm_player_photo(uuid)') is not null then raise exception 'FALLA inversa 55'; end if;
  raise notice 'OK: las inversas de la 53, la 54 y la 55';
end $$;
SQL
  echo 'rollback;'
} | docker exec -i "$db" psql -U postgres -q -v ON_ERROR_STOP=1
