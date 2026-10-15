#!/usr/bin/env bash
# Copia los DATOS de producción (solo lectura) para el ensayo del ELO. Autorizado por Daniel el 2026-10-14.
#   - Todo el esquema public y auth.users (profiles y players apuntan ahí).
#   - Queda FUERA del repo, en ~/.v34frag/prod-copy/ (o $PROD_COPY_DIR): tiene emails y hashes de contraseñas,
#     así que no puede terminar en un commit ni en un stash, y no sale de esta máquina.
# Usa las variables PG_* del .env de la raíz (Session pooler). Producción no se modifica: pg_dump solo lee.
set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
raiz="$(cd "$aqui/../../../.." && pwd)"
destino="${PROD_COPY_DIR:-$HOME/.v34frag/prod-copy}"
mkdir -p "$destino"

leer() { grep "^$1=" "$raiz/.env" | tail -1 | cut -d= -f2- | tr -d '\r'; }
export PGHOST="${PGHOST:-$(leer PG_HOST)}" PGPORT="${PGPORT:-$(leer PG_PORT)}" \
       PGUSER="${PGUSER:-$(leer PG_USER)}" PGPASSWORD="${PGPASSWORD:-$(leer PG_PASSWORD)}" PGDATABASE=postgres

# pg_dump 18 agrega \restrict / \unrestrict, que el psql 17 del contenedor local no entiende.
limpiar() { sed -E '/^\\(un)?restrict /d'; }

pg_dump --data-only --schema=public --no-owner | limpiar > "$destino/public.sql"
pg_dump --data-only --table=auth.users --no-owner | limpiar > "$destino/auth_users.sql"
date -u +%Y-%m-%dT%H:%M:%SZ > "$destino/FECHA"

echo "Copia de producción en $destino ($(cat "$destino/FECHA")):"
ls -la "$destino" | awk 'NR>1 {print "  " $5 "\t" $9}'
