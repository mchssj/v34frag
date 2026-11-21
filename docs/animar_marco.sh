#!/usr/bin/env bash
# Video de un marco (MP4) -> WebP animado con transparencia para la tienda.
# Uso: [MODO=--fondo-negro | MODO=--hueco [COLOR=#rrggbb]] [RECORTE="crop=..."] [PALETA="de:de a:a"]
#      bash docs/animar_marco.sh video.mp4 carpeta_salida [escala=1] [lado=256] [fps=10] [calidad=50]
# escala: agrandar el centro (1.15 lleva una franja del 12-18 % al 6-13 %; ver la guía de arte, Fase 3).
# RECORTE: un crop de ffmpeg propio en lugar del centrado de `escala` (ej. subir el sol en Synthwave:
#   RECORTE="crop=iw*0.81:ih*0.81:iw*0.095:ih*0.19").
set -euo pipefail
src="$1"; out="$2"; s="${3:-1}"; size="${4:-256}"; fps="${5:-10}"; q="${6:-50}"
dir="$(dirname "$0")"
rm -rf "$out/cuadros" "$out/alfa"; mkdir -p "$out/cuadros" "$out/alfa"
ffmpeg -v error -i "$src" -vf "fps=$fps,${RECORTE:-crop=iw/$s:ih/$s},scale=$size:$size:flags=lanczos,format=rgba" "$out/cuadros/c_%03d.png"
# MODO=--fondo-negro para diseños luminosos generados sobre negro; MODO=--hueco para marcos pintados enteros (el hueco
# se corta con la forma de la web, sin mirar el color); por defecto, --brillo sobre blanco.
for f in "$out"/cuadros/*.png; do
  if [ "${MODO:-}" = "--hueco" ]; then node "$dir/hueco_marco.mjs" "$f" "$out/alfa/$(basename "$f")" ${COLOR:-} > /dev/null
  else node "$dir/recortar_marco.mjs" "${MODO:---brillo}" "$f" "$out/alfa/$(basename "$f")" > /dev/null; fi
done
# Variante de color (Fase 5): PALETA="225:195 0:40" bash docs/animar_marco.sh ...
if [ -n "${PALETA:-}" ]; then node "$dir/recolorear_marco.mjs" $PALETA "$out/alfa" "$out/alfa"; fi
# La transparencia se guarda sin pérdida: dejarla en 8 niveles baja el peso casi a la mitad sin que se note.
ffmpeg -v error -y -framerate "$fps" -i "$out/alfa/c_%03d.png" -vf "lut=a='floor(val/32)*32'" \
  -c:v libwebp -lossless 0 -q:v "$q" -loop 0 "$out/marco-animado.webp"
echo "cuadros: $(ls "$out/alfa" | wc -l), peso: $(( $(stat -c %s "$out/marco-animado.webp") / 1024 )) KB"
