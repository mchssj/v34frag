"""Copia los archivos de Storage de producción (la nube) al Supabase del VPS (lo llama migrar-vps.sh, paso 6).

Lee la lista de objetos (bucket, nombre, tipo, cache-control, tamaño) de un TSV, baja cada uno de ORIGEN_URL con la
service_role legacy de producción y lo sube al Kong local (127.0.0.1:8000) con la service_role local y upsert: la
fila ya está (vino con los datos), así que se conserva su id. Comprueba el tamaño de cada archivo. Solo biblioteca
estándar. Uso: python3 -I copiar_storage.py objetos.tsv
"""

import os
import sys
import urllib.error
import urllib.parse
import urllib.request

ORIGEN = os.environ["ORIGEN_URL"].rstrip("/")
ORIGEN_JWT = os.environ["ORIGEN_SERVICE_JWT"]
LOCAL = "http://127.0.0.1:8000"
LOCAL_JWT = os.environ["SERVICE_LOCAL"]


def ruta(bucket: str, nombre: str) -> str:
    return f"/storage/v1/object/{urllib.parse.quote(bucket)}/{urllib.parse.quote(nombre)}"


def pedir(req: urllib.request.Request) -> bytes:
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main() -> int:
    filas = [l.rstrip("\n").split("\t") for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
    errores = 0
    total = 0
    for bucket, nombre, tipo, cache, tam in filas:
        try:
            datos = pedir(urllib.request.Request(
                ORIGEN + ruta(bucket, nombre),
                headers={"apikey": ORIGEN_JWT, "Authorization": f"Bearer {ORIGEN_JWT}"}))
            if int(tam) >= 0 and len(datos) != int(tam):
                raise ValueError(f"tamaño {len(datos)} y la fila dice {tam}")
            segundos = cache.removeprefix("max-age=")
            pedir(urllib.request.Request(
                LOCAL + ruta(bucket, nombre), data=datos, method="POST",
                headers={"apikey": LOCAL_JWT, "Authorization": f"Bearer {LOCAL_JWT}", "Content-Type": tipo,
                         "Cache-Control": f"max-age={segundos}", "x-upsert": "true"}))
            total += len(datos)
        except (urllib.error.URLError, ValueError) as e:
            errores += 1
            detalle = e.read().decode(errors="replace")[:200] if isinstance(e, urllib.error.HTTPError) else str(e)
            print(f"   FALLA {bucket}/{nombre}: {detalle}", file=sys.stderr)
    print(f"   {len(filas) - errores} de {len(filas)} archivos copiados ({total / 1048576:.1f} MB)")
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
