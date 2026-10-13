#!/usr/bin/env bash
# Compila un csstv_reporter.smx atado a un servidor (game_servers.id en Supabase).
# Ese .smx solo funciona con el token de ese servidor y lleva su ID adentro (marca de agua).
#
# Uso:   server/build_licenciado.sh <uuid del servidor> <nombre-corto>
# Sale:  server/licencias/<nombre-corto>/csstv_reporter.smx   (no se sube a git)
#
# SPCOMP_DIR: carpeta con spcomp.exe e include/ (con system2.inc).
# Por defecto, la del servidor de pruebas local.
set -euo pipefail

ID="${1:-}"
NAME="${2:-}"
if ! [[ "$ID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] || ! [[ "$NAME" =~ ^[a-z0-9-]+$ ]]; then
  echo "Uso: $0 <uuid del servidor> <nombre-corto en minúsculas>" >&2
  echo "El UUID está en Supabase: select id, name from game_servers;" >&2
  exit 1
fi

SPCOMP_DIR="${SPCOMP_DIR:-/e/CSS DEDICATED SERVER/server/cstrike/addons/sourcemod/scripting}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/addons/sourcemod/scripting"
OUT="$HERE/licencias/$NAME"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cp -r "$SRC/." "$TMP/"
sed -i "s/^#define CSSTV_LICENSE_ID \"\"/#define CSSTV_LICENSE_ID \"${ID,,}\"/" "$TMP/csstv/license_id.inc"
grep -q "CSSTV_LICENSE_ID \"${ID,,}\"" "$TMP/csstv/license_id.inc" || { echo "No se pudo escribir el ID en license_id.inc" >&2; exit 1; }

mkdir -p "$OUT"
(cd "$TMP" && "$SPCOMP_DIR/spcomp.exe" csstv_reporter.sp -i"$SPCOMP_DIR/include" -o"$OUT/csstv_reporter.smx")
echo "Listo: $OUT/csstv_reporter.smx (solo acepta el token del servidor ${ID,,})"
