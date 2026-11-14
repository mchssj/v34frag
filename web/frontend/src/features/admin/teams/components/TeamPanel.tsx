import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { useDeferredValue, useId, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { ErrorAlert } from "@/components/brand/ErrorAlert"
import { TeamCrest } from "@/components/brand/TeamCrest"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  invitablePlayersOptions,
  teamMembersOptions,
} from "@/features/teams/api/queries"
import { ago } from "../../lib/format"
import {
  teamHistoryOptions,
  useStaffAction,
  type AdminTeam,
  type StaffAction,
} from "../api/queries"
import { ACTOR_LABEL, historyText, staffNotice } from "../lib/history"

type Role = "player" | "sub" | "coach"
const ROLE_LABEL: Record<Role, string> = {
  player: "Jugador",
  sub: "Suplente",
  coach: "Coach",
}
type Dialog =
  | { kind: "rename" | "logo" | "dissolve" | "add" }
  | { kind: "kick" | "captain"; playerId: string; alias: string }
  | { kind: "role"; playerId: string; alias: string; role: Role }

/** Panel del equipo elegido: datos, acciones, plantel e historial. El moderador ve menos acciones. */
export function TeamPanel({
  team,
  isAdmin,
}: {
  team: AdminTeam
  isAdmin: boolean
}) {
  const members = useQuery(teamMembersOptions(team.id))
  const history = useQuery(teamHistoryOptions(team.id))
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const section = "flex flex-col gap-2.5 border-b p-4 last:border-b-0"
  const h =
    "text-[12px] font-semibold tracking-wide text-muted-foreground uppercase"
  return (
    <div className="flex flex-col rounded-xl border bg-card">
      <div className={section}>
        <div className="flex items-center gap-3">
          <TeamCrest team={team} size="md" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-base font-semibold">
              {team.name}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {team.tag} · creado {ago(team.founded_at)}
            </span>
          </div>
        </div>
        {team.blocked && (
          <Badge variant="danger" className="w-fit">
            El nombre o la sigla tiene una palabra bloqueada
          </Badge>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          <Fact v={`${team.members}/10`} l="miembros" />
          <Fact v={team.players} l="juegan (sin coach)" />
          <Fact v={team.events_active} l="torneos activos" />
        </div>
      </div>

      <div className={section}>
        <h3 className={h}>Acciones</h3>
        <div className="grid gap-1.5 sm:grid-cols-2 [&>*]:h-auto [&>*]:min-h-8 [&>*]:py-1.5 [&>*]:text-left [&>*]:whitespace-normal">
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={() => setDialog({ kind: "rename" })}
          >
            Cambiar nombre y sigla
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            disabled={!team.logo_url}
            onClick={() => setDialog({ kind: "logo" })}
          >
            {team.logo_url ? "Quitar logo" : "Sin logo"}
          </Button>
          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => setDialog({ kind: "add" })}
              >
                Sumar jugador
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start text-destructive"
                onClick={() => setDialog({ kind: "dissolve" })}
              >
                Disolver equipo
              </Button>
            </>
          )}
          <Button asChild variant="ghost" size="sm" className="justify-start">
            <Link to="/teams/$id" params={{ id: team.id }}>
              Ver página del equipo
            </Link>
          </Button>
        </div>
        {!isAdmin && (
          <p className="text-xs text-muted-foreground">
            Cambiar el líder, sumar jugadores, cambiar roles y disolver son solo
            de admin.
          </p>
        )}
      </div>

      <div className={section}>
        <h3 className={h}>Plantel</h3>
        {members.isPending ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : members.isError ? (
          <ErrorAlert message={errorMessage(members.error)} />
        ) : (
          <ul className="flex flex-col">
            {members.data.map((m) => (
              <li
                key={m.player_id}
                className="flex flex-col gap-1.5 border-b border-dashed py-2 text-sm last:border-b-0"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-medium">{m.alias}</span>
                  {m.is_captain && <Badge variant="primary">líder</Badge>}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {isAdmin ? (
                    <Select
                      value={m.role}
                      onValueChange={(r) =>
                        r !== m.role &&
                        setDialog({
                          kind: "role",
                          playerId: m.player_id,
                          alias: m.alias,
                          role: r as Role,
                        })
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        className="w-28"
                        aria-label={`Rol de ${m.alias}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {ROLE_LABEL[m.role as Role] ?? m.role}
                    </span>
                  )}
                  <span className="ml-auto flex gap-1">
                    {isAdmin && !m.is_captain && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDialog({
                            kind: "captain",
                            playerId: m.player_id,
                            alias: m.alias,
                          })
                        }
                      >
                        Hacer líder
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={m.is_captain}
                      title={
                        m.is_captain
                          ? "Primero hay que cambiar el líder"
                          : undefined
                      }
                      onClick={() =>
                        setDialog({
                          kind: "kick",
                          playerId: m.player_id,
                          alias: m.alias,
                        })
                      }
                    >
                      Quitar
                    </Button>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={section}>
        <h3 className={h}>Historial</h3>
        {history.isPending ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : history.isError ? (
          <ErrorAlert message={errorMessage(history.error)} />
        ) : history.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin cambios registrados.
          </p>
        ) : (
          <ol className="flex max-h-80 flex-col gap-2.5 overflow-y-auto">
            {history.data.map((e) => (
              <li
                key={e.id}
                className="grid grid-cols-[8px_1fr] gap-2.5 text-[13px]"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-2 rounded-full",
                    e.actor_role === "admin"
                      ? "bg-primary"
                      : e.actor_role === "moderator" ||
                          e.actor_role === "support"
                        ? "bg-blue-500"
                        : "bg-muted-foreground"
                  )}
                />
                <span className="min-w-0">
                  <span className="font-semibold">
                    {e.actor.alias ?? ACTOR_LABEL[e.actor_role]}
                  </span>{" "}
                  {e.actor_role !== "team" && e.actor.alias && (
                    <Badge
                      variant={e.actor_role === "admin" ? "primary" : "muted"}
                    >
                      {ACTOR_LABEL[e.actor_role]}
                    </Badge>
                  )}{" "}
                  {historyText(e)}
                  {e.reason && (
                    <span className="block text-xs text-muted-foreground italic">
                      «{e.reason}»
                    </span>
                  )}
                  <span className="block text-[11.5px] text-muted-foreground">
                    {ago(e.at)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {dialog && (
        <StaffDialog
          team={team}
          dialog={dialog}
          isAdmin={isAdmin}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function Fact({ v, l }: { v: ReactNode; l: string }) {
  return (
    <div className="rounded-lg bg-muted px-2.5 py-1.5">
      <div className="font-mono text-[15px] font-semibold">{v}</div>
      <div className="text-[11px] text-muted-foreground">{l}</div>
    </div>
  )
}

const TITLE: Record<Dialog["kind"], (t: AdminTeam, alias?: string) => string> =
  {
    rename: (t) => `Cambiar nombre y sigla de ${t.name}`,
    logo: (t) => `Quitar el logo de ${t.name}`,
    dissolve: (t) => `Disolver ${t.name}`,
    add: (t) => `Sumar un jugador a ${t.name}`,
    kick: (t, a) => `Quitar a ${a} de ${t.name}`,
    captain: (_t, a) => `Hacer líder a ${a}`,
    role: (_t, a) => `Cambiar el rol de ${a}`,
  }
const CTA: Record<Dialog["kind"], string> = {
  rename: "Cambiar nombre",
  logo: "Quitar logo",
  dissolve: "Disolver",
  add: "Sumar",
  kick: "Quitar",
  captain: "Hacer líder",
  role: "Cambiar rol",
}

/** Diálogo de una acción del staff: lo propio de la acción, el motivo opcional y el aviso que recibe el líder. */
function StaffDialog({
  team,
  dialog,
  isAdmin,
  onClose,
}: {
  team: AdminTeam
  dialog: Dialog
  isAdmin: boolean
  onClose: () => void
}) {
  const id = useId()
  const act = useStaffAction(team.id)
  const [reason, setReason] = useState("")
  const [name, setName] = useState(team.name)
  const [tag, setTag] = useState(team.tag ?? "")
  const [confirm, setConfirm] = useState("")
  const [search, setSearch] = useState("")
  const deferred = useDeferredValue(search)
  const players = useQuery({
    ...invitablePlayersOptions(deferred),
    enabled: dialog.kind === "add" && deferred.trim().length >= 2,
  })
  const [picked, setPicked] = useState<{ id: string; alias: string } | null>(
    null
  )
  const [role, setRole] = useState<Role>("player")
  const alias = "alias" in dialog ? dialog.alias : picked?.alias

  const action: StaffAction | null =
    dialog.kind === "rename"
      ? { kind: "rename", name: name.trim(), tag: tag.trim().toUpperCase() }
      : dialog.kind === "add"
        ? picked && { kind: "add", playerId: picked.id, role }
        : dialog.kind === "kick" || dialog.kind === "captain"
          ? { kind: dialog.kind, playerId: dialog.playerId }
          : dialog.kind === "role"
            ? { kind: "role", playerId: dialog.playerId, role: dialog.role }
            : { kind: dialog.kind }
  const ready =
    !!action &&
    (dialog.kind !== "rename" ||
      (name.trim().length >= 2 &&
        tag.trim().length >= 1 &&
        (name.trim() !== team.name ||
          tag.trim().toUpperCase() !== team.tag))) &&
    (dialog.kind !== "dissolve" || confirm.trim() === team.name)
  const danger = dialog.kind === "dissolve" || dialog.kind === "kick"

  return (
    <Dialog open onOpenChange={(o) => !o && !act.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TITLE[dialog.kind](team, alias)}</DialogTitle>
          <DialogDescription>
            {dialog.kind === "logo" &&
              "El escudo vuelve a mostrar la sigla. El equipo puede subir otro."}
            {dialog.kind === "kick" &&
              "Sale del plantel. Si está inscrito con este equipo en un torneo abierto, también sale de la inscripción."}
            {dialog.kind === "dissolve" &&
              "Todos salen y el equipo deja de existir: no se reactiva. No se puede si está en un torneo abierto o en curso."}
            {dialog.kind === "captain" &&
              "Sin el tope de equipos por líder. El líder anterior sigue en el plantel."}
            {dialog.kind === "rename" &&
              "El equipo puede volver a cambiarlo con sus reglas de siempre (una vez cada 30 días)."}
            {dialog.kind === "add" &&
              "Directo, sin invitación. Necesita cuenta y SteamID, y vale el máximo de miembros."}
            {dialog.kind === "role" &&
              `Pasa a ${ROLE_LABEL[dialog.role].toLowerCase()}.`}
          </DialogDescription>
        </DialogHeader>

        {dialog.kind === "rename" && (
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <label
              className="flex flex-col gap-1.5 text-[13px] font-medium"
              htmlFor={`${id}-n`}
            >
              Nombre
              <Input
                id={`${id}-n`}
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label
              className="flex flex-col gap-1.5 text-[13px] font-medium"
              htmlFor={`${id}-t`}
            >
              Sigla
              <Input
                id={`${id}-t`}
                value={tag}
                maxLength={6}
                className="font-mono"
                onChange={(e) =>
                  setTag(e.target.value.toUpperCase().replace(/\s/g, ""))
                }
              />
            </label>
          </div>
        )}
        {dialog.kind === "add" && (
          <div className="flex flex-col gap-2">
            <label
              className="flex flex-col gap-1.5 text-[13px] font-medium"
              htmlFor={`${id}-s`}
            >
              Jugador
              <Input
                id={`${id}-s`}
                value={search}
                placeholder="Buscar por alias"
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <ul className="flex max-h-44 flex-col gap-1 overflow-y-auto">
              {(players.data ?? []).map((p) => {
                const blocked = !p.has_account || !p.has_steam
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => setPicked({ id: p.id, alias: p.alias })}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-sm disabled:opacity-50",
                        picked?.id === p.id &&
                          "border-primary ring-1 ring-primary"
                      )}
                    >
                      {p.alias}
                      {blocked && (
                        <span className="text-xs text-muted-foreground">
                          Sin cuenta o SteamID
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
            <Select value={role} onValueChange={(r) => setRole(r as Role)}>
              <SelectTrigger className="w-40" aria-label="Rol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {dialog.kind === "dissolve" && (
          <label
            className="flex flex-col gap-1.5 text-[13px] font-medium"
            htmlFor={`${id}-c`}
          >
            Escribe «{team.name}» para confirmar
            <Input
              id={`${id}-c`}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
        )}

        <label
          className="flex flex-col gap-1.5 text-[13px] font-medium"
          htmlFor={`${id}-r`}
        >
          Motivo{" "}
          <span className="font-normal text-muted-foreground">
            (opcional: lo ve el líder y queda en el historial)
          </span>
          <Textarea
            id={`${id}-r`}
            rows={2}
            maxLength={300}
            value={reason}
            placeholder="Ej.: el nombre tiene una palabra no permitida"
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          El líder recibe un aviso: «
          {staffNotice(isAdmin ? "admin" : "moderator", dialog.kind, alias)}
          {reason.trim() ? `: ${reason.trim()}` : ""}».
          {dialog.kind === "kick" && " El jugador también recibe el suyo."}
        </p>
        {act.isError && <ErrorAlert message={errorMessage(act.error)} />}
        <DialogFooter>
          <Button variant="outline" disabled={act.isPending} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={danger ? "destructive" : "default"}
            disabled={!ready || act.isPending}
            onClick={() =>
              action &&
              act.mutate(
                { action, reason },
                {
                  onSuccess: () => {
                    toast.success("Hecho: el líder recibió el aviso.")
                    onClose()
                  },
                }
              )
            }
          >
            {CTA[dialog.kind]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
