import { ImageUpIcon, Trash2Icon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { EventBanner } from "@/features/events/components/ui"
import type { EventDetail } from "@/features/events/types"
import { AvatarCropDialog } from "@/features/profile/components/AvatarCropDialog"
import {
  checkAvatarSource,
  cropBanner,
  ImageError,
  type CropArea,
} from "@/lib/image"
import { useRemoveBanner, useUploadBanner } from "../api/queries"

/**
 * Banner del torneo (Configuración): se elige una imagen, se encuadra en 4:1 y se guarda al
 * instante. Se ve en la lista de torneos y arriba de la página del torneo.
 */
export function BannerCard({ event }: { event: EventDetail }) {
  const upload = useUploadBanner(event.id)
  const remove = useRemoveBanner(event.id)
  const busy = upload.isPending || remove.isPending
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ file: File; src: string } | null>(
    null
  )

  // Libera la URL de la vista previa al cambiar de imagen o al desmontar.
  useEffect(() => {
    if (!pending) return
    return () => URL.revokeObjectURL(pending.src)
  }, [pending])

  function pick(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      checkAvatarSource(file)
      setPending({ file, src: URL.createObjectURL(file) })
    } catch (e) {
      setError(e instanceof ImageError ? e.message : errorMessage(e))
    }
  }

  async function confirm(area: CropArea) {
    if (!pending) return
    try {
      await upload.mutateAsync(await cropBanner(pending.file, area))
      toast.success("Banner actualizado.")
    } catch (e) {
      setError(e instanceof ImageError ? e.message : errorMessage(e))
    }
    setPending(null)
  }

  async function clear() {
    setError(null)
    try {
      await remove.mutateAsync()
      toast.success("Banner quitado: vuelve el patrón por defecto.")
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Card variant="outline" className="gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold">Banner</h2>
        <p className="text-[13px] text-muted-foreground">
          Se ve en la lista de torneos y arriba de la página del torneo. JPG,
          PNG o WebP: lo encuadras en 4:1 antes de guardarlo.
        </p>
      </div>
      <EventBanner
        url={event.banner_url}
        className="aspect-[4/1] max-w-[640px] rounded-lg border"
      />
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? (
            <Spinner className="size-3.5" />
          ) : (
            <ImageUpIcon aria-hidden />
          )}
          {event.banner_url ? "Cambiar banner" : "Subir banner"}
        </Button>
        {event.banner_url && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            className="text-destructive hover:text-destructive"
            onClick={() => void clear()}
          >
            <Trash2Icon aria-hidden />
            Quitar
          </Button>
        )}
      </div>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      {pending && (
        <AvatarCropDialog
          key={pending.src}
          src={pending.src}
          busy={upload.isPending}
          shape="rect"
          aspect={4}
          title="Encuadra el banner"
          confirmLabel="Usar banner"
          onCancel={() => setPending(null)}
          onConfirm={(area) => void confirm(area)}
        />
      )}
    </Card>
  )
}
