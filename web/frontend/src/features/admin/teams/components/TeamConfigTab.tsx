import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Card } from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { QueryError, SaveBar } from "../../components/ui"
import {
  teamConfigOptions,
  useSaveTeamConfig,
  type TeamConfig,
} from "../api/queries"

// Mismos rangos que la API (TeamConfig).
const RANGE: Record<keyof TeamConfig, [number, number]> = {
  max_members: [2, 30],
  max_led: [1, 10],
  rename_days: [0, 365],
}
const valid = (k: keyof TeamConfig, n: number) =>
  Number.isInteger(n) && n >= RANGE[k][0] && n <= RANGE[k][1]

/** Pestaña "Configuración equipo" (solo admin): reglas de todos los equipos oficiales. */
export function TeamConfigTab() {
  const id = useId()
  const config = useQuery(teamConfigOptions)
  const save = useSaveTeamConfig()
  const [draft, setDraft] = useState<TeamConfig | null>(null)
  const current = draft ?? config.data
  const dirty =
    !!draft &&
    !!config.data &&
    (draft.max_members !== config.data.max_members ||
      draft.max_led !== config.data.max_led ||
      draft.rename_days !== config.data.rename_days)
  const ok =
    !!current &&
    valid("max_members", current.max_members) &&
    valid("max_led", current.max_led) &&
    valid("rename_days", current.rename_days)

  const field = (k: keyof TeamConfig) => (v: string) =>
    current && setDraft({ ...current, [k]: v === "" ? -1 : Number(v) })

  return (
    <section className={cn("flex flex-col gap-5", dirty && "pb-24")}>
      {config.isError ? (
        <QueryError
          error={config.error}
          onRetry={() => void config.refetch()}
        />
      ) : !current ? (
        <Skeleton className="h-48 max-w-[560px] rounded-xl" />
      ) : (
        <Card
          variant="outline"
          className="flex max-w-[560px] flex-col gap-4 p-4"
        >
          <h2 className="text-[17px] font-bold">Plantel y líderes</h2>
          <NumberField
            id={`${id}-m`}
            label="Máximo de miembros"
            help="Jugadores, suplentes y coach. Bajarlo no saca a nadie: solo no entra gente nueva."
            value={current.max_members}
            range={RANGE.max_members}
            onChange={field("max_members")}
          />
          <NumberField
            id={`${id}-l`}
            label="Equipos por líder"
            help="De cuántos equipos activos puede ser líder una persona (al crear uno o al recibir el liderazgo). Bajarlo no le quita el liderazgo a nadie."
            value={current.max_led}
            range={RANGE.max_led}
            onChange={field("max_led")}
          />
          <NumberField
            id={`${id}-n`}
            label="Días entre cambios de nombre"
            help="Cada cuántos días el líder puede cambiar el nombre y la sigla de su equipo. 0 = cuando quiera. El logo se cambia siempre."
            value={current.rename_days}
            range={RANGE.rename_days}
            onChange={field("rename_days")}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Para inscribirse en un torneo, cada equipo necesita los jugadores
            activos que pide el modo. En el ranking de equipos solo aparecen los
            que tienen al menos 5 jugadores o suplentes.
          </p>
        </Card>
      )}

      {dirty && (
        <SaveBar
          title="Cambios sin guardar"
          hint={
            !ok
              ? `Miembros: de ${RANGE.max_members[0]} a ${RANGE.max_members[1]}. Equipos por líder: de ${RANGE.max_led[0]} a ${RANGE.max_led[1]}. Días entre cambios de nombre: de ${RANGE.rename_days[0]} a ${RANGE.rename_days[1]}.`
              : save.isError
                ? errorMessage(save.error)
                : "Vale para todos los equipos desde ahora."
          }
          error={!ok || save.isError}
          pending={save.isPending}
          disabled={!ok}
          onDiscard={() => {
            setDraft(null)
            save.reset()
          }}
          onSave={() =>
            draft &&
            save.mutate(draft, {
              onSuccess: () => {
                setDraft(null)
                toast.success("Reglas de los equipos guardadas.")
              },
            })
          }
        />
      )}
    </section>
  )
}

function NumberField({
  id,
  label,
  help,
  value,
  range,
  onChange,
}: {
  id: string
  label: string
  help: string
  value: number
  range: [number, number]
  onChange: (v: string) => void
}) {
  return (
    <Field
      orientation="horizontal"
      className="gap-3 has-[>[data-slot=field-content]]:items-center"
    >
      <FieldContent className="leading-normal">
        <FieldLabel htmlFor={id} className="text-sm leading-none">
          {label}
        </FieldLabel>
        <FieldDescription>{help}</FieldDescription>
      </FieldContent>
      <Input
        id={id}
        type="number"
        min={range[0]}
        max={range[1]}
        value={value < 0 ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 text-center font-mono"
      />
    </Field>
  )
}
