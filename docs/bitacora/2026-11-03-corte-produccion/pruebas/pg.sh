#!/usr/bin/env bash
# Uso: pg.sh <psql|pg_dump> args...   (conecta a PRODUCCIÓN con PG_* del .env; monta la carpeta del corte en /w)
set -euo pipefail
S="$(cd "$(dirname "$0")" && pwd)"
envf=/c/Users/Agus/Documents/repo/.env
val() { grep -m1 "^$1=" "$envf" | cut -d= -f2- | tr -d '\r' | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
tool="$1"; shift
MSYS_NO_PATHCONV=1 docker run --rm -i -v "$(cygpath -w "$S"):/w" -w /w \
  -e PGHOST="$(val PG_HOST)" -e PGPORT="$(val PG_PORT)" -e PGUSER="$(val PG_USER)" -e PGPASSWORD="$(val PG_PASSWORD)" \
  -e PGDATABASE=postgres -e PGSSLMODE=require -e PGAPPNAME=corte-kyan postgres:17 "$tool" "$@"
