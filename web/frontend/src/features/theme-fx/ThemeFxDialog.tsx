import {
  MousePointerClickIcon,
  SmartphoneIcon,
  TriangleAlertIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react"
import { useRef, type ReactNode } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { useMediaQuery } from "@/lib/useMediaQuery"
import type { ThemeFxPref } from "./pref"

/** Atajo con ícono, como una tecla. */
function Hint({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-md border bg-muted px-2 text-xs font-medium text-foreground">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      {children}
    </span>
  )
}

/** Modal de primer uso. Cerrarlo sin elegir (Esc, clic fuera, X) responde `null`. */
export function ThemeFxDialog({
  open,
  onChoose,
}: {
  open: boolean
  onChoose: (choice: ThemeFxPref | null) => void
}) {
  const activate = useRef<HTMLButtonElement>(null)
  // Solo el atajo que sirve en este dispositivo; uno híbrido (táctil + mouse) ve los dos.
  const fine = useMediaQuery("(any-pointer: fine)")
  const showTouch = useMediaQuery("(any-pointer: coarse)")
  const showMouse = fine || !showTouch
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onChoose(null)}>
      <DialogContent
        overlayClassName="bg-black/55 supports-backdrop-filter:backdrop-blur-[4px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          activate.current?.focus()
        }}
        className="gap-4 rounded-[var(--radius)] border p-6 leading-design shadow-[0_24px_64px_-16px_rgb(0_0_0/.45)] ring-0 sm:max-w-[440px]"
      >
        <div className="flex items-start gap-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <ZapIcon className="size-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-1.5">
            <DialogTitle className="text-[17px] leading-[normal] font-bold tracking-[-0.2px]">
              Efectos al cambiar de tema
            </DialogTitle>
            <DialogDescription className="text-sm leading-[1.5] text-pretty text-muted-foreground">
              Al pasar a modo claro se lanza una flashbang y al pasar a oscuro
              una smoke. Incluye sonido y un destello blanco a pantalla
              completa.
            </DialogDescription>
          </div>
        </div>
        {/* role="note": es información fija del modal; "alert" la anunciaría de golpe. */}
        <Alert variant="warning" role="note" className="px-3 py-2.5">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle className="text-[13px] leading-[1.45] font-semibold">
            Aviso de fotosensibilidad
          </AlertTitle>
          <AlertDescription className="text-[13px] leading-[1.45]">
            Si tienes epilepsia fotosensible o eres sensible a destellos de luz,
            te recomendamos desactivar los efectos.
          </AlertDescription>
        </Alert>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            className="h-[38px] px-3.5 text-sm"
            onClick={() => onChoose("off")}
          >
            Desactivar
          </Button>
          <Button
            variant="outline"
            className="h-[38px] px-3.5 text-sm"
            onClick={() => onChoose("silent")}
          >
            Sin sonido
          </Button>
          <Button
            ref={activate}
            className="h-[38px] px-4 text-sm font-semibold"
            onClick={() => onChoose("full")}
          >
            Activar efectos
          </Button>
        </div>
        <div className="flex flex-col gap-2 border-t pt-3.5 text-[13px] text-muted-foreground">
          <p>Puedes cambiarlo cuando quieras desde el selector de tema:</p>
          <div className="flex flex-wrap gap-1.5">
            {showMouse && (
              <Hint icon={MousePointerClickIcon}>Clic derecho</Hint>
            )}
            {showTouch && <Hint icon={SmartphoneIcon}>Mantén presionado</Hint>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
