import { ImageUpIcon } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorAlert } from "@/components/brand/ErrorAlert"
import { useCreateTeam } from "../api/queries"
import { useLogoPicker } from "../components/TeamLogo"
import { GridBackdrop } from "../components/ui"
import { TeamCrest } from "@/components/brand/TeamCrest"

// Mismas reglas que el backend (TeamCreateBody): nombre de 2 a 40 y sigla de 1 a 6.
const NAME = { min: 2, max: 40 }
const TAG_MAX = 6

/** Crear equipo: nombre, sigla y logo opcional. Queda creado al instante, con quien lo crea como líder. */
export function CreateTeam({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: (id: string) => void
}) {
  const create = useCreateTeam()
  const [name, setName] = useState("")
  const [tag, setTag] = useState("")
  // Logo ya recortado, a la espera de crear el equipo, con su vista previa.
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
      const id = await create.mutateAsync({
        name: name.trim(),
        tag: tag.trim(),
        logo: logo?.blob,
      })
      onCreated(id)
    } catch {
      // Se muestra con ErrorAlert.
    }
  }

  const preview = {
    name: name.trim() || "Tu equipo",
    tag: tag.trim() || "TAG",
    logo_url: logo?.src ?? null,
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
          PNG, JPG o WebP. La encuadras en cuadrado antes de subirla. Si no
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
        <p className="text-center text-xs text-pretty text-muted-foreground">
          El equipo se crea al instante y quedas como líder. Para inscribirlo en
          un torneo necesita los jugadores que pide el modo (5 en 5v5).
        </p>
        {create.error != null && (
          <ErrorAlert message={errorMessage(create.error)} />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="md" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" size="md" disabled={!valid || create.isPending}>
            Crear equipo
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
