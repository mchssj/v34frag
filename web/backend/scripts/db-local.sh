#!/usr/bin/env bash
# Supabase local (Docker) para las pruebas de integración, con el esquema real.
#   start  levanta los contenedores y, si la base está vacía, carga el esquema
#   reset  borra la base local y vuelve a cargar el esquema
#   stop   apaga los contenedores (sin guardar datos)
#   load   solo carga el esquema (base ya levantada y vacía)
# Carga, en orden: supabase/schema/public.sql, supabase/schema/auth_storage.sql y las
# migraciones de supabase/migrations/ posteriores a supabase/schema/BASE (las que todavía
# no están en producción), las de supabase/replanteo/ (fase de replanteo; REPLANTEO=0 para no
# cargarlas) y al final scripts/local-overrides.sql. Nunca toca la Supabase real.
set -euo pipefail

backend="$(cd "$(dirname "$0")/.." && pwd)"
raiz="$(cd "$backend/../.." && pwd)"
schema="$raiz/supabase/schema"
project_id="$(sed -n 's/^project_id = "\(.*\)"/\1/p' "$backend/supabase/config.toml")"
contenedor="supabase_db_${project_id}"
supabase() { (cd "$backend" && pnpm exec supabase "$@"); }

psql_local() { docker exec -i "$contenedor" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

cargar() {
  echo "Cargando esquema en $contenedor..."
  psql_local < "$schema/public.sql" >/dev/null
  psql_local < "$schema/auth_storage.sql" >/dev/null
  base="$(tr -d '[:space:]' < "$schema/BASE")"
  for f in "$raiz"/supabase/migrations/*.sql; do
    nombre="$(basename "$f")"
    if [[ "${nombre%%_*}" > "$base" ]]; then
      echo "  migración pendiente en producción: $nombre"
      psql_local < "$f" >/dev/null
    fi
  done
  if [[ "${REPLANTEO:-1}" != "0" ]]; then
    for f in "$raiz"/supabase/replanteo/[0-9]*.sql; do
      [[ -e "$f" ]] || continue
      echo "  replanteo: $(basename "$f")"
      psql_local < "$f" >/dev/null
    done
  else
    echo "  replanteo: omitido (REPLANTEO=0)"
  fi
  # Ajustes que solo tienen sentido en local (ver el archivo).
  psql_local < "$backend/scripts/local-overrides.sql" >/dev/null
  # PostgREST guarda en caché el esquema: hay que avisarle que cambió.
  psql_local -c "notify pgrst, 'reload schema';" >/dev/null
  echo "Esquema cargado."
}

vacia() { [[ "$(psql_local -At -c "select count(*) from pg_tables where schemaname = 'public'")" == "0" ]]; }

case "${1:-start}" in
  start)
    supabase start
    if vacia; then cargar; else echo "La base local ya tiene el esquema (usa 'reset' para recargarlo)."; fi
    ;;
  reset)
    supabase db reset --local --no-seed
    cargar
    ;;
  load)  cargar ;;
  stop)  supabase stop --no-backup ;;
  *) echo "Uso: $0 start|reset|stop|load" >&2; exit 1 ;;
esac
