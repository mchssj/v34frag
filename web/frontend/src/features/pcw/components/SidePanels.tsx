import { cn } from "cn"
import {
  BellIcon,
  ServerIcon,
  TrashIcon,
  TrophyIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"
import { createContext, useContext, useState } from "react"

import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { Segmented } from "@/components/brand/Segmented"
import { TeamCrest } from "@/components/brand/TeamCrest"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { avgElo, sideName, whenLabel } from "../lib/pcw"
import { TeamName } from "./TeamName"
import type {
  BestOf,
  PcwAlert,
  PcwResult,
  PcwServer,
  PcwTeamRef,
  SubRequest,
} from "../types"

/** Dentro de las pestañas de la columna: sin tarjeta propia y con el título solo para lectores de pantalla. */
const BareCtx = createContext(false)
export const BarePanels = BareCtx.Provider

function Panel({
  id,
  icon: Icon,
  title,
  aside,
  children,
}: {
  id: string
  icon: typeof ServerIcon
  title: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  const bare = useContext(BareCtx)
  if (bare)
    return (
      <section aria-labelledby={id} className="flex flex-col gap-3">
        <div className="flex min-h-6 items-center gap-2">
          <h2 id={id} className="sr-only">
            {title}
          </h2>
          <span className="flex-1" />
          {aside}
        </div>
        {children}
      </section>
    )
  return (
    <Card variant="outline" asChild className="flex flex-col gap-3 p-4">
      <section aria-labelledby={id}>
        <div className="flex items-center gap-2">
          <Icon aria-hidden className="size-4 text-muted-foreground" />
          <h2 id={id} className="flex-1 text-[15px] font-bold">
            {title}
          </h2>
          {aside}
        </div>
        {children}
      </section>
    </Card>
  )
}

/** Servidores aptos para PCW: libres ahora y la fila de espera (idea b). */
export function ServersPanel({
  servers,
  queue,
}: {
  servers: PcwServer[]
  queue: number
}) {
  const free = servers.filter((s) => s.free).length
  return (
    <Panel
      id="pcw-servers-h"
      icon={ServerIcon}
      title="Servidores para PCW"
      aside={
        <Badge variant={free ? "win" : "warn"} size="sm" shape="pill">
          {free ? `${free} libres` : "Todos ocupados"}
        </Badge>
      }
    >
      <ul className="flex flex-col gap-1.5">
        {servers.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className={cn(
                "size-2 rounded-full",
                s.free ? "bg-win" : "bg-muted-foreground/50"
              )}
            />
            <span className="flex-1">{s.name}</span>
            <span className="text-xs text-muted-foreground">
              {s.free ? "Libre" : "Ocupado"}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {queue
          ? `${queue} PCW esperando servidor. Cuando los dos equipos están listos entran a la fila y toman el primero que se libera.`
          : "Si los dos equipos están listos ahora, la PCW toma un servidor en el acto."}
      </p>
    </Panel>
  )
}

/** "Nos falta 1": anuncios de suplentes y anotarse (idea l, backend). */
export function SubsPanel({
  subs,
  now,
  meId,
  onApply,
  onRequest,
}: {
  subs: SubRequest[]
  now: Date
  meId: string
  onApply: (id: string) => void
  onRequest: (need: number, bo: BestOf) => void
}) {
  const [need, setNeed] = useState<1 | 2>(1)
  const [open, setOpen] = useState(false)
  return (
    <Panel
      id="pcw-subs-h"
      icon={UserPlusIcon}
      title="Buscan suplentes"
      aside={
        <Button size="xs" variant="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? "Cerrar" : "Nos falta gente"}
        </Button>
      }
    >
      {open && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-2.5">
          <Segmented
            label="Cuántos faltan"
            size="sm"
            value={need}
            onChange={setNeed}
            options={[
              { value: 1, label: "Falta 1" },
              { value: 2, label: "Faltan 2" },
            ]}
          />
          <Button
            size="sm"
            onClick={() => {
              onRequest(need, 3)
              setOpen(false)
            }}
          >
            Publicar
          </Button>
        </div>
      )}
      {subs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nadie busca suplentes ahora.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {subs.map((s) => {
            const applied = s.applicants.some((a) => a.id === meId)
            return (
              <li
                key={s.id}
                className="flex flex-col gap-1.5 rounded-lg border p-2.5"
              >
                <div className="flex items-center gap-2">
                  {s.side.team ? (
                    <TeamCrest team={s.side.team} size="xs" />
                  ) : (
                    <UsersIcon
                      aria-hidden
                      className="size-4 text-muted-foreground"
                    />
                  )}
                  <TeamName
                    team={s.side.team}
                    name={sideName(s.side)}
                    className="min-w-0 flex-1 truncate text-sm font-semibold"
                  />
                  <Badge variant="primary" size="sm" shape="pill">
                    {s.need === 1 ? "Falta 1" : `Faltan ${s.need}`}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  BO{s.best_of} · {whenLabel(s.starts_at, now)} · ELO medio{" "}
                  {avgElo(s.side.roster)}
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    {s.applicants.map((a) => (
                      <PlayerAvatar
                        key={a.id}
                        alias={a.alias}
                        photo={a.photo}
                        className="size-6 ring-2 ring-card"
                      />
                    ))}
                  </div>
                  <span className="flex-1 text-xs text-muted-foreground">
                    {s.applicants.length
                      ? `${s.applicants.length} anotado${s.applicants.length > 1 ? "s" : ""}`
                      : "Sin anotados"}
                  </span>
                  <Button
                    size="xs"
                    variant={applied ? "secondary" : "default"}
                    disabled={applied}
                    onClick={() => onApply(s.id)}
                  >
                    {applied ? "Anotado" : "Me anoto"}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/** Avisos a medida (idea j, backend): "avisame si aparece una BO3 de mi nivel". */
export function AlertsPanel({
  alerts,
  onAdd,
  onRemove,
}: {
  alerts: PcwAlert[]
  onAdd: (a: Omit<PcwAlert, "id">) => void
  onRemove: (id: string) => void
}) {
  const [bo, setBo] = useState<BestOf | 0>(0)
  const [myLevel, setMyLevel] = useState(true)
  const [asTeam, setAsTeam] = useState(false)
  const describe = (a: PcwAlert) =>
    [
      a.formats.length === 3
        ? "Cualquier formato"
        : a.formats.map((f) => `BO${f}`).join(" o "),
      a.myLevel && "de mi nivel",
      a.asTeam && "como equipo",
    ]
      .filter(Boolean)
      .join(", ")

  return (
    <Panel id="pcw-alerts-h" icon={BellIcon} title="Avisame cuando aparezca">
      {alerts.length > 0 && (
        <ul className="flex flex-col gap-1">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{describe(a)}</span>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={`Borrar el aviso: ${describe(a)}`}
                onClick={() => onRemove(a.id)}
              >
                <TrashIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2.5 rounded-lg bg-muted p-2.5">
        <Segmented
          label="Formato del aviso"
          size="sm"
          value={bo}
          onChange={setBo}
          options={[
            { value: 0, label: "Todos" },
            { value: 1, label: "BO1" },
            { value: 3, label: "BO3" },
            { value: 5, label: "BO5" },
          ]}
        />
        <div className="flex items-center gap-2">
          <Switch
            id="al-level"
            checked={myLevel}
            onCheckedChange={setMyLevel}
          />
          <Label htmlFor="al-level" className="text-[13px]">
            Solo de mi nivel
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="al-team" checked={asTeam} onCheckedChange={setAsTeam} />
          <Label htmlFor="al-team" className="text-[13px]">
            Solo equipos (suma al ranking)
          </Label>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onAdd({ formats: bo ? [bo] : [1, 3, 5], myLevel, asTeam })
          }
        >
          Crear aviso
        </Button>
        <p className="text-xs text-muted-foreground">
          Llega como notificación de la web y, si lo tenés vinculado, por
          Discord.
        </p>
      </div>
    </Panel>
  )
}

/** Últimas PCW jugadas y los equipos más activos: llena la página aunque el tablón esté vacío. */
export function ActivityPanel({
  results,
  now,
}: {
  results: PcwResult[]
  now: Date
}) {
  const count = new Map<string, { team: PcwTeamRef; n: number; w: number }>()
  for (const r of results) {
    for (const [t, won] of [
      [r.a, r.score[0] > r.score[1]],
      [r.b, r.score[1] > r.score[0]],
    ] as const) {
      const c = count.get(t.id) ?? { team: t, n: 0, w: 0 }
      c.n++
      if (won) c.w++
      count.set(t.id, c)
    }
  }
  const active = [...count.values()].sort((a, b) => b.n - a.n).slice(0, 5)
  const last = [...results].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5)

  return (
    <Panel id="pcw-activity-h" icon={TrophyIcon} title="Actividad de PCW">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Últimas jugadas</span>
        <ul className="flex flex-col gap-1">
          {last.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-right",
                  r.score[0] > r.score[1] && "font-semibold"
                )}
              >
                <TeamName team={r.a} />
              </span>
              <span className="font-mono text-xs font-semibold">
                {r.score[0]}-{r.score[1]}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  r.score[1] > r.score[0] && "font-semibold"
                )}
              >
                <TeamName team={r.b} />
              </span>
              <span className="w-14 shrink-0 text-right text-[11px] text-muted-foreground">
                {whenLabel(r.at, now).replace("Hace ", "")}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1.5 border-t pt-3">
        <span className="text-xs text-muted-foreground">Más activos</span>
        <ul className="flex flex-col gap-1.5">
          {active.map((a, i) => (
            <li key={a.team.id} className="flex items-center gap-2 text-sm">
              <span className="w-4 font-mono text-xs text-muted-foreground">
                {i + 1}
              </span>
              <TeamCrest team={a.team} size="xs" />
              <TeamName team={a.team} className="flex-1 truncate" />
              <span className="font-mono text-xs text-muted-foreground">
                {a.w}G · {a.n - a.w}P
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
