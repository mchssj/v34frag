import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import { api, unwrap } from "@/api/client"
import { errorMessage } from "@/api/errors"
import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { ErrorAlert } from "@/components/brand/ErrorAlert"
import { TeamCrest } from "@/components/brand/TeamCrest"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  eventKeys,
  eventRegistrationsOptions,
  eventStandingsOptions,
} from "@/features/events/api/queries"
import type { EventDetail, Registration } from "@/features/events/types"
import { EmptyState, QueryError, TableBox } from "../../components/ui"
import { fmtDateTime } from "../../lib/format"
import { teamsIssue } from "../lib/model"
import {
  useEventAction,
  useRemoveRegistration,
  useUpdateEvent,
} from "../api/queries"
import { BannerCard } from "./BannerCard"
import { VetoTurnCard } from "./VetoTurnCard"
import { EventForm } from "./EventForm"
import { HistoricRegistrations } from "./HistoricRegistrations"

const active = (r: Registration) =>
  r.players.filter((p) => p.role === "active").length

// ---- Resumen ----

/** Pasos del torneo, lo que falta antes de generar y las acciones grandes (generar, volver a la siembra). */
export function SummaryTab({
  event,
  onTab,
}: {
  event: EventDetail
  onTab: (t: "seed" | "regs" | "matches") => void
}) {
  const regs = useQuery(eventRegistrationsOptions(event.id)).data ?? []
  const action = useEventAction(event.id)
  const [confirm, setConfirm] = useState<"generate" | "reset" | null>(null)
  const short = regs.filter((r) => active(r) < event.players_per_team)
  const issues: { tone: "bad" | "warn"; text: string }[] = []
  if (event.status === "registration") {
    const format = teamsIssue(event.template, event.config, regs.length)
    if (format) issues.push({ tone: "bad", text: format })
    else if (regs.length < Math.max(2, event.min_teams ?? 2))
      issues.push({
        tone: "bad",
        text: `Hacen falta al menos ${Math.max(2, event.min_teams ?? 2)} equipos inscritos (hay ${regs.length}).`,
      })
    // Un histórico no pide activos: los jugadores son opcionales.
    for (const r of event.historic ? [] : short)
      issues.push({
        tone: "bad",
        text: `${r.team.name} tiene ${active(r)} de ${event.players_per_team} activos inscritos: tiene que completarlo o darse de baja.`,
      })
    if (!event.draw)
      issues.push({
        tone: "warn",
        text: "La siembra no se sorteó: revisa que el orden sea el que quieres (pestaña Siembra).",
      })
  }
  if (event.tie_pending)
    issues.push({
      tone: "warn",
      text: `Hay un empate en el grupo ${String.fromCharCode(64 + event.tie_pending.grp)} que tiene que resolver el organizador (abajo).`,
    })
  const steps: [string, string, "done" | "current" | "next"][] = [
    [
      "Inscripciones",
      `${regs.length} equipos${event.max_teams ? ` de ${event.max_teams}` : ""}`,
      event.status === "registration" ? "current" : "done",
    ],
    [
      "Siembra",
      event.draw ? "Sorteada" : "A mano o por ranking",
      event.status === "registration" ? "current" : "done",
    ],
    [
      "Fixture",
      event.status === "registration" ? "Por generar" : "Generado",
      event.status === "registration" ? "next" : "done",
    ],
    [
      "En curso",
      event.progress
        ? `${event.progress.played} de ${event.progress.total} partidas`
        : "—",
      event.status === "in_progress"
        ? "current"
        : event.status === "finished"
          ? "done"
          : "next",
    ],
    [
      "Terminado",
      event.champion ? `Campeón: ${event.champion.name}` : "—",
      event.status === "finished" ? "done" : "next",
    ],
  ]
  const blocked = issues.some((i) => i.tone === "bad")
  return (
    <div className="flex flex-col gap-4">
      <ol className="grid gap-2 sm:grid-cols-5">
        {steps.map(([t, d, s], i) => (
          <li
            key={t}
            className={cn(
              "flex flex-col gap-0.5 rounded-xl border p-3 text-[13px]",
              s === "current" && "border-primary ring-1 ring-primary",
              s === "done" && "border-win/40"
            )}
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="font-mono text-muted-foreground">{i + 1}</span>{" "}
              {t}
              {s === "done" && <Badge variant="win">Listo</Badge>}
            </span>
            <span className="text-muted-foreground">{d}</span>
          </li>
        ))}
      </ol>
      {issues.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {issues.map((x, i) => (
            <li
              key={i}
              className={cn(
                "rounded-lg px-3 py-2 text-[13px]",
                x.tone === "bad" ? "bg-destructive/10" : "bg-amber-500/10"
              )}
            >
              {x.text}
            </li>
          ))}
        </ul>
      ) : (
        event.status === "registration" && (
          <p className="rounded-lg bg-win/10 px-3 py-2 text-[13px]">
            Todo listo para generar el fixture.
          </p>
        )
      )}
      {action.isError && <ErrorAlert message={errorMessage(action.error)} />}
      <div className="flex flex-wrap items-center gap-2">
        {event.status === "registration" && (
          <>
            <Button
              size="md"
              disabled={blocked || action.isPending}
              onClick={() => setConfirm("generate")}
            >
              Generar fixture
            </Button>
            <Button variant="outline" size="md" onClick={() => onTab("seed")}>
              Revisar la siembra
            </Button>
          </>
        )}
        {event.status === "in_progress" && (
          <>
            <Button size="md" onClick={() => onTab("matches")}>
              Ver partidas pendientes
            </Button>
            <Button
              variant="outline"
              size="md"
              disabled={action.isPending}
              onClick={() => setConfirm("reset")}
            >
              Volver a la siembra
            </Button>
            <span className="text-xs text-muted-foreground">
              Solo mientras no haya empezado ninguna partida.
            </span>
          </>
        )}
      </div>
      {event.tie_pending && (
        <TieResolver event={event} grp={event.tie_pending.grp} />
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm === "reset" ? "¿Volver a la siembra?" : "¿Generar el fixture?"
        }
        description={
          confirm === "reset"
            ? "Se borran las partidas armadas y el torneo vuelve a inscripciones con su siembra. Solo funciona si no empezó ninguna partida."
            : "Se arma la primera fase con la siembra actual. Después, la siembra queda fija hasta que se vuelva a ella."
        }
        confirmLabel={confirm === "reset" ? "Volver a la siembra" : "Generar"}
        pending={action.isPending}
        error={action.error}
        onConfirm={() =>
          confirm &&
          action.mutate(confirm, {
            onSuccess: () => {
              setConfirm(null)
              toast.success(
                confirm === "reset"
                  ? "El torneo volvió a la siembra."
                  : "Fixture generado."
              )
            },
          })
        }
      />
    </div>
  )
}

/** Empate de un grupo que la tabla no resuelve: el organizador ordena a los empatados. */
function TieResolver({ event, grp }: { event: EventDetail; grp: number }) {
  const standings = useQuery(eventStandingsOptions(event.id)).data ?? []
  const tied = standings
    .filter((s) => s.grp === grp && s.tied)
    .toSorted((a, b) => a.place - b.place)
  const [order, setOrder] = useState<string[] | null>(null)
  const ids = order ?? tied.map((s) => s.team.id)
  const qc = useQueryClient()
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/api/v1/events/{id}/ties", {
          params: { path: { id: event.id } },
          body: { grp, order: ids },
        })
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.detail(event.id) })
      toast.success("Empate resuelto.")
    },
  })
  if (tied.length < 2) return null
  const swap = (i: number, j: number) => {
    const next = [...ids]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
  }
  return (
    <Card variant="outline" className="flex flex-col gap-3 p-4">
      <h3 className="font-semibold">
        Empate en el grupo {String.fromCharCode(64 + grp)}
      </h3>
      <p className="text-[13px] text-muted-foreground">
        Ordena a los empatados del mejor al peor. Con eso se arman los cruces
        siguientes.
      </p>
      <ol className="flex flex-col gap-1.5">
        {ids.map((id, i) => {
          const s = tied.find((x) => x.team.id === id)!
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm"
            >
              <span className="w-5 font-mono text-muted-foreground">
                {i + 1}
              </span>
              <TeamCrest team={s.team} size="xs" />
              <span className="flex-1 truncate">{s.team.name}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={i === 0}
                aria-label={`Subir ${s.team.name}`}
                onClick={() => swap(i, i - 1)}
              >
                <ArrowUpIcon aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={i === ids.length - 1}
                aria-label={`Bajar ${s.team.name}`}
                onClick={() => swap(i, i + 1)}
              >
                <ArrowDownIcon aria-hidden />
              </Button>
            </li>
          )
        })}
      </ol>
      {save.isError && <ErrorAlert message={errorMessage(save.error)} />}
      <div>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          Guardar el orden
        </Button>
      </div>
    </Card>
  )
}

// ---- Inscripciones ----

export function RegistrationsTab({ event }: { event: EventDetail }) {
  if (event.historic) return <HistoricRegistrations event={event} />
  return <PlatformRegistrations event={event} />
}

function PlatformRegistrations({ event }: { event: EventDetail }) {
  const regs = useQuery(eventRegistrationsOptions(event.id))
  const remove = useRemoveRegistration(event.id)
  const [target, setTarget] = useState<Registration | null>(null)
  if (regs.isError)
    return <QueryError error={regs.error} onRetry={() => void regs.refetch()} />
  if (!regs.data) return <Skeleton className="h-80 rounded-xl" />
  if (regs.data.length === 0)
    return (
      <EmptyState>
        Todavía no hay equipos inscritos. Se inscriben desde la página del
        torneo.
      </EmptyState>
    )
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {regs.data.length} equipos{event.max_teams && ` de ${event.max_teams}`}
        {event.registration_closes_at &&
          ` · cierran el ${fmtDateTime(event.registration_closes_at)}`}
        . Cada equipo inscribe {event.players_per_team} activos con SteamID
        {event.subs_max > 0 && ` y hasta ${event.subs_max} suplentes`}.
      </p>
      <TableBox>
        <div className="overflow-x-auto overflow-y-hidden">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Siembra</th>
                <th className="px-3 py-2 font-medium">Equipo</th>
                <th className="px-3 py-2 font-medium">Activos</th>
                <th className="px-3 py-2 font-medium">Jugadores</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {regs.data.map((r) => (
                <tr
                  key={r.team.id}
                  className="border-b align-top last:border-b-0"
                >
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {r.seed}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2 font-medium">
                      <TeamCrest team={r.team} size="xs" />
                      {r.team.name}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={
                        active(r) < event.players_per_team ? "danger" : "win"
                      }
                    >
                      {active(r)} de {event.players_per_team}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.players
                      .map(
                        (p) => p.alias + (p.role === "sub" ? " (suplente)" : "")
                      )
                      .join(", ")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={event.status !== "registration"}
                      onClick={() => setTarget(r)}
                    >
                      Quitar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableBox>
      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`¿Quitar a ${target?.team.name ?? ""} del torneo?`}
        description="Pierde su lugar y su siembra. Puede volver a inscribirse mientras las inscripciones estén abiertas."
        confirmLabel="Quitar"
        danger
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          target &&
          remove.mutate(target.team.id, {
            onSuccess: () => {
              setTarget(null)
              toast.success("Equipo quitado del torneo.")
            },
          })
        }
      />
    </div>
  )
}

// ---- Configuración ----

export function ConfigTab({ event }: { event: EventDetail }) {
  const update = useUpdateEvent(event.id)
  const action = useEventAction(event.id)
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null)
  const config = event.config as Record<string, unknown>
  return (
    <div className="flex flex-col gap-6">
      <BannerCard event={event} />
      {!event.historic && <VetoTurnCard eventId={event.id} />}
      <EventForm
        initial={{
          name: event.name,
          template: event.template,
          config,
          game_mode: event.game_mode,
          subs_max: event.subs_max,
          starts_on: event.starts_on,
          ends_on: event.ends_on,
          registration_closes_at: event.registration_closes_at,
          prize: event.prize,
          prize_amount: event.prize_amount,
          prize_currency: event.prize_currency,
          prize_currency_other: event.prize_currency_other,
          max_teams: event.max_teams,
          rules: event.rules,
          map_pool: event.map_pool,
          historic: event.historic,
          testing: event.testing,
        }}
        canTesting={!!event.viewer?.can_review}
        locked={event.status !== "registration"}
        submitLabel="Guardar cambios"
        pending={update.isPending}
        error={update.error}
        onSubmit={(v) => {
          // Con el fixture generado, el formato no viaja (la base no deja cambiarlo).
          const body =
            event.status === "registration"
              ? v
              : {
                  name: v.name,
                  starts_on: v.starts_on,
                  ends_on: v.ends_on,
                  registration_closes_at: v.registration_closes_at,
                  prize: v.prize,
                  prize_amount: v.prize_amount,
                  prize_currency: v.prize_currency,
                  prize_currency_other: v.prize_currency_other,
                  max_teams: v.max_teams,
                  rules: v.rules,
                  ...(v.map_pool ? { map_pool: v.map_pool } : {}),
                  ...(v.testing !== undefined ? { testing: v.testing } : {}),
                }
          update.mutate(body, {
            onSuccess: () => toast.success("Torneo guardado."),
          })
        }}
      />
      {event.viewer?.can_own && (
        <Danger>
          <Button
            variant="outline"
            disabled={
              event.status === "finished" || event.status === "cancelled"
            }
            onClick={() => setConfirm("cancel")}
          >
            Cancelar torneo
          </Button>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => setConfirm("delete")}
          >
            Borrar torneo
          </Button>
          <span className="text-xs text-muted-foreground">
            Borrar solo funciona si no se jugó ninguna partida. Un moderador
            cancela y borra solo los torneos que creó.
          </span>
        </Danger>
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm === "delete" ? "¿Borrar el torneo?" : "¿Cancelar el torneo?"
        }
        description={
          confirm === "delete"
            ? "Se borra con sus inscripciones y partidas. No se puede deshacer."
            : "Queda como cancelado, con lo que se jugó hasta ahora."
        }
        confirmLabel={confirm === "delete" ? "Borrar" : "Cancelar torneo"}
        danger
        typed={confirm === "delete" ? event.name : undefined}
        pending={action.isPending}
        error={action.error}
        onConfirm={() =>
          confirm &&
          action.mutate(confirm, {
            onSuccess: () => {
              setConfirm(null)
              toast.success(
                confirm === "delete" ? "Torneo borrado." : "Torneo cancelado."
              )
              if (confirm === "delete") void navigate({ to: "/admin/events" })
            },
          })
        }
      />
    </div>
  )
}

function Danger({ children }: { children: ReactNode }) {
  return (
    <Card
      variant="outline"
      className="flex flex-wrap items-center gap-2 border-destructive/30 p-4"
    >
      <h3 className="w-full font-semibold">Zona delicada</h3>
      {children}
    </Card>
  )
}
