import { Input } from "@/components/ui/input"
import { AuthHeading } from "@/features/auth/ui"
import { AvatarPicker } from "@/features/profile/AvatarPicker"
import { Greeting } from "./Greeting"

/** Paso "Foto y nombre": los dos opcionales. La foto se sube al elegirla. */
export function PhotoStep({
  alias,
  greet,
  avatarUrl,
  name,
  nameError,
  onName,
}: {
  alias: string
  greet: boolean
  avatarUrl: string | null | undefined
  name: string
  nameError: string | null
  onName: (name: string) => void
}) {
  const initial = alias.slice(0, 1).toUpperCase()
  const trimmed = name.trim()
  return (
    <>
      <div className="flex flex-col gap-1.5">
        {greet && <Greeting alias={alias} />}
        <AuthHeading
          size="lg"
          title="Ponle cara a tu alias"
          subtitle="Tu foto aparece en el ranking, los planteles y el chat. Los dos campos son opcionales."
        />
      </div>

      <AvatarPicker url={avatarUrl} initial={initial} size="lg" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="real_name" className="text-[13px] font-medium">
          Nombre real
          <span className="font-normal text-muted-foreground"> · opcional</span>
        </label>
        <Input
          id="real_name"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Ej. Martín Ruiz"
          maxLength={60}
          autoComplete="name"
          aria-invalid={!!nameError}
          aria-describedby="real_name-help"
          className="h-9 text-sm dark:bg-transparent"
        />
        <p id="real_name-help" className="text-xs text-muted-foreground">
          Solo lo ven los admins y los capitanes de tu equipo. En la web te
          mostramos por tu alias.
        </p>
        {nameError && (
          <p role="alert" className="text-xs text-destructive">
            {nameError}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 rounded-tile border bg-card px-3.5 py-3">
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary font-semibold">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            initial
          )}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-semibold">{alias}</span>
          <span className="text-xs text-muted-foreground">
            {trimmed
              ? `${trimmed} · visible para admins y capitanes`
              : "Nuevo jugador · empieza con 1000 ELO"}
          </span>
        </span>
      </div>
    </>
  )
}
