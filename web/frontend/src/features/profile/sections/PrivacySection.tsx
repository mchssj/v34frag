import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"

import { myProfileOptions, playerDetailOptions } from "../queries"
import { CardTitle, SectionCard } from "../ui"

const OPTIONS = [
  {
    value: "public",
    label: "Público",
    description: "Cualquiera ve tu nombre real, país y redes.",
  },
  {
    value: "private",
    label: "Privado",
    description:
      "Se ocultan tu nombre real y tus redes. Tu alias, ficha, stats y partidas siguen visibles.",
  },
] as const

/**
 * Privacidad: hoy solo la cambia un admin (TODO backend: endpoint para el usuario). Se muestra
 * la actual, que sale de la ficha del jugador vinculado.
 */
export function PrivacySection() {
  const playerId = useQuery(myProfileOptions).data?.player?.id
  const privacy = useQuery({
    ...playerDetailOptions(playerId ?? ""),
    select: (p) => p.privacy,
    enabled: !!playerId,
  }).data

  return (
    <SectionCard className="flex flex-col gap-3.5 p-5">
      <CardTitle
        title="Visibilidad del perfil"
        description="Tu ficha, stats y partidas son siempre públicas."
      />
      <div
        role="radiogroup"
        aria-label="Visibilidad del perfil"
        aria-disabled
        className="flex flex-col gap-3.5"
      >
        {OPTIONS.map((o) => {
          const on = privacy === o.value
          return (
            <div
              key={o.value}
              role="radio"
              aria-checked={on}
              aria-disabled
              className={cn(
                "flex items-start gap-3 rounded-tile border p-3.5 opacity-70",
                on && "border-primary bg-primary/6"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-px grid size-[18px] shrink-0 place-items-center rounded-full border",
                  on && "border-primary"
                )}
              >
                {on && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <span className="flex flex-col gap-[3px]">
                <span className="text-sm font-semibold">{o.label}</span>
                <span className="text-[13px] leading-[1.45] text-muted-foreground">
                  {o.description}
                </span>
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-[13px] text-muted-foreground">
        {playerId
          ? "Muy pronto vas a poder cambiarla desde acá."
          : "Se aplica cuando vincules tu jugador."}
      </p>
    </SectionCard>
  )
}
