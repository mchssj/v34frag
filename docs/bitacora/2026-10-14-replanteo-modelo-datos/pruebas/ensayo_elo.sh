#!/usr/bin/env bash
# Ensayo del ELO (plan, sección 7). Demuestra que supabase/replanteo/ no cambia el ELO ni las victorias y
# derrotas de nadie, usando la copia de producción en la base LOCAL. Producción no se toca.
#   1. Base local con el esquema actual de producción + migraciones pendientes + copia de datos.
#   2. "Antes": elo_recompute_all() y foto (foto_elo.sql).
#   3. Aplica todas las migraciones de supabase/replanteo/ en orden.
#   4. "Después": elo_recompute_all() y otra foto.
#   5. Las dos fotos tienen que ser idénticas.
# Se compara contra la base local y no contra los valores de producción porque la migración pendiente de
# ELO por participación (20261014120000) cambia la fórmula.
set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
raiz="$(cd "$aqui/../../../.." && pwd)"
backend="$raiz/web/backend"
contenedor="supabase_db_$(sed -n 's/^project_id = "\(.*\)"/\1/p' "$backend/supabase/config.toml")"
fotos="${PROD_COPY_DIR:-$HOME/.v34frag/prod-copy}"   # junto a la copia, fuera del repo

foto() { docker exec -i "$contenedor" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q < "$aqui/foto_elo.sql" > "$1"; }

echo "== Carga de la copia de producción"
bash "$aqui/cargar_datos.sh"

echo "== Antes del replanteo"
foto "$fotos/elo_antes.txt"
grep '^n|' "$fotos/elo_antes.txt" | sed 's/^n|/   /'

echo "== Replanteo"
for m in "$raiz"/supabase/replanteo/[0-9]*.sql; do
  echo "   $(basename "$m")"
  docker exec -i "$contenedor" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$m" >/dev/null
done

echo "== Después del replanteo"
foto "$fotos/elo_despues.txt"

# Las victorias y derrotas se comparan aparte: antes salen de players y después pueden salir de la vista.
if diff <(grep -v '^wl|' "$fotos/elo_antes.txt") <(grep -v '^wl|' "$fotos/elo_despues.txt") > "$fotos/elo_diff.txt" &&
   { ! grep -q '^wl|' "$fotos/elo_despues.txt" || diff <(grep '^wl|' "$fotos/elo_antes.txt") <(grep '^wl|' "$fotos/elo_despues.txt") >> "$fotos/elo_diff.txt"; }; then
  echo "== IDÉNTICO: $(grep -c '^elo|' "$fotos/elo_despues.txt") SteamIDs, $(grep -c '^mps|' "$fotos/elo_despues.txt") filas de mixes"
else
  echo "== DISTINTO (detalle en $fotos/elo_diff.txt):"; head -20 "$fotos/elo_diff.txt"; exit 1
fi
