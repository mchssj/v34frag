import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ImageUpIcon, StoreIcon, Trash2Icon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button, buttonVariants } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { myProfileOptions } from "@/features/profile/api/queries"
import { AvatarCropDialog } from "@/features/profile/components/AvatarCropDialog"
import { CardTitle, SectionCard } from "@/features/profile/components/ui"
import {
  checkAvatarSource,
  cropImage,
  ImageError,
  type CropArea,
} from "@/lib/image"

import { useDeleteCover, useUploadCover } from "./api"

/**
 * Portada del perfil (replanteo 113): se elige una imagen, se encuadra en 3:1 y se guarda a 2400×800 (hasta
 * 1 MB, el límite del bucket; si pesa más, baja la calidad del JPEG), para que se vea nítida a todo el ancho en
 * pantallas de alta densidad (bitácora 2026-11-14-portada-calidad-y-staff). Se puede alejar para que una foto
 * entre entera: lo que sobra se rellena con la misma foto difuminada (bitácora 2026-11-15-portada-encuadre).
 * Se ve arriba de la ficha pública. Un admin la puede quitar.
 */
export function CoverCard() {
  const cover = useQuery(myProfileOptions).data?.details.cover_url ?? null
  const upload = useUploadCover()
  const remove = useDeleteCover()
  const busy = upload.isPending || remove.isPending
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ file: File; src: string } | null>(
    null
  )

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
      const blob = await cropImage(pending.file, area, {
        width: 2400,
        height: 800,
        maxBytes: 1024 * 1024,
        fill: true,
      })
      await upload.mutateAsync(blob)
      toast.success("Portada actualizada.")
    } catch (e) {
      setError(e instanceof ImageError ? e.message : errorMessage(e))
    }
    setPending(null)
  }

  async function clear() {
    setError(null)
    try {
      await remove.mutateAsync()
      toast.success("Portada quitada.")
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <SectionCard className="flex flex-col gap-3 p-5">
      <CardTitle
        title="Portada y cosméticos"
        description="La portada va arriba de tu perfil. Los marcos, los temas, los efectos de nombre y los stickers se consiguen en la Tienda con los puntos de tus mixes."
      />
      <div
        className="aspect-[3/1] max-w-[640px] rounded-lg border bg-muted bg-cover bg-center"
        style={
          cover
            ? { backgroundImage: `url("${cover}")` }
            : {
                backgroundImage:
                  "linear-gradient(120deg,var(--primary),transparent 70%)",
              }
        }
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
          {cover ? "Cambiar portada" : "Subir portada"}
        </Button>
        {cover && (
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
        <Link
          to="/shop"
          className={buttonVariants({ size: "sm", variant: "ghost" })}
        >
          <StoreIcon aria-hidden />
          Ir a la Tienda
        </Link>
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
          aspect={3}
          minZoom={0.3}
          description="Arrástrala y usa el zoom. Si la alejas para que entre entera, lo que sobra se rellena con la misma foto difuminada."
          title="Encuadra tu portada"
          confirmLabel="Usar portada"
          onCancel={() => setPending(null)}
          onConfirm={(area) => void confirm(area)}
        />
      )}
    </SectionCard>
  )
}
