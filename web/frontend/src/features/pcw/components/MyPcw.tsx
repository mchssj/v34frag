import { cn } from "cn"
import {
  CalendarPlusIcon,
  CheckIcon,
  ChevronDownIcon,
  EllipsisIcon,
  LinkIcon,
  RepeatIcon,
  XIcon,
} from "lucide-react"
import { useState } from "react"

import { TeamCrest } from "@/components/brand/TeamCrest"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { countdown, sideName, whenLabel } from "../lib/pcw"
import { stepLabel } from "../lib/series"
import type { PcwMatch } from "../types"
import { TeamName } from "./TeamName"
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
  // Las últimas jugadas quedan plegadas: arriba va lo que hay que atender.
  const [showRecent, setShowRecent] = useState(false)

  return (
    <Card variant="outline" asChild className="flex flex-col gap-3 p-4">
      <section aria-labelledby="my-pcw-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="my-pcw-h" className="text-[17px] font-bold">
            Mis PCW
          </h2>
          <Button variant="ghost" size="sm" onClick={onRepeat}>
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
          <div className="flex flex-col gap-1.5 border-t pt-2">
            <button
              type="button"
              aria-expanded={showRecent}
              aria-controls="my-pcw-recent"
              onClick={() => setShowRecent((o) => !o)}
              className="inline-flex items-center gap-1 self-start rounded-sm text-xs text-muted-foreground hover:text-foreground"
            >
              Últimas jugadas · {recent.length}
              <ChevronDownIcon
                aria-hidden
                className={cn(
                  "size-3.5 transition-transform",
                  showRecent && "rotate-180"
                )}
              />
            </button>
            <ul
              id="my-pcw-recent"
              hidden={!showRecent}
              className="flex flex-col gap-1"
            >
              {recent.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  {m.them.team && <TeamCrest team={m.them.team} size="xs" />}
                  <span className="min-w-0 flex-1 truncate">
                    vs{" "}
                    <b>
                      <TeamName team={m.them.team} name={sideName(m.them)} />
                    </b>{" "}
                    · BO{m.best_of}
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
  // "Esperando" es lo normal y no se muestra; los demás estados van en la línea de abajo.
  const state = m.booking
    ? stepLabel(m.booking)
    : m.status === "waiting"
      ? null
      : st.label
  const canCancel =
    !m.booking && (m.status === "waiting" || m.status === "ready_us")

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-lg border px-3 py-2.5",
        soon && "border-primary/60 bg-primary/5"
      )}
    >
      <div className="flex items-center gap-2.5">
        {m.them.team && <TeamCrest team={m.them.team} size="row" />}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">
            vs <TeamName team={m.them.team} name={sideName(m.them)} />
          </span>
          <span className="truncate text-xs text-muted-foreground">
            BO{m.best_of} · {whenLabel(m.starts_at, now)}
            {left && !m.booking && (
              <span className="font-mono tabular-nums"> · faltan {left}</span>
            )}
            {state && (
              <span
                className={
                  m.booking?.step === "abandoned"
                    ? "text-destructive"
                    : "text-primary"
                }
              >
                {" "}
                · {state}
              </span>
            )}
          </span>
        </div>
        {m.booking && (
          // Con los dos listos, la serie sigue en su propia sala (veto, servidor y chats).
          <Button size="sm" onClick={() => series.onRoom(m.id)}>
            {m.booking.step === "finished" || m.booking.step === "abandoned"
              ? "Ver resultado"
              : "Ir a la sala"}
          </Button>
        )}
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Más opciones de la práctica vs ${sideName(m.them)}`}
            >
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => copyLink(m.id, "match")}>
              <LinkIcon aria-hidden />
              Copiar link
            </DropdownMenuItem>
            {m.starts_at && (
              <DropdownMenuItem
                onSelect={() =>
                  downloadIcs({
                    id: m.id,
                    title,
                    startsAt: m.starts_at!,
                    bestOf: m.best_of,
                    kind: "match",
                  })
                }
              >
                <CalendarPlusIcon aria-hidden />
                Agregar al calendario
              </DropdownMenuItem>
            )}
            {canCancel && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => onCancel(m.id)}
                >
                  <XIcon aria-hidden />
                  Cancelar la práctica
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {soon && (
        <p className="text-xs">
          <b>Empieza en menos de 15 min.</b> Entrá con CMLeague Conectar.
        </p>
      )}

      {m.proposed_at && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs">
          {m.proposed_by === "them" ? (
            <>
              <span className="min-w-[11rem] flex-1">
                Proponen pasarla a <b>{whenLabel(m.proposed_at, now)}</b>
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
                Mantener
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
    </li>
  )
}

/** Acciones de la serie después de "los dos listos". */
export type SeriesActions = {
  /** Abre la sala de la PCW. */
  onRoom: (id: string) => void
  onVeto: (id: string, map: string) => void
  onUnready: (id: string) => void
  onFinishMap: (id: string) => void
  onDismiss: (id: string) => void
}
