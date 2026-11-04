#!/usr/bin/env bash
# Prueba del Worker de clips en local (wrangler dev con R2 simulado; no toca la cuenta de Cloudflare).
# Uso (desde la raíz del repo): docs/bitacora/2026-10-23-clips-render-automatico/pruebas/probar_worker.sh <video.mp4>
set -euo pipefail

video="$1"
worker="$(cd "$(dirname "$0")/../../../../cloudflare/clips-worker" && pwd)"
bucket="$(sed -n 's/^bucket_name = "\(.*\)"/\1/p' "$worker/wrangler.toml")"
m="11111111-2318-4000-8000-000000000001"
c="22222222-2318-4000-8000-000000000002"
ruta="$m/$c-20261023190000.mp4"
url="http://127.0.0.1:8799/clip/$ruta"
size=$(stat -c %s "$video")
fallas=0
# Cabeceras en minúsculas y sin el retorno de carro del final (wrangler dev las manda capitalizadas).
low() { tr -d '\r' | tr 'A-Z' 'a-z'; }
ok() { if eval "$1"; then echo "OK: $2"; else echo "FALLA: $2"; fallas=$((fallas + 1)); fi; }

cd "$worker"
pnpm exec wrangler r2 object put "$bucket/clips/$ruta" --file "$video" --content-type video/mp4 --local >/dev/null 2>&1
pnpm exec wrangler dev --port 8799 >/tmp/clips-worker-dev.log 2>&1 &
# En Windows, kill no cierra el árbol (pnpm → wrangler → workerd): se cierran por la ruta del Worker.
cerrar() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.CommandLine -match 'clips-worker' } |
    ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }" || true
}
trap cerrar EXIT
for _ in $(seq 60); do curl -s -o /dev/null "http://127.0.0.1:8799/" && break; sleep 1; done

h=$(curl -s -D - -o /tmp/clip.mp4 "$url" | low)
ok '[[ "$h" == *"200 ok"* && "$(stat -c %s /tmp/clip.mp4)" == "$size" ]]' "GET: 200 y el video entero ($size bytes)"
ok 'cmp -s /tmp/clip.mp4 "$video"' "GET: mismo contenido"
ok '[[ "$h" == *"content-type: video/mp4"* && "$h" == *"accept-ranges: bytes"* ]]' "GET: video/mp4 y Accept-Ranges"
ok '[[ "$h" == *"immutable"* && "$h" == *"access-control-allow-origin: *"* ]]' "GET: caché larga y CORS"

h=$(curl -s -I "$url" | low)
ok '[[ "$h" == *"200 ok"* && "$h" == *"content-length: $size"* ]]' "HEAD: 200 con el tamaño"

h=$(curl -s -D - -o /tmp/parte -H "Range: bytes=100-199" "$url" | low)
ok '[[ "$h" == *"206"* && "$h" == *"content-range: bytes 100-199/$size"* && "$(stat -c %s /tmp/parte)" == 100 ]]' "Range 100-199: 206 y 100 bytes"
ok 'cmp -s /tmp/parte <(tail -c +101 "$video" | head -c 100)' "Range: los bytes correctos"

h=$(curl -s -D - -o /tmp/parte -H "Range: bytes=-500" "$url" | low)
ok '[[ "$h" == *"206"* && "$h" == *"content-range: bytes $((size - 500))-$((size - 1))/$size"* ]]' "Range -500: los últimos 500 bytes"

etag=$(curl -s -I "$url" | tr -d '\r' | sed -n 's/^[Ee][Tt][Aa][Gg]: \(.*\)$/\1/p')
h=$(curl -s -D - -o /dev/null -H "If-None-Match: $etag" "$url" | low)
ok '[[ "$h" == *"304"* ]]' "If-None-Match con el ETag: 304"

h=$(curl -s -D - -o /tmp/parte -H "Range: bytes=$((size - 10))-" "$url" | low)
ok '[[ "$h" == *"206"* && "$(stat -c %s /tmp/parte)" == 10 ]]' "Range abierto (los últimos 10 bytes desde su offset)"
ok '[[ "$(curl -s -o /dev/null -w "%{http_code}" -H "Range: bytes=$size-" "$url")" == 416 ]]' "Range fuera del video: 416"
ok '[[ "$(curl -s -o /dev/null -w "%{http_code}" -H "Range: bytes=abc" "$url")" == 416 ]]' "Range inválido: 416"

ok '[[ "$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8799/clip/$m/$c-noexiste.mp4")" == 404 ]]' "video que no existe: 404"
ok '[[ "$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8799/clip/../demos/x.dem")" == 404 ]]' "ruta fuera de clips/: 404"
ok '[[ "$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8799/clip/$m/$c.mp4")" == 404 ]]' "clave sin sufijo: 404"
ok '[[ "$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$url")" == 405 ]]' "DELETE: 405"
ok '[[ "$(curl -s -o /dev/null -w "%{http_code}" -X PUT --data x "$url")" == 405 ]]' "PUT: 405"

pnpm exec wrangler r2 object delete "$bucket/clips/$ruta" --local >/dev/null 2>&1 || true
rm -f /tmp/clip.mp4 /tmp/parte
[[ $fallas == 0 ]] && echo "Todo OK" || { echo "$fallas FALLAS"; exit 1; }
