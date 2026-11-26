import {
  CheckIcon,
  MinusIcon,
  SquareIcon,
  SwordsIcon,
  XIcon,
} from "lucide-react"

import { BrandMark } from "@/components/brand/Brand"

/**
 * Dibujo de la ventana del launcher (no es una captura): la barra de título oscura, la web adentro y el aviso de
 * partida encontrada. Es decorativo; el texto de la página cuenta lo mismo.
 */
export function LauncherMockup() {
  return (
    <div aria-hidden className="relative w-full max-w-[560px] select-none">
      <div className="overflow-hidden rounded-xl border bg-background shadow-[0_24px_60px_-24px_rgb(0_0_0/.45)]">
        {/* Barra de título, como la de Windows 11 con los colores de la web. */}
        <div className="flex h-8 items-center gap-2 border-b bg-[#0a0a0a] pl-3 text-[11px] text-neutral-200">
          <BrandMark className="size-3.5" />
          CMLeague
          <span className="ml-auto flex h-full">
            {[MinusIcon, SquareIcon, XIcon].map((Icon, i) => (
              <span key={i} className="grid w-10 place-items-center">
                <Icon className="size-3" />
              </span>
            ))}
          </span>
        </div>
        {/* La web adentro: una sala de Jugar simplificada. */}
        <div className="grid grid-cols-[56px_1fr] bg-background">
          <div className="flex flex-col items-center gap-3 border-r py-4">
            <BrandMark className="size-6" />
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="size-5 rounded-md bg-muted" />
            ))}
          </div>
          <div className="flex flex-col gap-3 p-4">
            <span className="h-3 w-24 rounded bg-muted" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2].map((t) => (
                <div
                  key={t}
                  className="flex flex-col gap-1.5 rounded-lg border p-2.5"
                >
                  <span className="h-2 w-14 rounded bg-muted-foreground/30" />
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      <span className="size-3.5 rounded-full bg-muted" />
                      <span className="h-2 flex-1 rounded bg-muted" />
                      {i < (t === 1 ? 4 : 3) && (
                        <CheckIcon className="size-3 text-primary" />
                      )}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-8 flex-1 rounded-md bg-primary" />
              <span className="h-8 w-24 rounded-md border" />
            </div>
          </div>
        </div>
      </div>

      {/* Aviso de Windows, abajo a la derecha. */}
      <div className="absolute -right-3 -bottom-6 flex w-[250px] items-start gap-2.5 rounded-lg border bg-card p-3 shadow-[0_16px_40px_-16px_rgb(0_0_0/.5)] sm:-right-8">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
          <SwordsIcon className="size-4" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold">
            ¡Partida encontrada!
          </span>
          <span className="text-xs text-muted-foreground">
            Acéptala desde CMLeague o desde la bandeja.
          </span>
        </span>
      </div>
    </div>
  )
}
