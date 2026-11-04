#!/usr/bin/env bash
# Corre las pruebas del replanteo 69 dentro de una sola transacción que se deshace: aplica la 69, las pruebas,
# la inversa y comprueba que la vista quede como antes. No deja nada.
#   bash correr.sh "<cadena de conexión de psql>"   (en staging, el usuario es postgres.<ref del proyecto>)
set -euo pipefail
conn="${1:?falta la cadena de conexión}"
aqui="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$aqui/../../../.." && pwd)"
sin_tx() { grep -v -E '^(begin|commit);\r?$' "$1"; }
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo "create temp table antes as select pg_get_viewdef('public.team_members_view'::regclass, true) as d;"
  sin_tx "$repo/supabase/replanteo/69_foto_en_plantel.sql"
  cat "$aqui/69.sql"
  sin_tx "$repo/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/69_foto_en_plantel.sql"
  echo "do \$\$ begin if (select d from antes) <> pg_get_viewdef('public.team_members_view'::regclass, true) then raise exception 'FALLA inversa'; end if; raise notice 'OK: la inversa deja la vista como antes'; end \$\$;"
  echo 'rollback;'
} | psql "$conn" -X -q
