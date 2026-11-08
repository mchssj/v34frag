import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { AwardIcon } from "lucide-react"

import { EmptyState } from "@/components/brand/EmptyState"
import { QueryErrorMessage } from "@/components/brand/QueryState"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Medal } from "@/features/medals/Medal"
import { medalListOptions, medalProgressOptions } from "../../api/queries"
import { buildAchievements, type Item } from "../../lib/achievements"

// ---------- Logros (plan 2026-11-04-medallas-configurables, sección 9.3) ----------

export function Achievements({ nick }: { nick: string }) {
  const list = useQuery(medalListOptions(nick))
  const progress = useQuery(medalProgressOptions(nick))

  if (list.isError || progress.isError)
    return (
      <Card variant="outline" className="px-4 py-8 text-center">
        <QueryErrorMessage
          error={list.error ?? progress.error}
          onRetry={() => {
            void list.refetch()
            void progress.refetch()
          }}
        />
      </Card>
    )
  if (!list.data || !progress.data)
    return <Skeleton className="h-64 rounded-xl" />

  const p = progress.data
  const a = buildAchievements(list.data, p.items)
  // Sin temporada 2 todavía: las stats de la BETA no cuentan y el motor no da medallas.
  const beta = p.stats_since === null
  if (!a.sections.length)
    return (
      <Card variant="outline" className="pb-6">
        <EmptyState
          icon={AwardIcon}
          title="Todavía sin medallas"
          className="pt-10"
        >
          Las medallas se ganan jugando: victorias, kills, headshots, armas,
          mapas y más. Las de temporada llegan al cerrar cada temporada.
          {beta && ` ${BETA_NOTE}`}
        </EmptyState>
      </Card>
    )

  return (
    <div className="flex flex-col gap-4">
      {beta && (
        <Card
          variant="outline"
          className="px-4 py-3 text-sm text-muted-foreground"
        >
          {BETA_NOTE}
        </Card>
      )}
      {a.showcase.length > 0 && (
        <Card variant="outline" className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[17px] font-bold">Vitrina</h2>
            <span className="text-[13px] text-muted-foreground">
              Las de más nivel, en grande.
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {a.showcase.map((i) => (
              <div
                key={i.key}
                className="flex flex-col items-center gap-1.5 text-center"
              >
                <Medal look={i.look} size={120} title={i.title} />
                <span className="text-sm font-semibold">{i.title}</span>
                <span className="text-xs text-muted-foreground">{i.sub}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Counter label="Obtenidas" value={String(a.got)} />
        <Counter label="En camino" value={p.hidden ? "—" : String(a.pending)} />
        <Counter
          label="La más cerca"
          value={
            a.closest && !p.hidden
              ? `${a.closest.title} · ${a.closest.pct} %`
              : "—"
          }
        />
      </div>

      {a.sections.map((s) => (
        <Card
          key={s.title}
          variant="outline"
          className="flex flex-col gap-3 p-5"
        >
          <h2 className="text-[15px] font-bold">{s.title}</h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {s.items.map((i) => (
              <AchievementCard key={i.key} i={i} />
            ))}
          </ul>
        </Card>
      ))}

      {p.hidden && (
        <p className="text-xs text-muted-foreground">
          Solo el dueño del perfil ve el progreso de las medallas bloqueadas.
        </p>
      )}
    </div>
  )
}

const BETA_NOTE =
  "Durante la Temporada BETA no se ganan medallas: tus stats cuentan desde la próxima temporada. Al empezar, quienes jugaron la BETA reciben la de Fundador."

function Counter({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="outline" className="flex flex-col gap-1 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-lg font-semibold">{value}</span>
    </Card>
  )
}

function AchievementCard({ i }: { i: Item }) {
  return (
    <li
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-xl p-3 text-center",
        i.locked && "bg-muted/50"
      )}
    >
      <Medal look={i.look} locked={i.locked} size={88} title={i.title} />
      <span className="text-[13px] font-semibold">{i.title}</span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {i.locked ? `Siguiente: ${i.sub}` : i.sub}
      </span>
      {i.locked && (
        <span
          role="progressbar"
          aria-valuenow={i.pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso de ${i.title}`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${i.pct}%` }}
          />
        </span>
      )}
    </li>
  )
}
