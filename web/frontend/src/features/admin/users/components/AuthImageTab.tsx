import { useQuery } from "@tanstack/react-query"
import { ImageUpIcon, Trash2Icon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  authImageOptions,
  useDeleteAuthImage,
  useUploadAuthImage,
} from "@/features/auth/api/authImage"
import { AvatarCropDialog } from "@/features/profile/components/AvatarCropDialog"
import {
  checkAvatarSource,
  cropAuthImage,
  ImageError,
  type CropArea,
} from "@/lib/image"

/**
 * Imagen del panel de Iniciar sesión, Registro y Bienvenida (replanteo 67). Se encuadra en 4:5 y se
 * guarda al instante, como la imagen del MVP. Sin imagen, el panel queda gris.
 */
export function AuthImageTab() {
  const current = useQuery(authImageOptions)
  const url = current.data ?? null
  const upload = useUploadAuthImage()
  const remove = useDeleteAuthImage()
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
      await upload.mutateAsync(await cropAuthImage(pending.file, area))
      toast.success("Imagen del inicio de sesión actualizada.")
    } catch (e) {
      setError(e instanceof ImageError ? e.message : errorMessage(e))
    }
    setPending(null)
  }

  async function clear() {
    setError(null)
    try {
      await remove.mutateAsync()
      toast.success("Imagen quitada: el panel queda gris.")
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Card variant="outline" className="gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-semibold">
          Imagen del inicio de sesión
        </h2>
        <p className="text-[13px] text-pretty text-muted-foreground">
          Se ve a la derecha de Iniciar sesión, Registro y la bienvenida. JPG,
          PNG o WebP: la encuadras en 4:5 (vertical) antes de guardarla y queda
          en 1600 × 2000. Lo importante, en el centro: los costados se recortan
          en pantallas anchas, el cuarto de abajo lo tapa la tarjeta con el
          texto y en el teléfono solo se ve una franja del medio. Sin imagen, el
          panel queda gris.
        </p>
      </div>
      {current.isPending ? (
        <Skeleton className="aspect-[4/5] w-full max-w-[240px] rounded-lg" />
      ) : (
        <div className="aspect-[4/5] w-full max-w-[240px] overflow-hidden rounded-lg border bg-muted">
          {url && (
            <img
              src={url}
              alt="Imagen actual del inicio de sesión"
              className="size-full object-cover"
            />
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={busy || current.isPending}
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
      {(error ?? (current.isError ? errorMessage(current.error) : null)) && (
        <span role="alert" className="text-xs text-destructive">
          {error ?? errorMessage(current.error)}
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
          aspect={4 / 5}
          title="Encuadra la imagen del inicio de sesión"
          confirmLabel="Usar imagen"
          onCancel={() => setPending(null)}
          onConfirm={(area) => void confirm(area)}
        />
      )}
    </Card>
  )
}
