import { useEffect, useRef, useState, type FormEvent } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useUploadAvatar } from "@/features/profile/queries"
import { cropAvatar, ImageError } from "@/lib/image"
import { FormAlert } from "../FormAlert"
import { StepActions } from "./StepActions"

export function AvatarStep({
  onDone,
  alias,
}: {
  onDone: () => void
  alias: string
}) {
  const upload = useUploadAvatar()
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const urlRef = useRef<string | null>(null)
  const blob = image?.blob ?? null

  // Libera la URL de la vista previa al cambiar de imagen y al salir del paso.
  function replaceImage(next: Blob | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = next ? URL.createObjectURL(next) : null
    urlRef.current = url
    setImage(next && url ? { blob: next, url } : null)
  }
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    []
  )

  async function onFile(file: File | undefined) {
    setFileError(null)
    replaceImage(null)
    if (!file) return
    setProcessing(true)
    try {
      replaceImage(await cropAvatar(file))
    } catch (e) {
      setFileError(
        e instanceof ImageError ? e.message : "No se pudo procesar la imagen."
      )
    } finally {
      setProcessing(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!blob) return onDone()
    try {
      await upload.mutateAsync(blob)
      onDone()
    } catch {
      // El error se muestra con FormAlert.
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <FormAlert error={upload.error} />
        <div className="flex justify-center">
          <Avatar className="size-24">
            {image && (
              <AvatarImage src={image.url} alt="Vista previa del avatar" />
            )}
            <AvatarFallback className="text-2xl">
              {alias.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        <Field data-invalid={!!fileError}>
          <FieldLabel htmlFor="avatar">Imagen</FieldLabel>
          <Input
            id="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => onFile(e.target.files?.[0])}
            aria-invalid={!!fileError}
          />
          <FieldDescription>
            JPG, PNG o WebP. Se recorta a un cuadrado de 256 px.
          </FieldDescription>
          {fileError && <FieldError>{fileError}</FieldError>}
        </Field>
        <StepActions
          busy={upload.isPending || processing}
          onSkip={onDone}
          submitLabel="Guardar y terminar"
          disabled={!blob}
        />
      </FieldGroup>
    </form>
  )
}
