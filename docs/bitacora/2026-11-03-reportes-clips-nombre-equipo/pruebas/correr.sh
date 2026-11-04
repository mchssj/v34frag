#!/usr/bin/env bash
# Corre las pruebas del replanteo 68 en una base (staging o local) dentro de una sola transacción que se deshace:
# aplica la 68, las pruebas, la inversa y la comprobación de la inversa. No deja nada.
#   bash correr.sh <carpeta de la rama feat/mm-claim-en-sala> "<cadena de conexión de psql>"
set -euo pipefail
repo="${1:?falta la carpeta del repo con la rama feat/mm-claim-en-sala}"
conn="${2:?falta la cadena de conexión}"
aqui="$(cd "$(dirname "$0")" && pwd)"
sin_tx() { grep -v -E '^(begin|commit);\r?$' "$1"; }
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  sin_tx "$repo/supabase/replanteo/68_reportes_admin_nombre_equipo.sql"
  cat "$aqui/68_reportes_admin_nombre_equipo.sql"
  sin_tx "$repo/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/68_reportes_admin_nombre_equipo.sql"
  cat "$aqui/inversa_ok.sql"
  echo 'rollback;'
} | psql "$conn" -X -q
