#!/usr/bin/env bash
# Ensayo del corte en la Supabase LOCAL (Docker), sobre la copia de producción que dejan copiar_datos.sh y
# cargar_datos.sh (docs/bitacora/2026-10-14-replanteo-modelo-datos/pruebas/). Hace los pasos 2.2 y 2.3 del plan:
# renombra las fichas y la cuenta repetidas, crea mm_listener y aplica supabase/replanteo/01 a 69 en orden, cada
# uno con su tiempo. Se detiene en el primero que falla. Nunca toca una base remota.
#   bash ensayo_local.sh [desde]   (desde: número del primer replanteo, para seguir después de corregir algo)
#
# Sin CR: con core.autocrlf los .sql salen con CRLF en Windows. Aplicados así, el cuerpo de cada función queda con
# CR y los replanteos que buscan y reemplazan texto en una función (el 52 y el 60, por ejemplo) no lo encuentran.
# Staging se cargó con LF; en el corte, igual. El CR va como octal (\015): el bash de Git ignora un CR literal.
set -euo pipefail
aqui="$(cd "$(dirname "$0")" && pwd)"
raiz="$(cd "$aqui/../../../.." && pwd)"
contenedor="supabase_db_$(sed -n 's/^project_id = "\(.*\)"/\1/p' "$raiz/web/backend/supabase/config.toml")"
desde="${1:-01}"
psql_local() { docker exec -i "$contenedor" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
sin_cr() { tr -d '\015' < "$1"; }

if [[ "$desde" == "01" ]]; then
  echo "== Paso 2.2: fichas y cuenta repetidas, y mm_listener"
  sin_cr "$aqui/antes_de_los_replanteos.sql" | psql_local
  # En local la contraseña no importa; en producción es MM_LISTENER_PASSWORD del .env.
  psql_local -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname = 'mm_listener') then create role mm_listener login password 'local' noinherit; end if; end \$\$;"
fi

echo "== Paso 2.3: replanteos desde el $desde"
total=0
for f in "$raiz"/supabase/replanteo/[0-9]*.sql; do
  n="$(basename "$f")"
  [[ "${n%%_*}" < "$desde" ]] && continue
  t0=$(date +%s%N)
  if ! salida=$(sin_cr "$f" | psql_local 2>&1); then
    echo "FALLA en $n:"; echo "$salida" | grep -E "ERROR|DETAIL|CONTEXT|HINT" | head -8
    exit 1
  fi
  ms=$(( ($(date +%s%N) - t0) / 1000000 )); total=$((total + ms))
  printf '  %-45s %6d ms\n' "$n" "$ms"
done
psql_local -c "notify pgrst, 'reload schema';"
echo "== Replanteos aplicados: $((total / 1000)) s en total"
