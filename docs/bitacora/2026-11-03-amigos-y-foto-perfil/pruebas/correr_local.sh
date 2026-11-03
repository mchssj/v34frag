#!/usr/bin/env bash
# Corre las pruebas del replanteo 70 en la base local del backend (contenedor supabase_db_v34frag-api), dentro de una
# sola transacción que se deshace: arma un caso de foto ya distinta (para el arreglo de datos), aplica la 70, las
# pruebas y la inversa. No deja nada. Corre como supabase_admin con pg_safeupdate cargado, como PostgREST en staging.
#
#   bash correr_local.sh <carpeta del repo>
set -euo pipefail
repo="${1:?falta la carpeta del repo}"
aqui="$(cd "$(dirname "$0")" && pwd)"
db="${DB_CONTAINER:-supabase_db_v34frag-api}"
sin_tx() { grep -v -E '^(begin|commit);\r?$' "$1"; }

{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo 'set client_min_messages = warning;'
  cat "$aqui/70_caso_previo.sql"
  echo "load 'safeupdate';"
  sin_tx "$repo/supabase/replanteo/70_amigos_y_foto_perfil.sql"
  echo 'set client_min_messages = notice;'
  cat "$aqui/70_datos.sql"
  echo 'savepoint pruebas;'
  cat "$aqui/70.sql"
  echo 'rollback to savepoint pruebas;'
  sin_tx "$repo/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/70_amigos_y_foto_perfil.sql"
  cat "$aqui/70_inversa.sql"
  echo 'rollback;'
} | docker exec -i "$db" psql -U supabase_admin -d postgres -q -v ON_ERROR_STOP=1
