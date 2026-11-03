import { AuthHeading } from "@/features/auth/components/ui"
import type { SteamStatus } from "../types"

/**
 * Paso de Vinculación de la Bienvenida. Solo explica: el !claim se hace en la primera partida del
 * matchmaking y el código lo muestra la sala (`ClaimCard`), así que aquí no se pide código ni se
 * espera la confirmación (bitácora 2026-11-02-mm-claim-en-sala).
 */
export function ClaimStep({ status }: { status: SteamStatus | undefined }) {
  const primary =
    status?.steam_ids.find((s) => s.is_primary) ?? status?.steam_ids[0]

  if (primary)
    return (
      <>
        <AuthHeading
          size="lg"
          title="Tu jugador ya está vinculado"
          subtitle="Tus mixes, stats y ELO llegan a tu perfil."
        />
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-lg bg-win/14 px-3 py-2.5 text-[13px] text-win"
        >
          <span
            className="size-2 shrink-0 rounded-full bg-current"
            aria-hidden
          />
          <span className="flex-1">
            Vinculado: SteamID {primary.steam_id.slice(0, 13)}…
          </span>
        </div>
      </>
    )

  const steps = [
    "Busca partida en Jugar.",
    "En la sala de tu primera partida te mostramos tu código.",
    <>
      Cuando entres al servidor, escríbelo en el chat:{" "}
      <code className="rounded-[4px] bg-muted px-1.5 py-px font-mono text-[13px] font-semibold">
        !claim CÓDIGO
      </code>
    </>,
  ]

  return (
    <>
      <AuthHeading
        size="lg"
        title="Vincula tu jugador"
        subtitle="Así tus mixes, stats y ELO llegan a tu perfil. Lo haces en tu primera partida, sin esperar a un admin."
      />

      <ol className="flex flex-col gap-2.5">
        {steps.map((text, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground font-mono text-[11px] font-semibold text-background">
              {i + 1}
            </span>
            <span className="pt-0.5 leading-[1.45]">{text}</span>
          </li>
        ))}
      </ol>

      <p className="text-[13px] text-muted-foreground">
        Hasta que lo escribas, el servidor te deja de espectador. Después pasas
        a tu equipo y no tienes que repetirlo.
      </p>
    </>
  )
}
