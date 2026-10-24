import { cn } from "cn"
import { CameraIcon } from "lucide-react"
import { useEffect, useRef, useState, type DragEvent } from "react"

import { errorMessage } from "@/api/errors"
import { Spinner } from "@/components/ui/spinner"
import {
  checkAvatarSource,
  cropAvatar,
  ImageError,
  type CropArea,
} from "@/lib/image"
import { AvatarCropDialog } from "./AvatarCropDialog"
import { useUploadAvatar } from "./queries"

/**
 * Foto de perfil: clic o arrastrar una imagen, encuadrarla (arrastre y zoom) y se sube recortada
 * a 256×256.
 */
export function AvatarPicker({
  url,
  initial,
  size,
  title = "Foto de perfil",
  hint = "Arrastra una imagen. JPEG, PNG o WebP · máximo 1 MB. Se recorta a 256×256.",
}: {
  url: string | null | undefined
  /** Inicial del alias cuando no hay foto. */
  initial: string
  size: "md" | "lg"
  title?: string
  hint?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const upload = useUploadAvatar()
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  // Imagen elegida, a la espera del encuadre.
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
      await upload.mutateAsync(await cropAvatar(pending.file, area))
    } catch (e) {
      setError(e instanceof ImageError ? e.message : errorMessage(e))
    }
    setPending(null)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files[0])
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-label="Elegir foto de perfil"
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-dashed bg-secondary text-xl font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          size === "lg" ? "size-[88px]" : "size-[72px]",
          dragging && "border-primary ring-3 ring-primary/30"
        )}
      >
        {url ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <span aria-hidden>{initial}</span>
        )}
        <span className="absolute inset-x-0 bottom-0 grid h-6 place-items-center bg-black/45 text-white">
          {upload.isPending ? (
            <Spinner className="size-3.5" />
          ) : (
            <CameraIcon className="size-3.5" aria-hidden />
          )}
        </span>
      </button>
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
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
        {error && (
          <span role="alert" className="text-xs text-destructive">
            {error}
          </span>
        )}
      </div>
      {pending && (
        <AvatarCropDialog
          key={pending.src}
          src={pending.src}
          busy={upload.isPending}
          onCancel={() => setPending(null)}
          onConfirm={(area) => void confirm(area)}
        />
      )}
    </div>
  )
}
