import { useQuery } from "@tanstack/react-query"
import { ClockIcon, ImageUpIcon } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorAlert } from "@/features/auth/ui"
import { myTeamRequestOptions, useRequestTeam } from "./queries"
import { useLogoPicker } from "./TeamLogo"
import { GridBackdrop, TeamCrest } from "./ui"

// Mismas reglas que el backend (TeamRequestBody): nombre de 2 a 40 y sigla de 1 a 6.
const NAME = { min: 2, max: 40 }
const TAG_MAX = 6

/** Crear equipo: nombre y sigla. Lo aprueba un admin; mientras tanto, la solicitud pendiente. */
export function CreateTeam({
  onCancel,
  startEditing = false,
}: {
  onCancel: () => void
  /** Abre la solicitud pendiente directo en el formulario (desde "Editar solicitud"). */
  startEditing?: boolean
}) {
  const request = useQuery(myTeamRequestOptions).data
  const send = useRequestTeam()
  const editable = startEditing && request?.status === "pending"
  const [name, setName] = useState(editable ? request.name : "")
  const [tag, setTag] = useState(editable ? (request.tag ?? "") : "")
  const [editing, setEditing] = useState(editable)
  // Logo ya recortado, a la espera de enviar la solicitud, con su vista previa.
  const [logo, setLogo] = useState<{ blob: Blob; src: string } | null>(null)
  const picker = useLogoPicker((blob) => {
    setLogo({ blob, src: URL.createObjectURL(blob) })
  }, false)

  // Libera la vista previa al cambiar de logo o al desmontar.
  useEffect(() => {
    if (!logo) return
    return () => URL.revokeObjectURL(logo.src)
  }, [logo])

  const valid =
    name.trim().length >= NAME.min &&
    name.trim().length <= NAME.max &&
    tag.trim().length >= 1

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    try {
      await send.mutateAsync({
        name: name.trim(),
        tag: tag.trim(),
        logo: logo?.blob,
      })
      setEditing(false)
    } catch {
      // Se muestra con ErrorAlert.
    }
  }

  if (request?.status === "pending" && !editing)
    return (
      <Shell>
        <TeamCrest team={request} size="xl" />
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="text-2xl font-bold tracking-[-0.5px]">
            {request.name}
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ClockIcon className="size-4 text-primary" aria-hidden />
            Solicitud pendiente: la revisa un admin.
          </p>
          <p className="max-w-[360px] text-sm text-pretty text-muted-foreground">
            Cuando la apruebe, quedas como líder y primer jugador del equipo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Volver
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setName(request.name)
              setTag(request.tag ?? "")
              setEditing(true)
            }}
          >
            Editar solicitud
          </Button>
        </div>
      </Shell>
    )

  const preview = {
    name: name.trim() || "Tu equipo",
    tag: tag.trim() || "TAG",
    logo_url: logo?.src ?? (editing ? request?.logo_url : null),
  }
  return (
    <Shell>
      <form
        onSubmit={(e) => void submit(e)}
        noValidate
        className="flex w-full max-w-[360px] flex-col items-center gap-4"
      >
        <TeamCrest team={preview} size="xl" />
        <span className="text-2xl font-bold tracking-[-0.5px]">
          {preview.name}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={picker.open}>
          <ImageUpIcon aria-hidden />
          {logo ? "Cambiar imagen" : "Subir imagen"}
        </Button>
        {picker.error && <ErrorAlert message={picker.error} />}
        {picker.elements}
        <p className="text-center text-xs text-pretty text-muted-foreground">
          PNG, JPG o WebP. La encuadras en cuadrado antes de enviarla. Si no
          subes una, el escudo muestra la sigla.
        </p>
        <div className="grid w-full grid-cols-[1fr_110px] gap-2.5">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Nombre
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Lobos del Sur"
              maxLength={NAME.max}
              className="h-10"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Sigla
            <Input
              value={tag}
              onChange={(e) =>
                setTag(e.target.value.toUpperCase().replace(/\s/g, ""))
              }
              placeholder="LDS"
              maxLength={TAG_MAX}
              className="h-10 font-mono"
            />
          </label>
        </div>
        {send.error != null && (
          <ErrorAlert message={errorMessage(send.error)} />
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => (editing ? setEditing(false) : onCancel())}
          >
            Cancelar
          </Button>
          <Button type="submit" size="md" disabled={!valid || send.isPending}>
            Enviar solicitud
          </Button>
        </div>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    // Ocupa todo el alto disponible, con el contenido centrado.
    <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-[calc(var(--radius)+8px)] border bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_10%,var(--card)),var(--card)_60%)] px-6 py-12">
      <GridBackdrop />
      <div className="relative flex w-full flex-col items-center gap-5">
        {children}
      </div>
    </section>
  )
}
