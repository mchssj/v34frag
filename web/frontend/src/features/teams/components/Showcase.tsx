import { Link } from "@tanstack/react-router"
import { TrophyIcon } from "lucide-react"
import { prizeOrNull, type PrizeFields } from "@/features/events/lib/model"
import { timeAgo } from "@/features/shell/notifications/lib/model"

// --- Vitrina ------------------------------------------------------------

type Title = PrizeFields & {
  id: string
  name: string
  ends_on: string | null
  /** Fin real (última partida); `ends_on` es el tentativo. */
  finished_at?: string | null
}

/** Cuándo salió campeón: el fin real si está; si no, el tentativo. */
const endOf = (t: Title) => t.finished_at ?? t.ends_on

export function Showcase({
  titles,
  eventsPlayed,
}: {
  titles: Title[]
  eventsPlayed: number
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-baseline gap-2.5 text-xl font-bold tracking-[-0.4px]">
        Vitrina
        <span className="text-sm font-normal text-muted-foreground">
          {titles.length === 1 ? "1 título" : `${titles.length} títulos`} ·{" "}
          {eventsPlayed === 1
            ? "1 torneo jugado"
            : `${eventsPlayed} torneos jugados`}
        </span>
      </h2>
      {titles.length === 0 ? (
        <p className="rounded-hero border border-dashed px-5 py-6 text-sm text-muted-foreground">
          Todavía no ganó un torneo.
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-3">
          {titles.map((t) => (
            <li key={t.id}>
              <Link
                to="/events/$id"
                params={{ id: t.id }}
                className="flex flex-col gap-3 rounded-hero border border-primary/35 bg-[linear-gradient(160deg,color-mix(in_oklch,var(--primary)_10%,var(--card)),var(--card)_65%)] p-5 outline-none hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="grid size-11 place-items-center rounded-tile bg-primary text-primary-foreground">
                  <TrophyIcon className="size-5" aria-hidden />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-lg font-bold tracking-[-0.3px]">
                    {t.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {[
                      "Campeón",
                      endOf(t) && timeAgo(endOf(t) ?? ""),
                      prizeOrNull(t),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
