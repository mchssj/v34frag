import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { AdminHeader, Card, EmptyState, QueryError, SaveBar } from "../ui"
import {
  rankingConfigOptions,
  rankingTopOptions,
  useSaveRankingConfig,
  type RankingConfig,
} from "./queries"

export const MAX_POINTS = 1000

type TopTeam = { team: { id: string; name: string }; won: number; lost: number }

/** El top de torneos con otros puntos por victoria (mismo desempate que la API: victorias y derrotas). */
export function rerank<T extends TopTeam>(items: T[], perWin: number) {
  return items
    .map((t) => ({ ...t, newPoints: t.won * perWin }))
    .sort(
      (a, b) => b.newPoints - a.newPoints || b.won - a.won || a.lost - b.lost
    )
}

const valid = (n: number) => Number.isInteger(n) && n >= 0 && n <= MAX_POINTS

export function AdminRankingPage() {
  const id = useId()
  const config = useQuery(rankingConfigOptions)
  const top = useQuery(rankingTopOptions)
  const save = useSaveRankingConfig()
  const [draft, setDraft] = useState<RankingConfig | null>(null)
  const current = draft ?? config.data
  const dirty =
    !!draft &&
    !!config.data &&
    (draft.win_official !== config.data.win_official ||
      draft.win_pcw !== config.data.win_pcw)
  const ok = !!current && valid(current.win_official) && valid(current.win_pcw)

  const field = (k: keyof RankingConfig) => (v: string) =>
    current && setDraft({ ...current, [k]: v === "" ? -1 : Number(v) })

  return (
    <section className={cn("flex flex-col gap-5", dirty && "pb-24")}>
      <AdminHeader
        title="Ranking de equipos"
        subtitle="Cuántos puntos suma un equipo por cada partida que gana. Vale para todo el ranking, también para lo ya jugado: los puntos se calculan con el valor de hoy."
      />
      {config.isError ? (
        <QueryError
          error={config.error}
          onRetry={() => void config.refetch()}
        />
      ) : !current ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <div className="flex flex-wrap items-start gap-5">
          <Card className="min-w-0 flex-[1_1_340px] gap-4">
            <h2 className="text-[17px] font-bold">Puntos por partida ganada</h2>
            <PointsField
              id={`${id}-o`}
              label="Partida de torneo"
              help="En el ranking de siempre."
              value={current.win_official}
              onChange={field("win_official")}
            />
            <PointsField
              id={`${id}-p`}
              label="PCW"
              help='Solo en la vista "con PCW" del ranking, y si la jugó como el equipo.'
              value={current.win_pcw}
              onChange={field("win_pcw")}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Un W.O. no suma puntos. Los puntos son por partida ganada, no por
              ganar el torneo.
            </p>
          </Card>

          <Card className="min-w-0 flex-[999_1_480px]">
            <div className="flex flex-col gap-1">
              <h2 className="text-[17px] font-bold">
                Así quedaría el top de torneos
              </h2>
              <span className="text-[13px] text-muted-foreground">
                Con {valid(current.win_official) ? current.win_official : "—"}{" "}
                puntos por partida de torneo ganada.
              </span>
            </div>
            {top.isError ? (
              <QueryError
                error={top.error}
                onRetry={() => void top.refetch()}
              />
            ) : top.isPending ? (
              <Skeleton className="h-60 rounded-lg" />
            ) : top.data.length === 0 ? (
              <EmptyState>Todavía no hay equipos en el ranking.</EmptyState>
            ) : (
              <ol className="flex flex-col">
                {rerank(top.data, Math.max(0, current.win_official)).map(
                  (t, i) => (
                    <li
                      key={t.team.id}
                      className="flex items-center gap-3 border-t py-2 text-sm first:border-t-0"
                    >
                      <span className="w-6 font-mono text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {t.team.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t.won} G · {t.lost} P
                      </span>
                      <span className="w-28 text-right font-mono">
                        {t.points !== t.newPoints && (
                          <span className="text-muted-foreground">
                            {t.points} →{" "}
                          </span>
                        )}
                        {t.newPoints}
                      </span>
                    </li>
                  )
                )}
              </ol>
            )}
          </Card>
        </div>
      )}

      {dirty && (
        <SaveBar
          title="Cambios sin guardar"
          hint={
            !ok
              ? `Cada valor va de 0 a ${MAX_POINTS}.`
              : save.isError
                ? errorMessage(save.error)
                : "Cambia los puntos de todo el ranking al instante."
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
                toast.success("Puntos del ranking guardados.")
              },
            })
          }
        />
      )}
    </section>
  )
}

function PointsField({
  id,
  label,
  help,
  value,
  onChange,
}: {
  id: string
  label: string
  help: string
  value: number
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex flex-1 flex-col gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs text-muted-foreground">{help}</span>
      </span>
      <Input
        id={id}
        type="number"
        min={0}
        max={MAX_POINTS}
        value={value < 0 ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 text-center font-mono"
      />
    </div>
  )
}
