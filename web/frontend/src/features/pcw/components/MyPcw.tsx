import { cn } from "cn"
import {
  CalendarPlusIcon,
  CheckIcon,
  ClockIcon,
  LinkIcon,
  RepeatIcon,
  XIcon,
} from "lucide-react"

import { TeamCrest } from "@/components/brand/TeamCrest"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { countdown, sideName, whenLabel } from "../lib/pcw"
import { stepLabel } from "../lib/series"
import type { PcwMatch } from "../types"
import { SeriesPanel } from "./SeriesPanel"
import { copyLink, downloadIcs } from "./share"

const STATUS: Record<
  PcwMatch["status"],
  {
    label: string
    variant: "muted" | "primary" | "win" | "live" | "danger" | "soft"
  }
> = {
  waiting: { label: "Esperando que estén listos", variant: "muted" },
  ready_us: { label: "Ustedes listos · falta el rival", variant: "primary" },
  ready_both: {
    label: "Los dos listos · veto y fila del servidor",
    variant: "win",
  },
  live: { label: "En vivo", variant: "live" },
  won: { label: "Ganaron", variant: "win" },
  lost: { label: "Perdieron", variant: "danger" },
  cancelled: { label: "Cancelada", variant: "soft" },
}

const UPCOMING: PcwMatch["status"][] = [
  "waiting",
  "ready_us",
  "ready_both",
  "live",
]
/** El recordatorio (idea m) se ve desde 15 minutos antes. */
const REMIND_MS = 15 * 60_000

/** "Mis PCW": las próximas con cuenta regresiva y Estamos listos, y las últimas jugadas. */
export function MyPcw({
  matches,
  now,
  onReady,
  onAnswer,
  onCancel,
  onRepeat,
  series,
}: {
  matches: PcwMatch[]
  now: Date
  onReady: (id: string) => void
  onAnswer: (id: string, ok: boolean) => void
  onCancel: (id: string) => void
  onRepeat: () => void
  series: SeriesActions
}) {
  // Una serie terminada o abandonada queda arriba hasta cerrar su aviso.
  const upcoming = matches.filter(
    (m) => m.booking || UPCOMING.includes(m.status)
  )
  const recent = matches
    .filter((m) => !m.booking && (m.status === "won" || m.status === "lost"))
    .slice(0, 3)

  return (
    <Card variant="outline" asChild className="flex flex-col gap-4 p-4">
      <section aria-labelledby="my-pcw-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="my-pcw-h" className="text-[17px] font-bold">
            Mis PCW
          </h2>
          <Button variant="outline" size="sm" onClick={onRepeat}>
            <RepeatIcon />
            Repetir la última
          </Button>
        </div>

        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tenés prácticas pendientes. Aceptá un anuncio del tablón o
            publicá el tuyo.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((m) => (
              <UpcomingRow
                key={m.id}
                m={m}
                now={now}
                onReady={onReady}
                onAnswer={onAnswer}
                onCancel={onCancel}
                series={series}
              />
            ))}
          </ul>
        )}

        {recent.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t pt-3">
            <span className="text-xs text-muted-foreground">
              Últimas jugadas
            </span>
            <ul className="flex flex-col gap-1">
              {recent.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  {m.them.team && <TeamCrest team={m.them.team} size="xs" />}
                  <span className="min-w-0 flex-1 truncate">
                    vs <b>{sideName(m.them)}</b> · BO{m.best_of}
                  </span>
                  <span className="font-mono font-semibold">
                    {m.score?.[0]}-{m.score?.[1]}
                  </span>
                  <Badge
                    variant={STATUS[m.status].variant}
                    size="sm"
                    shape="pill"
                  >
                    {STATUS[m.status].label}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </Card>
  )
}

function UpcomingRow({
  m,
  now,
  onReady,
  onAnswer,
  onCancel,
  series,
}: {
  m: PcwMatch
  now: Date
  onReady: (id: string) => void
  onAnswer: (id: string, ok: boolean) => void
  onCancel: (id: string) => void
  series: SeriesActions
}) {
  const left = countdown(m.starts_at, now)
  const soon =
    !m.booking &&
    m.starts_at !== null &&
    new Date(m.starts_at).getTime() - now.getTime() <= REMIND_MS
  const st = STATUS[m.status]
  const title = `PCW BO${m.best_of} vs ${sideName(m.them)}`

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3",
        soon && "border-primary/60 bg-primary/5"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {m.them.team && <TeamCrest team={m.them.team} size="row" />}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">vs {sideName(m.them)}</span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ClockIcon aria-hidden className="size-3" />
            BO{m.best_of} · {whenLabel(m.starts_at, now)}
          </span>
        </div>
        {left && !m.booking && (
          <span
            aria-label="Falta"
            className="font-mono text-lg font-semibold tabular-nums"
          >
            {left}
          </span>
        )}
      </div>

      {soon && (
        <p className="text-xs">
          <b>Empieza en menos de 15 minutos.</b> Entrá con CMLeague Conectar o
          esperá el aviso con la IP cuando el servidor esté listo.
        </p>
      )}

      {m.proposed_at && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-2.5 py-2 text-xs">
          {m.proposed_by === "them" ? (
            <>
              <span className="min-w-[14rem] flex-1">
                <b>{sideName(m.them)}</b> propone pasarla a{" "}
                <b>{whenLabel(m.proposed_at, now)}</b>
              </span>
              <Button size="xs" onClick={() => onAnswer(m.id, true)}>
                <CheckIcon />
                Aceptar
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onAnswer(m.id, false)}
              >
                Mantener la hora
              </Button>
            </>
          ) : (
            <span>
              Propusiste <b>{whenLabel(m.proposed_at, now)}</b> · esperando
              respuesta
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={m.booking?.step === "abandoned" ? "danger" : st.variant}
          size="md"
          shape="pill"
        >
          {m.booking ? stepLabel(m.booking) : st.label}
        </Badge>
        <span className="flex-1" />
        {m.status === "waiting" && (
          <Button size="sm" onClick={() => onReady(m.id)}>
            Estamos listos
          </Button>
        )}
        {m.status === "ready_us" && !m.booking && (
          <Button size="sm" variant="secondary" onClick={() => onReady(m.id)}>
            Simular: el rival está listo
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Copiar link"
          onClick={() => copyLink(m.id, "match")}
        >
          <LinkIcon />
        </Button>
        {m.starts_at && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Agregar al calendario"
            onClick={() =>
              downloadIcs({
                id: m.id,
                title,
                startsAt: m.starts_at!,
                bestOf: m.best_of,
                kind: "match",
              })
            }
          >
            <CalendarPlusIcon />
          </Button>
        )}
        {!m.booking && (m.status === "waiting" || m.status === "ready_us") && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Cancelar la práctica"
            onClick={() => onCancel(m.id)}
          >
            <XIcon />
          </Button>
        )}
      </div>

      {m.booking && (
        <SeriesPanel
          m={m}
          onVeto={(map) => series.onVeto(m.id, map)}
          onUnready={() => series.onUnready(m.id)}
          onFinishMap={() => series.onFinishMap(m.id)}
          onDismiss={() => series.onDismiss(m.id)}
        />
      )}
    </li>
  )
}

/** Acciones de la serie después de "los dos listos". */
export type SeriesActions = {
  onVeto: (id: string, map: string) => void
  onUnready: (id: string) => void
  onFinishMap: (id: string) => void
  onDismiss: (id: string) => void
}
