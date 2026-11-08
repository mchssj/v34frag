import { ImageUpIcon, Trash2Icon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { AvatarCropDialog } from "@/features/profile/components/AvatarCropDialog"
import {
  checkAvatarSource,
  cropBanner,
  ImageError,
  type CropArea,
} from "@/lib/image"
import { useMmAdminMutation } from "../queries"
import { useMmSource } from "../source"

/**
 * Imagen fija de la tarjeta del MVP (sala del matchmaking y detalle de un mix). Se encuadra en 4:1
 * y se guarda al instante, como el banner de un torneo. Sin imagen, la tarjeta queda lisa.
 */
export function MvpImageCard({ url }: { url: string | null }) {
  const source = useMmSource()
  const upload = useMmAdminMutation((file: Blob) => source.uploadMvpImage(file))
  const remove = useMmAdminMutation(() => source.deleteMvpImage())
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
      toast.success("Imagen del MVP actualizada.")
    } catch (e) {
      setError(e instanceof ImageError ? e.message : errorMessage(e))
    }
    setPending(null)
  }

  async function clear() {
    setError(null)
    try {
      await remove.mutateAsync()
      toast.success("Imagen del MVP quitada: la tarjeta queda lisa.")
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Card variant="outline" className="gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-semibold">Imagen del MVP</h2>
        <p className="text-[13px] text-muted-foreground">
          Fondo de la tarjeta del MVP en la sala del matchmaking y en el detalle
          de un mix. JPG, PNG o WebP: la encuadras en 4:1 antes de guardarla.
          Sin imagen, la tarjeta queda lisa.
        </p>
      </div>
      <div className="aspect-[4/1] max-w-[640px] overflow-hidden rounded-lg border bg-muted">
        {url && (
          <img
            src={url}
            alt="Imagen actual del MVP"
            className="size-full object-cover"
          />
        )}
      </div>
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
          {url ? "Cambiar imagen" : "Subir imagen"}
        </Button>
        {url && (
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
          title="Encuadra la imagen del MVP"
          confirmLabel="Usar imagen"
          onCancel={() => setPending(null)}
          onConfirm={(area) => void confirm(area)}
        />
      )}
    </Card>
  )
}
