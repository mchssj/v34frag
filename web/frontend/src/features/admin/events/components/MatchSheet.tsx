import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import {
  ArrowLeftRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { Schemas } from "@/api/client"
import { errorMessage } from "@/api/errors"
import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { ErrorAlert } from "@/components/brand/ErrorAlert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { EventDetail, EventMatch } from "@/features/events/types"
import { matchDetailOptions } from "@/features/shell/api/queries"
import { fmtDateTime } from "../../lib/format"
import {
  CANDIDATES_PER,
  gameCandidatesOptions,
  poolMapsOptions,
  serversOptions,
  useMatchResult,
  useReviewGame,
  useScheduleMatch,
  useSeriesMaps,
  type CandidateFilters,
} from "../api/queries"
import { mapsProblem, seriesScore, type SeriesMapDraft } from "../lib/model"

// El tipo que devuelve la consulta (los `team` nulables vienen corregidos ahí).
type Detail = NonNullable<
  Awaited<
    ReturnType<NonNullable<ReturnType<typeof matchDetailOptions>["queryFn"]>>
  >
>
type Candidate = Schemas["GameCandidate"]

const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Gestionar una partida del torneo: horario, servidor y cada mapa (mix vinculado o resultado a mano). */
export function MatchSheet({
  event,
  match,
  onClose,
}: {
  event: EventDetail
  match: EventMatch | null
  onClose: () => void
}) {
  return (
    <Sheet open={!!match} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        {match && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle>
                {match.side1.team?.name ?? "Por definir"} vs{" "}
                {match.side2.team?.name ?? "Por definir"}
              </SheetTitle>
              <SheetDescription>
                {match.label} · BO{match.best_of}
              </SheetDescription>
            </SheetHeader>
            <Body key={match.id} event={event} match={match} />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Body({ event, match }: { event: EventDetail; match: EventMatch }) {
  const detail = useQuery(matchDetailOptions(match.id))
  if (detail.isError)
    return (
      <div className="p-4">
        <ErrorAlert message={errorMessage(detail.error)} />
      </div>
    )
  if (!detail.data)
    return (
      <div className="p-4">
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  return (
    <div className="flex flex-col gap-6 p-4">
      <Schedule event={event} match={match} detail={detail.data} />
      {match.side1.team && match.side2.team ? (
        <Maps
          key={JSON.stringify(detail.data.maps_detail)}
          event={event}
          match={match}
          detail={detail.data}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          El resultado se carga cuando la partida tenga los dos equipos.
        </p>
      )}
    </div>
  )
}

function Schedule({
  event,
  match,
  detail,
}: {
  event: EventDetail
  match: EventMatch
  detail: Detail
}) {
  const servers = useQuery(serversOptions)
  const save = useScheduleMatch(event.id)
  const [when, setWhen] = useState(toLocalInput(match.starts_at))
  const [server, setServer] = useState(detail.server?.id ?? "none")
  const dirty =
    when !== toLocalInput(match.starts_at) ||
    server !== (detail.server?.id ?? "none")
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
        Horario y servidor
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Horario
          <Input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
          <span className="text-xs font-normal text-muted-foreground">
            Lo pones tú: no hay horarios automáticos.
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Servidor
          <Select value={server} onValueChange={setServer}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin servidor</SelectItem>
              {(servers.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      {save.isError && <ErrorAlert message={errorMessage(save.error)} />}
      <div>
        <Button
          variant="outline"
          disabled={!dirty || save.isPending}
          onClick={() =>
            save.mutate(
              {
                matchId: match.id,
                starts_at: when ? new Date(when).toISOString() : null,
                server_id: server === "none" ? null : server,
              },
              {
                onSuccess: () => toast.success("Horario y servidor guardados."),
              }
            )
          }
        >
          Guardar horario y servidor
        </Button>
      </div>
    </section>
  )
}

const draftsOf = (d: Detail): SeriesMapDraft[] =>
  d.maps_detail.map((m) =>
    m.game_id
      ? {
          kind: "mix",
          game_id: m.game_id,
          map: m.map,
          r1: m.r1 ?? 0,
          r2: m.r2 ?? 0,
          ...(m.approved === false ? { pending: true } : {}),
        }
      : {
          kind: "manual",
          map: m.map ?? "",
          r1: m.r1,
          r2: m.r2,
          played_at: m.played_at?.slice(0, 10) ?? "",
        }
  )

function Maps({
  event,
  match,
  detail,
}: {
  event: EventDetail
  match: EventMatch
  detail: Detail
}) {
  const save = useSeriesMaps(event.id)
  const result = useMatchResult(event.id)
  const reviewGame = useReviewGame(event.id)
  const staff = !!event.viewer?.can_review
  const [filters, setFilters] = useState<CandidateFilters>({ page: 1 })
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [woDate, setWoDate] = useState(event.starts_on ?? "")
  const candidates = useQuery(gameCandidatesOptions(match.id, filters))
  const servers = useQuery(serversOptions)
  const pool = useQuery(poolMapsOptions).data ?? []
  const mapNames =
    event.map_pool ?? pool.filter((m) => m.veto_default).map((m) => m.name)
  const saved = draftsOf(detail)
  const [maps, setMaps] = useState<SeriesMapDraft[]>(saved)
  const [adding, setAdding] = useState<null | "mix" | "manual">(null)
  const t1 = match.side1.team!
  const t2 = match.side2.team!
  const score = seriesScore(maps, match.best_of, detail.advantage_side)
  const problem = mapsProblem(maps, match.best_of)
  const dirty = JSON.stringify(maps) !== JSON.stringify(saved)
  const full = maps.length >= match.best_of || score.decided

  const set = (i: number, m: SeriesMapDraft) =>
    setMaps(maps.map((x, j) => (j === i ? m : x)))
  const pick = (c: Candidate) => {
    const side = c.side1 === 2 ? 2 : 1
    const r1 = side === 1 ? c.score1 : c.score2
    const r2 = side === 1 ? c.score2 : c.score1
    setMaps([
      ...maps,
      {
        kind: "mix",
        game_id: c.game_id,
        side1: side,
        map: c.map,
        r1: r1 ?? 0,
        r2: r2 ?? 0,
      },
    ])
    setAdding(null)
  }
  const flip = (i: number) => {
    const m = maps[i]
    if (m.kind !== "mix") return
    const current =
      m.side1 ??
      (candidates.data?.items.find((c) => c.game_id === m.game_id)?.side1 === 2
        ? 2
        : 1)
    set(i, { ...m, side1: current === 1 ? 2 : 1, r1: m.r2, r2: m.r1 })
  }
  const submit = () =>
    save.mutate(
      {
        matchId: match.id,
        maps: maps.map((m) =>
          m.kind === "mix"
            ? { game_id: m.game_id, ...(m.side1 ? { side1: m.side1 } : {}) }
            : {
                map: m.map || null,
                r1: m.r1 ?? 0,
                r2: m.r2 ?? 0,
                ...(m.played_at ? { played_at: m.played_at } : {}),
              }
        ),
      },
      {
        onSuccess: () =>
          toast.success(
            score.decided
              ? "Resultado guardado: la llave avanza."
              : "Mapas guardados."
          ),
      }
    )
  const linked = new Set(
    maps.flatMap((m) => (m.kind === "mix" ? [m.game_id] : []))
  )
  // En un histórico la serie suma al ranking solo con todos sus mapas con un mix aprobado.
  const counts =
    maps.length > 0 && maps.every((m) => m.kind === "mix" && !m.pending)
  const savedIds = new Set(
    saved.flatMap((m) => (m.kind === "mix" ? [m.game_id] : []))
  )
  const review = (gameId: string, approve: boolean) =>
    reviewGame.mutate(
      { matchId: match.id, gameId, approve },
      {
        onSuccess: () => {
          setRejecting(null)
          toast.success(
            approve
              ? "Mix aprobado: ya se ven sus stats."
              : "Mix rechazado: el mapa quedó con su marcador a mano."
          )
        },
      }
    )
  const woBody = event.historic && woDate ? { played_at: woDate } : {}

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
          Mapas de la serie
        </h3>
        <span className="font-mono text-sm">
          {t1.tag ?? t1.name} <b>{score.w1}</b> – <b>{score.w2}</b>{" "}
          {t2.tag ?? t2.name}
        </span>
      </div>
      {detail.advantage_side && (
        <p className="text-xs text-muted-foreground">
          {detail.advantage_side === 1 ? t1.name : t2.name} empieza 1:0 por el
          mapa de ventaja.
        </p>
      )}
      <ol className="flex flex-col gap-2">
        {maps.map((m, i) => (
          <li key={i} className="flex flex-col gap-2 rounded-lg border p-2.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                Mapa {i + 1}
              </span>
              {m.kind === "mix" ? (
                m.pending ? (
                  <Badge variant="warn">Mix por aprobar</Badge>
                ) : (
                  <Badge variant="win">Mix vinculado</Badge>
                )
              ) : (
                <Badge variant="warn">Resultado a mano · sin detalle</Badge>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                aria-label={`Quitar el mapa ${i + 1}`}
                onClick={() => setMaps(maps.filter((_, j) => j !== i))}
              >
                <Trash2Icon aria-hidden />
              </Button>
            </div>
            {m.kind === "mix" ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{m.map ?? "Mapa"}</span>
                <span className="font-mono">
                  {t1.tag ?? t1.name} {m.r1} : {m.r2} {t2.tag ?? t2.name}
                </span>
                <Button variant="outline" size="sm" onClick={() => flip(i)}>
                  <ArrowLeftRightIcon aria-hidden />
                  Invertir bandos
                </Button>
                {m.pending && staff && savedIds.has(m.game_id) && (
                  <span className="flex w-full flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Lo vinculó el organizador: cuenta en la llave, pero sus
                      stats no se ven hasta que lo apruebes.
                    </span>
                    <Button
                      size="sm"
                      disabled={reviewGame.isPending || dirty}
                      onClick={() => review(m.game_id, true)}
                    >
                      Aprobar mix
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reviewGame.isPending || dirty}
                      onClick={() => setRejecting(m.game_id)}
                    >
                      Rechazar
                    </Button>
                  </span>
                )}
                {m.pending && !staff && (
                  <span className="w-full text-xs text-muted-foreground">
                    Espera la aprobación de un admin o moderador: ya cuenta en
                    la llave, pero sus stats no se ven hasta entonces.
                  </span>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_72px_72px] items-end gap-2">
                <label className="flex flex-col gap-1 text-xs font-medium">
                  Mapa
                  <Select
                    value={m.map || undefined}
                    onValueChange={(v) => set(i, { ...m, map: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Elegir" />
                    </SelectTrigger>
                    <SelectContent>
                      {mapNames.map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium">
                  <span className="truncate">{t1.tag ?? t1.name}</span>
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    value={m.r1 ?? ""}
                    onChange={(e) =>
                      set(i, {
                        ...m,
                        r1:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium">
                  <span className="truncate">{t2.tag ?? t2.name}</span>
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    value={m.r2 ?? ""}
                    onChange={(e) =>
                      set(i, {
                        ...m,
                        r2:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="font-mono"
                  />
                </label>
                <label className="col-span-3 flex items-center gap-2 text-xs font-medium">
                  Jugado el
                  <Input
                    type="date"
                    className="w-44"
                    value={m.played_at ?? ""}
                    onChange={(e) =>
                      set(i, { ...m, played_at: e.target.value })
                    }
                    title={
                      event.historic
                        ? "Sin fecha, queda la del inicio del torneo"
                        : "Opcional"
                    }
                  />
                </label>
              </div>
            )}
          </li>
        ))}
        {maps.length === 0 && (
          <li className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Sin mapas cargados.
          </li>
        )}
      </ol>

      {!full && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-pressed={adding === "mix"}
            onClick={() => setAdding(adding === "mix" ? null : "mix")}
          >
            <PlusIcon aria-hidden />
            Vincular un mix
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMaps([
                ...maps,
                { kind: "manual", map: "", r1: null, r2: null },
              ])
              setAdding(null)
            }}
          >
            <PlusIcon aria-hidden />
            Resultado a mano
          </Button>
        </div>
      )}

      {adding === "mix" && (
        <div className="flex flex-col gap-2 rounded-lg bg-muted p-2.5">
          <p className="text-xs text-muted-foreground">
            {event.historic
              ? "Cualquier mix terminado y sin vincular, sin límite de fecha. Si no hay inscritos que decidan el bando, elígelo con «Invertir bandos»."
              : "Mixes terminados en los últimos 14 días, sin vincular, con jugadores inscritos de los dos equipos. Primero los que tienen más."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium">
              Desde
              <Input
                type="date"
                value={filters.from ?? ""}
                onChange={(e) =>
                  setFilters({ ...filters, from: e.target.value, page: 1 })
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Hasta
              <Input
                type="date"
                value={filters.to ?? ""}
                onChange={(e) =>
                  setFilters({ ...filters, to: e.target.value, page: 1 })
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Mapa
              <Input
                placeholder="dust2"
                value={filters.map ?? ""}
                onChange={(e) =>
                  setFilters({ ...filters, map: e.target.value, page: 1 })
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Servidor
              <Select
                value={filters.server ?? "all"}
                onValueChange={(v) =>
                  setFilters({
                    ...filters,
                    server: v === "all" ? undefined : v,
                    page: 1,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {(servers.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          {candidates.isPending ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : candidates.isError ? (
            <ErrorAlert message={errorMessage(candidates.error)} />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {candidates.data.items.filter((c) => !linked.has(c.game_id))
                .length === 0 && (
                <li className="text-sm text-muted-foreground">
                  No hay mixes para vincular.
                </li>
              )}
              {candidates.data.items
                .filter((c) => !linked.has(c.game_id))
                .map((c) => {
                  const k1 = c.side1 === 2 ? c.score2 : c.score1
                  const k2 = c.side1 === 2 ? c.score1 : c.score2
                  return (
                    <li key={c.game_id}>
                      <button
                        type="button"
                        onClick={() => pick(c)}
                        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-left text-sm outline-none hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="font-medium">
                            {c.map ?? "Mapa"}{" "}
                            <span className="font-normal text-muted-foreground">
                              · {fmtDateTime(c.played_at)}
                              {c.server_name && ` · ${c.server_name}`}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "text-xs",
                              c.registered < c.players / 2
                                ? "text-amber-700 dark:text-amber-400"
                                : "text-muted-foreground"
                            )}
                          >
                            {c.registered} de {c.players} jugadores inscritos
                          </span>
                        </span>
                        <span className="font-mono text-xs">
                          {t1.tag ?? t1.name} {k1} : {k2} {t2.tag ?? t2.name}
                        </span>
                      </button>
                    </li>
                  )
                })}
            </ul>
          )}
          {candidates.data && candidates.data.total > CANDIDATES_PER && (
            <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
              Página {candidates.data.page} de{" "}
              {Math.ceil(candidates.data.total / CANDIDATES_PER)}
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Página anterior"
                disabled={candidates.data.page <= 1}
                onClick={() =>
                  setFilters({ ...filters, page: (filters.page ?? 1) - 1 })
                }
              >
                <ChevronLeftIcon aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Página siguiente"
                disabled={
                  candidates.data.page * CANDIDATES_PER >= candidates.data.total
                }
                onClick={() =>
                  setFilters({ ...filters, page: (filters.page ?? 1) + 1 })
                }
              >
                <ChevronRightIcon aria-hidden />
              </Button>
            </div>
          )}
        </div>
      )}

      {event.historic && maps.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {counts
            ? "Esta serie suma al ranking: todos sus mapas tienen un mix aprobado."
            : "Esta serie no suma al ranking: en un histórico solo suman las series con todos sus mapas con un mix aprobado."}
        </p>
      )}

      {problem && maps.length > 0 && (
        <p className="text-sm text-destructive">{problem}</p>
      )}
      {(save.isError || result.isError || reviewGame.isError) && (
        <ErrorAlert
          message={errorMessage(save.error ?? result.error ?? reviewGame.error)}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!dirty || !!problem || save.isPending}
          onClick={submit}
        >
          {score.decided ? "Guardar resultado" : "Guardar mapas"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {score.decided
            ? "La serie queda definida y la llave avanza."
            : "Sin definir: la serie queda en curso con esos mapas."}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <span className="w-full text-xs text-muted-foreground">
          Otras acciones
        </span>
        {event.historic && (
          <label className="flex w-full items-center gap-2 text-xs font-medium">
            Fecha del W.O.
            <Input
              type="date"
              className="w-40"
              value={woDate}
              onChange={(e) => setWoDate(e.target.value)}
            />
          </label>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={result.isPending}
          onClick={() =>
            result.mutate(
              { matchId: match.id, walkover: t1.id, ...woBody },
              { onSuccess: () => toast.success(`W.O. para ${t1.name}.`) }
            )
          }
        >
          W.O. para {t1.tag ?? t1.name}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={result.isPending}
          onClick={() =>
            result.mutate(
              { matchId: match.id, walkover: t2.id, ...woBody },
              { onSuccess: () => toast.success(`W.O. para ${t2.name}.`) }
            )
          }
        >
          W.O. para {t2.tag ?? t2.name}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={result.isPending || match.status !== "finished"}
          onClick={() =>
            result.mutate(
              { matchId: match.id, clear: true },
              { onSuccess: () => toast.success("Resultado anulado.") }
            )
          }
        >
          Anular resultado
        </Button>
      </div>
      <ConfirmDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="¿Rechazar el mix vinculado?"
        description="Se desvincula y el mapa queda con el mismo marcador como resultado a mano. La llave no cambia. Al organizador le llega el aviso."
        confirmLabel="Rechazar"
        danger
        pending={reviewGame.isPending}
        error={reviewGame.error}
        onConfirm={() => rejecting && review(rejecting, false)}
      />
    </section>
  )
}
