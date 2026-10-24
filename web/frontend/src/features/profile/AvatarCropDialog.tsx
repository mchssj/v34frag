import { ZoomInIcon, ZoomOutIcon } from "lucide-react"
import { useRef, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
// Los estilos van por CSS y no inyectados en tiempo de ejecución (compatible con la CSP).
import "react-easy-crop/react-easy-crop.css"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Encuadre de la foto antes de subirla: arrastrar y zoom (mouse, rueda, pellizco o flechas)
 * dentro del círculo. Devuelve el área elegida en píxeles de la imagen original.
 */
export function AvatarCropDialog({
  src,
  busy,
  onCancel,
  onConfirm,
}: {
  src: string
  busy: boolean
  onCancel: () => void
  onConfirm: (area: Area) => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const area = useRef<Area | null>(null)

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="gap-4 leading-design sm:max-w-[420px]">
        <div className="flex flex-col gap-1">
          <DialogTitle className="text-base leading-[normal] font-semibold">
            Encuadra tu foto
          </DialogTitle>
          <DialogDescription>
            Arrástrala y usa el zoom para que quede como quieres.
          </DialogDescription>
        </div>
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            // La imagen cubre el marco y el círculo lo ocupa entero.
            objectFit="cover"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => {
              area.current = pixels
            }}
            disableAutomaticStylesInjection
          />
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <ZoomOutIcon className="size-4 shrink-0" aria-hidden />
          <Slider
            min={1}
            max={3}
            step={0.01}
            value={[zoom]}
            onValueChange={([v]) => setZoom(v)}
            aria-label="Zoom"
            className="flex-1"
          />
          <ZoomInIcon className="size-4 shrink-0" aria-hidden />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            disabled={busy}
            onClick={() => area.current && onConfirm(area.current)}
          >
            Guardar foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
