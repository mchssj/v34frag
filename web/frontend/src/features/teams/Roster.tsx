import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { CheckIcon, CrownIcon, EllipsisIcon, UserMinusIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MAX_ROSTER,
  rosterGroups,
  STATUS_LABEL,
  statusOf,
  type RosterStatus,
} from "./model"
import {
  useKickMember,
  useSetMemberRole,
  useTransferCaptain,
  type RosterEntry,
} from "./queries"
import { Eyebrow, Initial, Panel, STATUS_CHIP } from "./ui"

const since = (iso: string | null) =>
  iso ? `desde ${format(parseISO(iso), "MMM yyyy", { locale: es })}` : null

type Confirm = { kind: "captain" | "kick"; member: RosterEntry } | null

/** Roster agrupado por estado. El líder gestiona desde el menú ⋯ de cada fila. */
export function Roster({
  teamId,
  teamName,
  members,
  maxMembers,
  isLeader,
}: {
  teamId: string
  teamName: string
  members: RosterEntry[]
  maxMembers: number | null
  isLeader: boolean
}) {
  const [confirm, setConfirm] = useState<Confirm>(null)

  return (
    <Panel
      title="Roster"
      aside={
        <span className="font-mono font-semibold text-foreground">
          {members.length}/{maxMembers ?? MAX_ROSTER}
        </span>
      }
    >
      {rosterGroups(members).map((group) => (
        <div key={group.status} role="group" aria-label={group.label}>
          <div className="flex items-center justify-between border-b bg-muted/45 px-[18px] py-2">
            <span className="flex items-center gap-2">
              <Eyebrow className="text-muted-foreground">{group.label}</Eyebrow>
              <span className="font-mono text-[11px] font-semibold">
                {group.members.length}
              </span>
            </span>
          </div>
          <ul>
            {group.members.map((m) => (
              <RosterRow
                key={m.player_id}
                teamId={teamId}
                member={m}
                isLeader={isLeader}
                onConfirm={(kind) => setConfirm({ kind, member: m })}
              />
            ))}
          </ul>
        </div>
      ))}
      {isLeader && (
        <p className="border-t px-[18px] py-3 text-xs text-muted-foreground">
          El estado de cada uno es libre: al inscribir al equipo en un torneo
          eliges quiénes juegan como activos y suplentes.
        </p>
      )}
      {confirm && (
        <ConfirmDialog
          teamId={teamId}
          teamName={teamName}
          confirm={confirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </Panel>
  )
}

function RosterRow({
  teamId,
  member,
  isLeader,
  onConfirm,
}: {
  teamId: string
  member: RosterEntry
  isLeader: boolean
  onConfirm: (kind: "captain" | "kick") => void
}) {
  const status = statusOf(member)
  return (
    <li className="flex items-center gap-3 border-b px-[18px] py-2.5 last:border-b-0">
      <Link
        to="/player/$nick"
        params={{ nick: member.alias }}
        aria-label={`Perfil de ${member.alias}`}
        className="rounded-full outline-none hover:ring-2 hover:ring-primary focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Initial
          name={member.alias}
          photo={member.photo_url}
          className="size-8"
          fallbackClassName="text-[13px]"
        />
      </Link>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">{member.alias}</span>
          {member.is_captain && (
            <span className="inline-flex h-[18px] shrink-0 items-center gap-1 rounded-full bg-primary/15 px-1.5 text-[11px] font-medium text-primary">
              <CrownIcon className="size-3" aria-hidden />
              {/* Bajo 400px, solo la corona: el texto le quitaba lugar al nombre. */}
              <span className="sr-only min-[400px]:not-sr-only">Líder</span>
            </span>
          )}
        </span>
        {/* El puesto que eligió en su perfil (IGL, AWPer…) y desde cuándo está. */}
        <span className="truncate text-xs text-muted-foreground">
          {[member.game_role, since(member.joined_at)]
            .filter(Boolean)
            .join(" · ") || "Integrante"}
        </span>
      </span>
      <span className="flex shrink-0 justify-end sm:w-[84px]">
        <span
          className={cn(
            "inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[11px] font-medium",
            STATUS_CHIP[status]
          )}
        >
          {status === "player" && (
            <span className="size-1.5 rounded-full bg-current" aria-hidden />
          )}
          {STATUS_LABEL[status]}
        </span>
      </span>
      {isLeader && (
        <RowMenu
          teamId={teamId}
          member={member}
          status={status}
          onConfirm={onConfirm}
        />
      )}
    </li>
  )
}

function RowMenu({
  teamId,
  member,
  status,
  onConfirm,
}: {
  teamId: string
  member: RosterEntry
  status: RosterStatus
  onConfirm: (kind: "captain" | "kick") => void
}) {
  const setRole = useSetMemberRole()

  async function change(role: RosterStatus) {
    if (role === status) return
    try {
      await setRole.mutateAsync({ teamId, playerId: member.player_id, role })
      toast.success(
        `${member.alias} ahora es ${STATUS_LABEL[role].toLowerCase()}`
      )
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={`Opciones de ${member.alias}`}
        >
          <EllipsisIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[230px]">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Estado en el roster
        </DropdownMenuLabel>
        {(["player", "sub", "coach"] as const).map((s) => (
          <DropdownMenuItem
            key={s}
            disabled={setRole.isPending}
            onSelect={() => void change(s)}
            className="justify-between"
          >
            {STATUS_LABEL[s]}
            {s === status && (
              <CheckIcon className="size-4 text-primary" aria-hidden />
            )}
          </DropdownMenuItem>
        ))}
        {/* En la fila del líder solo va el bloque de estado. */}
        {!member.is_captain && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!member.has_steam}
              onSelect={() => onConfirm("captain")}
              className="flex-col items-start gap-0.5"
            >
              <span className="flex items-center gap-2">
                <CrownIcon className="size-4" aria-hidden />
                Ceder liderazgo
              </span>
              {!member.has_steam && (
                <span className="pl-6 text-[11px] text-muted-foreground">
                  Necesita SteamID vinculado
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onConfirm("kick")}
            >
              <UserMinusIcon className="size-4" aria-hidden />
              Expulsar del equipo
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ConfirmDialog({
  teamId,
  teamName,
  confirm,
  onClose,
}: {
  teamId: string
  teamName: string
  confirm: NonNullable<Confirm>
  onClose: () => void
}) {
  const transfer = useTransferCaptain()
  const kick = useKickMember()
  const { member, kind } = confirm
  const mutation = kind === "captain" ? transfer : kick
  const nick = member.alias

  async function run() {
    try {
      await mutation.mutateAsync({ teamId, playerId: member.player_id })
      toast.success(
        kind === "captain"
          ? `${nick} ahora es el líder de ${teamName}`
          : `${nick} salió del equipo`
      )
      onClose()
    } catch {
      // Se muestra en el diálogo.
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[420px]">
        <div className="flex flex-col gap-1.5">
          <DialogTitle className="text-base font-semibold">
            {kind === "captain"
              ? `Ceder liderazgo a ${nick}`
              : `Expulsar a ${nick}`}
          </DialogTitle>
          <DialogDescription className="text-pretty">
            {kind === "captain"
              ? `${nick} pasa a ser el líder: invita jugadores, gestiona el roster y los roles, e inscribe al equipo en torneos. Tú sigues en el roster con tu estado actual.`
              : "Sale del roster y queda como ex integrante en el historial del equipo. Solo puede volver con una invitación nueva."}
          </DialogDescription>
        </div>
        {mutation.error != null && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(mutation.error)}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={kind === "captain" ? "default" : "destructive"}
            className={
              kind === "kick"
                ? "bg-destructive text-white hover:bg-destructive/90"
                : undefined
            }
            disabled={mutation.isPending}
            onClick={() => void run()}
          >
            {kind === "captain" ? "Ceder liderazgo" : "Expulsar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
