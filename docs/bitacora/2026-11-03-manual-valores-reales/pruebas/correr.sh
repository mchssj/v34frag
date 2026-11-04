#!/usr/bin/env bash
# Corre las pruebas del replanteo 65 en una base (staging o local) dentro de una sola transacción que se deshace:
# aplica la 65, las pruebas y la inversa. No deja nada.
#   bash correr.sh <carpeta de la rama feat/mm-claim-en-sala> "<cadena de conexión de psql>"
set -euo pipefail
repo="${1:?falta la carpeta del repo con la rama feat/mm-claim-en-sala}"
conn="${2:?falta la cadena de conexión}"
aqui="$(cd "$(dirname "$0")" && pwd)"
sin_tx() { grep -v -E '^(begin|commit);\r?$' "$1"; }
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  sin_tx "$repo/supabase/replanteo/65_manual_valores.sql"
  cat "$aqui/65_manual_valores.sql"
  sin_tx "$repo/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/65_manual_valores.sql"
  echo "do \$\$ begin if to_regprocedure('public.manual_valores()') is not null then raise exception 'FALLA inversa'; end if; raise notice 'OK: la inversa la borra'; end \$\$;"
  echo 'rollback;'
} | psql "$conn" -X -q
