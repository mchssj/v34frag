import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { AtSignIcon, SendIcon } from "lucide-react"
import { useDeferredValue, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { MAX_ROSTER, STATUS_LABEL, type RosterStatus } from "./model"
import {
  invitablePlayersOptions,
  useInvitePlayer,
  type PlayerSummary,
} from "./queries"
import { Initial } from "./ui"

// El backend acepta hasta 200 caracteres en invitaciones y pedidos.
const MESSAGE_MAX = 200

/** Por qué un jugador no puede recibir la invitación, o null si puede. */
function blockedReason(p: PlayerSummary, memberIds: Set<string>) {
  if (memberIds.has(p.id)) return "Ya está en el roster"
  if (!p.has_account || !p.has_steam)
    return "Sin cuenta o SteamID: no puede entrar"
  return null
}

export function InviteDrawer({
  open,
  onOpenChange,
  teamId,
  teamName,
  memberIds,
  maxMembers,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  teamName: string
  memberIds: string[]
  maxMembers: number | null
}) {
  const [query, setQuery] = useState("")
  const deferred = useDeferredValue(query.trim())
  const [selected, setSelected] = useState<PlayerSummary | null>(null)
  const [role, setRole] = useState<RosterStatus>("player")
  const [message, setMessage] = useState("")
  const players = useQuery(invitablePlayersOptions(deferred)).data
  const invite = useInvitePlayer()
  const members = new Set(memberIds)

  function close() {
    onOpenChange(false)
    setQuery("")
    setSelected(null)
    setRole("player")
    setMessage("")
    invite.reset()
  }

  async function send() {
    if (!selected) return
    try {
      await invite.mutateAsync({
        teamId,
        playerId: selected.id,
        role,
        message: message.trim() || undefined,
      })
      toast.success(`Invitación enviada a ${selected.alias}`)
      close()
    } catch {
      // Se muestra en el panel.
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[440px]">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>Invitar jugador</SheetTitle>
          <SheetDescription>
            Busca por alias. Tiene 7 días para aceptarla.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <p className="flex items-center justify-between text-xs text-muted-foreground">
            Roster de {teamName}
            <span className="font-mono font-semibold text-foreground">
              {memberIds.length} / {maxMembers ?? MAX_ROSTER}
            </span>
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-alias" className="text-[13px] font-medium">
              Alias del jugador
            </label>
            <span className="relative">
              <AtSignIcon
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="invite-alias"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelected(null)
                }}
                placeholder="alias"
                autoComplete="off"
                className="h-10 pl-9 font-mono"
              />
            </span>
          </div>
          {deferred.length >= 2 && players && (
            <ul
              aria-label="Jugadores"
              className="overflow-hidden rounded-xl border"
            >
              {players.length === 0 && (
                <li className="px-4 py-5 text-sm text-muted-foreground">
                  No hay jugadores con ese alias.
                </li>
              )}
              {players.map((p) => {
                const blocked = blockedReason(p, members)
                const also = p.teams.find((t) => t.id !== teamId)
                const meta =
                  blocked ?? (also ? `También en ${also.name}` : "Puede entrar")
                return (
                  <li key={p.id} className="border-b last:border-b-0">
                    <button
                      type="button"
                      disabled={!!blocked}
                      aria-pressed={selected?.id === p.id}
                      onClick={() => setSelected(p)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3.5 py-2.5 text-left outline-none hover:bg-muted/60 focus-visible:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60",
                        selected?.id === p.id && "bg-muted"
                      )}
                    >
                      <Initial
                        name={p.alias}
                        photo={p.photo_url}
                        className="size-8"
                        fallbackClassName="text-[13px]"
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">
                          {p.alias}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {meta}
                        </span>
                      </span>
                      {p.level && <LevelBadge level={p.level} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Estado en el roster</span>
            <span
              role="radiogroup"
              aria-label="Estado en el roster"
              className="flex w-fit gap-0.5 rounded-lg border bg-muted p-[3px]"
            >
              {(["player", "sub", "coach"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={s === role}
                  onClick={() => setRole(s)}
                  className={cn(
                    "rounded-[calc(var(--radius)-4px)] px-3 py-1 text-[13px] font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    s === role && "bg-background text-foreground shadow-sm"
                  )}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </span>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            <span>
              Mensaje{" "}
              <span className="font-normal text-muted-foreground">
                opcional
              </span>
            </span>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={MESSAGE_MAX}
              className="font-normal"
            />
          </label>
          {invite.error != null && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(invite.error)}
            </p>
          )}
        </div>
        <SheetFooter className="flex-row justify-end gap-2 border-t px-5 py-3">
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button
            disabled={!selected || invite.isPending}
            onClick={() => void send()}
          >
            <SendIcon aria-hidden />
            Enviar invitación
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
