import { useQuery } from "@tanstack/react-query"
import { useId } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Chip, PanelSection } from "../../components/ui"
import type { Tone } from "../../lib/format"
import {
  serverFlagsOptions,
  useSetServerFlag,
  type FlagKey,
} from "../api/flags"

const FLAGS: { key: FlagKey; label: string; hint: string }[] = [
  {
    key: "official_enabled",
    label: "Torneos",
    hint: 'Aparece en "Iniciar la partida" de los organizadores.',
  },
  {
    key: "pcw_enabled",
    label: "PCW",
    hint: "Lo toma la fila de PCW cuando los dos equipos están listos.",
  },
  {
    key: "mm_enabled",
    label: "Matchmaking",
    hint: "Recibe las salas de la cola.",
  },
]

const STATE: Record<string, [string, Tone]> = {
  free: ["Libre", "win"],
  lobby: ["Con una sala", "warn"],
  booking: ["Reservado", "warn"],
  live: ["En vivo", "warn"],
  offline: ["Sin consultar", "neutral"],
}

/** Para qué se usa el servidor. El plugin solo necesita `csstv_mm "1"`; las marcas son de la web. */
export function UsesSection({ serverId }: { serverId: string }) {
  const id = useId()
  const q = useQuery(serverFlagsOptions)
  const set = useSetServerFlag()
  const s = q.data?.find((x) => x.id === serverId)
  if (!s) return null
  const [stateText, tone] = STATE[s.state] ?? ["—", "neutral"]

  return (
    <PanelSection
      title="Usos del servidor"
      aside={<Chip tone={tone}>{stateText}</Chip>}
    >
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Un servidor libre se asigna al primero que lo pide, entre los usos que
        tenga prendidos. Para recibir algo, el servidor tiene que tener{" "}
        <span className="font-mono">csstv_mm "1"</span> en el cfg: con eso la
        contraseña la maneja la web y deja de servir para mixes públicos.
      </p>
      <div className="flex flex-col gap-2.5">
        {FLAGS.map((f) => (
          <div key={f.key} className="flex items-start gap-3">
            <Switch
              id={`${id}-${f.key}`}
              checked={s[f.key]}
              disabled={set.isPending}
              onCheckedChange={(value) =>
                set.mutate(
                  { id: s.id, flag: f.key, value },
                  {
                    onSuccess: () =>
                      toast.success(
                        `${f.label}: ${value ? "prendido" : "apagado"} en ${s.name}.`
                      ),
                    onError: (e) => toast.error(errorMessage(e)),
                  }
                )
              }
            />
            <div className="flex flex-col gap-0.5">
              <Label htmlFor={`${id}-${f.key}`}>{f.label}</Label>
              <span className="text-xs text-muted-foreground">{f.hint}</span>
            </div>
          </div>
        ))}
      </div>
    </PanelSection>
  )
}
