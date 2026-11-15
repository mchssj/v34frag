import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { QueryState } from "@/components/brand/QueryState"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionCard } from "@/features/events/components/ui"
import type { EventDetail } from "@/features/events/types"
import {
  awardCandidatesOptions,
  clearAward,
  eventClipsOptions,
  eventPinsOptions,
  pickAward,
  type Award,
  type AwardCandidate,
} from "./api"
import { awardItem, awardValue, PinTile, pinItem } from "./PinTile"
import { awardOf } from "./pinSvg"

// Torneo › Resumen (replanteo 123): el podio con los pines por puesto, los premios individuales y, para quien
// gestiona el torneo, los premios que esperan que los elija.

type AwardId = Award["award"]

export function EventPinsSection({ event }: { event: EventDetail }) {
  const q = useQuery(eventPinsOptions(event.id))
  const manage = !!event.viewer?.can_manage
  const [picking, setPicking] = useState<AwardId | null>(null)
  if (event.status !== "finished") return null
  if (q.isPending) return <Skeleton className="h-56 rounded-xl" />
  return (
    <QueryState q={q}>
      {(p) => {
        if (!p.config.enabled) return null
        if (
          !p.results.length &&
          !p.awards.length &&
          !(manage && p.pending.length)
        )
          return null
        return (
          <SectionCard title="Pines y premios">
            {p.results.length > 0 && (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-x-3 gap-y-5">
                {p.results.map((pin) => (
                  <li key={pin.id} className="min-w-0">
                    <PinTile item={pinItem(pin)} size={104} />
                  </li>
                ))}
              </ul>
            )}
            {p.awards.length > 0 && (
              <>
                <h3 className="mt-2 text-[13px] font-semibold text-muted-foreground">
                  Premios individuales
                </h3>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-x-3 gap-y-5">
                  {p.awards.map((a) => (
                    <li
                      key={a.id}
                      className="flex min-w-0 flex-col items-center gap-1"
                    >
                      <PinTile item={awardItem(a)} size={96} showTeam={false} />
                      <span className="text-xs font-medium">
                        {a.player.nick}
                      </span>
                      {manage && (
                        <button
                          type="button"
                          className="text-[11px] text-muted-foreground underline hover:text-foreground"
                          onClick={() => setPicking(a.award)}
                        >
                          Cambiar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {manage && p.pending.length > 0 && (
              <div className="mt-2 flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Premios para elegir
                </span>
                <ul className="flex flex-wrap gap-2">
                  {p.pending.map((a) => (
                    <li key={a}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPicking(a)}
                      >
                        {awardOf(a).name}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {picking && (
              <PickDialog
                eventId={event.id}
                award={picking}
                current={p.awards.find((a) => a.award === picking) ?? null}
                calculable={!!p.calculable[picking]}
                onClose={() => setPicking(null)}
              />
            )}
          </SectionCard>
        )
      }}
    </QueryState>
  )
}

function PickDialog({
  eventId,
  award,
  current,
  calculable,
  onClose,
}: {
  eventId: string
  award: AwardId
  current: Award | null
  calculable: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const done = (msg: string) => {
    // La vitrina de los jugadores también cambia.
    void qc.invalidateQueries({ queryKey: ["pins"] })
    toast.success(msg)
    onClose()
  }
  const pick = useMutation({
    mutationFn: (body: { player_id?: string; clip_id?: string }) =>
      pickAward(eventId, award, body),
    onSuccess: () => done(`${awardOf(award).name}: elegido.`),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const clear = useMutation({
    mutationFn: () => clearAward(eventId, award),
    onSuccess: () => done("Elección borrada."),
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{awardOf(award).name}</DialogTitle>
          <DialogDescription>
            {award === "play"
              ? "Elige el clip: el premio va a su jugador."
              : calculable
                ? "Arriba, los 10 mejores del torneo por la cifra del premio; debajo, el resto del plantel. Tu elección pisa al automático."
                : "El torneo no tiene stats para calcularlo: elige entre los inscritos."}
          </DialogDescription>
        </DialogHeader>
        {award === "play" ? (
          <ClipList
            eventId={eventId}
            onPick={(clip_id) => pick.mutate({ clip_id })}
            busy={pick.isPending}
          />
        ) : (
          <CandidateList
            eventId={eventId}
            award={award}
            onPick={(player_id) => pick.mutate({ player_id })}
            busy={pick.isPending}
          />
        )}
        {current?.manual && (
          <Button
            variant="outline"
            onClick={() => clear.mutate()}
            disabled={clear.isPending}
          >
            {calculable ? "Volver al automático" : "Borrar la elección"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CandidateList({
  eventId,
  award,
  onPick,
  busy,
}: {
  eventId: string
  award: AwardId
  onPick: (playerId: string) => void
  busy: boolean
}) {
  const q = useQuery(awardCandidatesOptions(eventId, award))
  const [term, setTerm] = useState("")
  return (
    <QueryState q={q}>
      {(items) => {
        const suggested = items.filter((c) => c.suggested)
        const t = norm(term)
        const rest = items
          .filter((c) => !c.suggested)
          .filter(
            (c) =>
              !t ||
              norm(c.player.nick).includes(t) ||
              norm(c.team?.name ?? "").includes(t)
          )
          .sort((x, y) => x.player.nick.localeCompare(y.player.nick))
        return (
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            {suggested.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">
                  Sugeridos
                </span>
                <ul className="flex flex-col divide-y rounded-xl border">
                  {suggested.map((c, i) => (
                    <CandidateRow
                      key={c.player.id}
                      c={c}
                      award={award}
                      pos={i + 1}
                      busy={busy}
                      onPick={onPick}
                    />
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">
                {suggested.length > 0 ? "El resto del plantel" : "Inscritos"}
              </span>
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Buscar por jugador o equipo"
                aria-label="Buscar jugador"
              />
              {rest.length === 0 ? (
                <p className="px-1 text-sm text-muted-foreground">
                  {term ? "Nadie con ese nombre." : "No hay más jugadores."}
                </p>
              ) : (
                <ul className="flex flex-col divide-y rounded-xl border">
                  {rest.map((c) => (
                    <CandidateRow
                      key={c.player.id}
                      c={c}
                      award={award}
                      busy={busy}
                      onPick={onPick}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )
      }}
    </QueryState>
  )
}

/** Minúsculas y sin tildes, para buscar. */
const norm = (v: string) =>
  v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()

function CandidateRow({
  c,
  award,
  pos,
  busy,
  onPick,
}: {
  c: AwardCandidate
  award: AwardId
  pos?: number
  busy: boolean
  onPick: (playerId: string) => void
}) {
  const detail = [
    awardValue(award, c.value),
    c.maps !== null && `${c.maps} mapas`,
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <li>
      <button
        type="button"
        disabled={busy}
        onClick={() => onPick(c.player.id)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
      >
        {pos !== undefined && (
          <span className="w-5 font-mono text-xs text-muted-foreground">
            {pos}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{c.player.nick}</span>
          {c.team && (
            <span className="truncate text-xs text-muted-foreground">
              {c.team.name}
            </span>
          )}
        </span>
        {detail && (
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {detail}
          </span>
        )}
      </button>
    </li>
  )
}

function ClipList({
  eventId,
  onPick,
  busy,
}: {
  eventId: string
  onPick: (clipId: string) => void
  busy: boolean
}) {
  const q = useQuery(eventClipsOptions(eventId))
  return (
    <QueryState q={q}>
      {(items) =>
        items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            El torneo no tiene clips listos: los clips salen de las partidas
            jugadas en el servidor.
          </p>
        ) : (
          <ul className="flex max-h-[50vh] flex-col divide-y overflow-y-auto rounded-xl border">
            {items.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="flex flex-1 flex-col">
                  <span className="font-medium">{c.player.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[c.type, c.round !== null && `ronda ${c.round}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <a
                  href={`/match/${c.match_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground underline"
                >
                  Ver
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !c.player.id}
                  onClick={() => onPick(c.id)}
                >
                  Elegir
                </Button>
              </li>
            ))}
          </ul>
        )
      }
    </QueryState>
  )
}
