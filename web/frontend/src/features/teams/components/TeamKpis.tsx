import { cn } from "cn"
import { formatNumber } from "@/features/public/lib/format"

// --- KPIs ----------------------------------------------------------------

export function TeamKpis({
  rank,
  points,
  winRate,
  titles,
  eventsPlayed,
}: {
  rank: number | null
  points: number
  winRate: number | null
  titles: number
  eventsPlayed: number
}) {
  const items: { label: string; value: string; accent?: boolean }[] = [
    { label: "Ranking", value: rank ? `#${rank}` : "—", accent: true },
    { label: "Puntos", value: formatNumber(points) },
    { label: "% de victorias", value: winRate === null ? "—" : `${winRate}%` },
    { label: "Títulos", value: String(titles) },
    { label: "Torneos jugados", value: String(eventsPlayed) },
  ]
  return (
    <dl className="grid grid-cols-2 border-t sm:grid-cols-3 lg:grid-cols-5">
      {items.map((k) => (
        <div
          key={k.label}
          className="flex flex-col gap-1 border-b px-5 py-4 last:border-b-0 sm:border-r lg:border-b-0 lg:last:border-r-0"
        >
          <dt className="text-xs text-muted-foreground">{k.label}</dt>
          <dd
            className={cn(
              "font-mono text-2xl font-bold tracking-[-1px]",
              k.accent && "text-primary"
            )}
          >
            {k.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
