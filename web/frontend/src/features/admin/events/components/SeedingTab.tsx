import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon } from "lucide-react"
import { Fragment, useState, type KeyboardEvent } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { ErrorAlert } from "@/components/brand/ErrorAlert"
import { TeamCrest } from "@/components/brand/TeamCrest"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { eventRegistrationsOptions } from "@/features/events/api/queries"
import type { EventDetail, Registration } from "@/features/events/types"
import { EmptyState, QueryError } from "../../components/ui"
import { useSeeds } from "../api/queries"
import {
  koRound1,
  moveItem,
  seedBlocks,
  snakeGroups,
  swissRound1,
  type Pair,
  type Template,
} from "../lib/model"

type Team = Registration["team"]

/** Siembra: por ranking, sorteada o a mano (arrastrando o con ▲ ▼). Solo antes de generar el fixture. */
export function SeedingTab({ event }: { event: EventDetail }) {
  const regs = useQuery(eventRegistrationsOptions(event.id))
  if (regs.isError)
    return <QueryError error={regs.error} onRetry={() => void regs.refetch()} />
  if (!regs.data) return <Skeleton className="h-96 rounded-xl" />
  if (regs.data.length === 0)
    return <EmptyState>Todavía no hay equipos inscritos.</EmptyState>
  // La clave reinicia el orden local cuando cambia la siembra guardada.
  return (
    <Seeding
      key={regs.data.map((r) => r.team.id).join()}
      event={event}
      regs={regs.data}
    />
  )
}

function Seeding({
  event,
  regs,
}: {
  event: EventDetail
  regs: Registration[]
}) {
  const saved = regs.map((r) => r.team.id)
  const [order, setOrder] = useState(saved)
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<"ranking" | "draw" | null>(null)
  const seeds = useSeeds(event.id)
  const editable = event.status === "registration"
  const byId = new Map(regs.map((r) => [r.team.id, r]))
  const dirty = order.some((id, i) => id !== saved[i])
  const template = event.template as Template
  const config = event.config as {
    stages?: number
    size?: number
    groups?: number
  }
  const blocks = seedBlocks(template, config, order.length)

  const move = (id: string, to: number) => {
    const from = order.indexOf(id)
    if (to < 0 || to >= order.length) return
    setOrder(moveItem(order, from, to))
  }
  const onKey = (e: KeyboardEvent, id: string) => {
    if (!e.altKey || !editable) return
    const i = order.indexOf(id)
    if (e.key === "ArrowUp") {
      e.preventDefault()
      move(id, i - 1)
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      move(id, i + 1)
    }
  }
  const run = (arg: Parameters<typeof seeds.mutate>[0], ok: string) =>
    seeds.mutate(arg, {
      onSuccess: () => {
        setConfirm(null)
        toast.success(ok)
      },
    })
  const regenerate = (by: "ranking" | "draw") =>
    dirty
      ? setConfirm(by)
      : run(
          { by },
          by === "ranking" ? "Siembra por ranking." : "Siembra sorteada."
        )

  const teams = order.map((id) => byId.get(id)!.team)
  return (
    <div className="flex flex-col gap-4">
      {!editable && (
        <p className="rounded-lg bg-muted px-3 py-2 text-[13px] text-muted-foreground">
          El fixture ya está generado: la siembra queda fija. Mientras no haya
          empezado ninguna partida, se puede volver a la siembra desde Resumen.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!editable || seeds.isPending}
            onClick={() => regenerate("ranking")}
          >
            Generar por ranking
          </Button>
          <Button
            variant="outline"
            disabled={!editable || seeds.isPending}
            onClick={() => regenerate("draw")}
          >
            Sortear
          </Button>
          <Button
            variant="ghost"
            disabled={!dirty}
            onClick={() => setOrder(saved)}
          >
            Deshacer cambios
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {event.draw ? "Sorteada" : "Guardada"}
            {dirty && " · con cambios a mano sin guardar"}
          </span>
          <Button
            disabled={!editable || !dirty || seeds.isPending}
            onClick={() =>
              run({ by: "manual", teams: order }, "Siembra guardada.")
            }
          >
            Guardar siembra
          </Button>
        </div>
      </div>
      {seeds.isError && <ErrorAlert message={errorMessage(seeds.error)} />}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <ol
          className="overflow-hidden rounded-xl border bg-card"
          aria-label="Siembra"
        >
          {order.map((id, i) => {
            const r = byId.get(id)!
            const block = blocks.find((b) => b.from === i + 1 && b.label)
            const active = r.players.filter((p) => p.role === "active").length
            const subs = r.players.length - active
            const moved = id !== saved[i]
            return (
              <Fragment key={id}>
                {block && (
                  <li
                    className="flex items-center justify-between border-b bg-muted px-3 py-1.5 text-xs font-semibold"
                    aria-hidden
                  >
                    <span>{block.label}</span>
                    <span className="font-mono font-normal text-muted-foreground">
                      {block.from}–{block.to}
                    </span>
                  </li>
                )}
                <li
                  tabIndex={editable ? 0 : -1}
                  draggable={editable}
                  aria-label={`Siembra ${i + 1}: ${r.team.name}`}
                  onKeyDown={(e) => onKey(e, id)}
                  onDragStart={(e) => {
                    setDragging(id)
                    e.dataTransfer.effectAllowed = "move"
                  }}
                  onDragEnd={() => {
                    setDragging(null)
                    setOver(null)
                  }}
                  onDragOver={(e) => {
                    if (!dragging) return
                    e.preventDefault()
                    setOver(id)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragging) move(dragging, i)
                    setDragging(null)
                    setOver(null)
                  }}
                  className={cn(
                    "grid grid-cols-[16px_32px_minmax(0,1fr)_auto_auto] items-center gap-2.5 border-b px-2.5 py-1.5 outline-none last:border-b-0 focus-visible:bg-muted",
                    editable && "cursor-grab",
                    dragging === id && "opacity-40",
                    over === id &&
                      dragging !== id &&
                      "shadow-[inset_0_2px_0_var(--primary)]"
                  )}
                >
                  <GripVerticalIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "text-right font-mono text-sm font-semibold",
                      moved && "text-primary"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <TeamCrest team={r.team} size="xs" />
                    <span className="truncate text-sm font-medium">
                      {r.team.name}
                    </span>
                    {moved && <Badge variant="primary">a mano</Badge>}
                  </span>
                  {active < event.players_per_team ? (
                    <Badge variant="danger">
                      {active}/{event.players_per_team}
                    </Badge>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">
                      {active}/{event.players_per_team}
                      {subs > 0 && ` +${subs}`}
                    </span>
                  )}
                  <span className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={!editable || i === 0}
                      aria-label={`Subir ${r.team.name}`}
                      onClick={() => move(id, i - 1)}
                    >
                      <ArrowUpIcon aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={!editable || i === order.length - 1}
                      aria-label={`Bajar ${r.team.name}`}
                      onClick={() => move(id, i + 1)}
                    >
                      <ArrowDownIcon aria-hidden />
                    </Button>
                  </span>
                </li>
              </Fragment>
            )
          })}
        </ol>
        <Preview
          template={template}
          config={config}
          teams={teams}
          blocks={blocks}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Arrastra una fila o usa ▲ ▼ (con el teclado, Alt + flechas).
        {blocks.length > 1 &&
          " Pasar un equipo por encima de una línea le cambia la etapa en la que entra."}{" "}
        Por ranking: puntos de torneos y PCW, después el ELO promedio de los
        activos y después la inscripción.
      </p>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm === "draw"
            ? "¿Sortear la siembra?"
            : "¿Generar la siembra por ranking?"
        }
        description="Reemplaza la siembra entera y se pierden los cambios a mano sin guardar."
        confirmLabel={confirm === "draw" ? "Sortear" : "Generar"}
        pending={seeds.isPending}
        error={seeds.error}
        onConfirm={() =>
          confirm &&
          run(
            { by: confirm },
            confirm === "draw" ? "Siembra sorteada." : "Siembra por ranking."
          )
        }
      />
    </div>
  )
}

function PairRow({ pair, labelB }: { pair: Pair<Team>; labelB?: string }) {
  const side = (t: Team | null, fallback: string, right?: boolean) => (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5",
        right && "flex-row-reverse text-right"
      )}
    >
      {t ? (
        <TeamCrest team={t} size="xs" />
      ) : (
        <span
          className="size-5 shrink-0 rounded border border-dashed"
          aria-hidden
        />
      )}
      <span className="truncate">{t?.name ?? fallback}</span>
    </span>
  )
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-lg border px-2 py-1.5 text-xs">
      {side(pair.a, "Libre")}
      <span className="font-mono text-[10.5px] text-muted-foreground">
        {labelB ? `#${pair.sa}` : `${pair.sa}·${pair.sb}`}
      </span>
      {side(
        pair.b,
        pair.a && !labelB ? "Pasa solo" : (labelB ?? "Libre"),
        true
      )}
    </li>
  )
}

function Preview({
  template,
  config,
  teams,
  blocks,
}: {
  template: Template
  config: { stages?: number; size?: number; groups?: number }
  teams: Team[]
  blocks: ReturnType<typeof seedBlocks>
}) {
  const box = "flex flex-col gap-2"
  const title =
    "text-[13px] font-semibold tracking-wide text-muted-foreground uppercase"
  if (template === "swiss") {
    const first = blocks[blocks.length - 1]
    const stage1 = teams.slice(first.from - 1, first.to)
    const direct =
      blocks.length > 1
        ? teams.slice(
            blocks[blocks.length - 2].from - 1,
            blocks[blocks.length - 2].to
          )
        : []
    return (
      <div className="flex flex-col gap-5">
        <div className={box}>
          <h3 className={title}>Etapa 1 · ronda 1</h3>
          <p className="text-xs text-muted-foreground">
            Mitad de arriba contra mitad de abajo.
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {swissRound1(stage1, first.from).map((p) => (
              <PairRow key={p.sa} pair={p} />
            ))}
          </ul>
        </div>
        {direct.length > 0 && (
          <div className={box}>
            <h3 className={title}>Etapa 2 · ronda 1</h3>
            <p className="text-xs text-muted-foreground">
              Los que entran directo contra los que pasan la etapa 1, por su
              récord.
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {direct.map((t, k) => (
                <PairRow
                  key={t.id}
                  pair={{
                    a: t,
                    b: null,
                    sa: blocks[blocks.length - 2].from + k,
                    sb: 0,
                  }}
                  labelB={`${k + 1}.º etapa 1`}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }
  if (template === "groups" || template === "groups_double") {
    const groups = snakeGroups(teams, config.groups ?? 2)
    return (
      <div className={box}>
        <h3 className={title}>Grupos</h3>
        <p className="text-xs text-muted-foreground">
          Reparto en serpentina: cada grupo queda parejo.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {groups.map((g, k) => (
            <div key={k} className="overflow-hidden rounded-lg border text-xs">
              <div className="bg-muted px-2 py-1 font-semibold">
                Grupo {String.fromCharCode(65 + k)}
              </div>
              {g.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-1.5 border-t px-2 py-1"
                >
                  <span className="font-mono text-muted-foreground">
                    #{teams.indexOf(t) + 1}
                  </span>
                  <span className="truncate">{t.tag ?? t.name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className={box}>
      <h3 className={title}>Primera ronda</h3>
      <p className="text-xs text-muted-foreground">
        Orden clásico (1-8, 4-5, 2-7, 3-6): los dos mejores solo se cruzan en la
        final.
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {koRound1(teams).map((p) => (
          <PairRow key={p.sa} pair={p} />
        ))}
      </ul>
    </div>
  )
}
