import { cn } from "cn"

import { CONECTAR_DESCARGA } from "./labels"

/** Los botones Conectar abren el v34 con CMLeague Conectar: sin instalarlo, tocarlos no hace nada. */
export function ConectarHint({ className }: { className?: string }) {
  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      ¿No se abre el juego?{" "}
      <a
        href={CONECTAR_DESCARGA}
        download
        className="font-medium text-foreground underline underline-offset-2"
      >
        Instala CMLeague Conectar
      </a>{" "}
      una vez (descomprímelo y abre conectar.bat), o copia el comando y pégalo
      en la consola.
    </span>
  )
}
