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
import type { PcwMatch, PcwResult } from "../types"
import { NextPcw } from "./NextPcw"
import { TeamName } from "./TeamName"
import { copyLink, downloadIcs } from "./share"

const STATUS: Record<
  PcwMatch["status"],
  {
    label: string
    variant: "muted" | "primary" | "win" | "live" | "danger" | "soft"
  }
> = {
  waiting: { label: "Esperando listos", variant: "muted" },
  ready_us: { label: "Ustedes listos", variant: "primary" },
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
/** Columnas de Mis PCW (escritorio), como la lista del tablón; en celular, dos líneas. */
const COLS = "md:grid-cols-[minmax(0,1fr)_3rem_8.5rem_9.5rem_12rem]"

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
  results,
  myTeamId,
  backdrop,
}: {
  matches: PcwMatch[]
  now: Date
  results: PcwResult[]
  myTeamId: string
  /** Foto de fondo de la próxima: el mapa que toca o el primero del pool. */
  backdrop: (m: PcwMatch) => string | null
  onReady: (id: string) => void
  onAnswer: (id: string, ok: boolean) => void
  onCancel: (id: string) => void
  onRepeat: () => void
  series: SeriesActions
}) {
  // Una serie terminada o abandonada queda arriba hasta cerrar su aviso. Primero las que están en sala, después
  // por hora (las "a convenir" al final): la primera va en grande.
  const all = matches
    .filter((m) => m.booking || UPCOMING.includes(m.status))
    .sort(
      (a, b) =>
        Number(!!b.booking) - Number(!!a.booking) ||
        (a.starts_at ? Date.parse(a.starts_at) : Infinity) -
          (b.starts_at ? Date.parse(b.starts_at) : Infinity)
    )
  const next = all[0] ?? null
  const upcoming = all.slice(1)
  const recent = matches
    .filter((m) => !m.booking && (m.status === "won" || m.status === "lost"))
    .slice(0, 3)
  // Las últimas jugadas quedan plegadas: arriba va lo que hay que atender.
  const [showRecent, setShowRecent] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      {next && (
        <NextPcw
          m={next}
          now={now}
          results={results}
          myTeamId={myTeamId}
          backdrop={backdrop(next)}
          onReady={onReady}
          onAnswer={onAnswer}
          onCancel={onCancel}
          series={series}
        />
      )}
      <Card variant="outline" asChild className="overflow-hidden p-0">
        <section aria-labelledby="my-pcw-h">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
            <h2 id="my-pcw-h" className="text-sm font-semibold">
              {next ? "Las siguientes" : "Próximas"}
              <span className="ml-1.5 font-mono text-xs font-normal text-muted-foreground tabular-nums">
                {upcoming.length}
              </span>
            </h2>
            <Button variant="ghost" size="sm" onClick={onRepeat}>
              <RepeatIcon />
              Repetir la última
            </Button>
          </div>

          {upcoming.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {next
                ? "No tenés otras prácticas pendientes."
                : "No tenés prácticas pendientes. Mandá una oferta en el tablón o publicá la tuya."}
            </p>
          ) : (
            <>
              <div
                aria-hidden
                className={cn(
                  "hidden items-center gap-3 border-b px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid",
                  COLS
                )}
              >
                <span>Rival</span>
                <span>BO</span>
                <span>Hora</span>
                <span>Estado</span>
                <span />
              </div>
              <ul className="flex flex-col divide-y">
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
            </>
          )}

          {recent.length > 0 && (
            <div className="border-t">
              <button
                type="button"
                aria-expanded={showRecent}
                aria-controls="my-pcw-recent"
                onClick={() => setShowRecent((o) => !o)}
                className="flex w-full items-center gap-1 px-4 py-2.5 text-left text-sm font-semibold hover:bg-muted/40"
              >
                Últimas jugadas
                <span className="ml-1 font-mono text-xs font-normal text-muted-foreground tabular-nums">
                  {recent.length}
                </span>
                <ChevronDownIcon
                  aria-hidden
                  className={cn(
                    "ml-auto size-4 text-muted-foreground transition-transform",
                    showRecent && "rotate-180"
                  )}
                />
              </button>
              <ul
                id="my-pcw-recent"
                hidden={!showRecent}
                className="flex flex-col divide-y border-t"
              >
                {recent.map((m) => (
                  <li
                    key={m.id}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2 text-sm",
                      COLS
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {m.them.team ? (
                        <TeamCrest team={m.them.team} size="row" />
                      ) : (
                        <MixTag />
                      )}
                      <TeamName
                        team={m.them.team}
                        name={sideName(m.them)}
                        className="truncate font-semibold"
                      />
                    </span>
                    <span className="font-mono font-semibold max-md:hidden">
                      BO{m.best_of}
                    </span>
                    <span className="text-muted-foreground max-md:hidden">
                      {whenLabel(m.starts_at, now)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono font-semibold tabular-nums">
                        {m.score?.[0]}-{m.score?.[1]}
                      </span>
                      <Badge
                        variant={STATUS[m.status].variant}
                        size="sm"
                        shape="pill"
                      >
                        {STATUS[m.status].label}
                      </Badge>
                    </span>
                    <span className="max-md:hidden" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </Card>
    </div>
  )
}

function MixTag() {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground font-mono text-[10px] font-bold text-background">
      MIX
    </span>
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
  const state = m.booking ? stepLabel(m.booking) : st.label
  const canCancel =
    !m.booking && (m.status === "waiting" || m.status === "ready_us")

  return (
    <li className={cn("flex flex-col", soon && "bg-primary/5")}>
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2.5",
          COLS
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {m.them.team ? (
            <TeamCrest team={m.them.team} size="row" />
          ) : (
            <MixTag />
          )}
          <span className="flex min-w-0 flex-col">
            <TeamName
              team={m.them.team}
              name={sideName(m.them)}
              className="truncate text-sm font-semibold"
            />
            <span className="truncate text-xs text-muted-foreground md:hidden">
              BO{m.best_of} · {whenLabel(m.starts_at, now)}
            </span>
          </span>
        </span>
        <span className="hidden font-mono text-sm font-semibold md:inline">
          BO{m.best_of}
        </span>
        <span className="hidden flex-col text-sm md:flex">
          {whenLabel(m.starts_at, now)}
          {left && !m.booking && (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              faltan {left}
            </span>
          )}
        </span>
        <span className="max-md:order-last max-md:col-span-2">
          <Badge
            variant={
              m.booking?.step === "abandoned"
                ? "danger"
                : m.booking
                  ? "primary"
                  : st.variant
            }
            size="sm"
            shape="pill"
          >
            {state}
          </Badge>
        </span>
        <span className="flex items-center justify-end gap-1">
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
        </span>
      </div>

      {soon && (
        <p className="px-4 pb-2 text-xs">
          <b>Empieza en menos de 15 min.</b> Entrá con CMLeague Conectar.
        </p>
      )}

      {m.proposed_at && (
        <div className="mx-4 mb-2.5 flex flex-wrap items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs">
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
