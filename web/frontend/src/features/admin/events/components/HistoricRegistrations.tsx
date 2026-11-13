import { useQuery } from "@tanstack/react-query"
import { PlusIcon, TriangleAlertIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { ErrorAlert } from "@/components/brand/ErrorAlert"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
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
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { eventRegistrationsOptions } from "@/features/events/api/queries"
import type { EventDetail, Registration } from "@/features/events/types"
import {
  teamSearchOptions,
  useRemoveLogo,
  useUploadLogo,
} from "@/features/teams/api/queries"
import { useLogoPicker } from "@/features/teams/components/TeamLogo"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { EmptyState, QueryError, TableBox } from "../../components/ui"
import { pickPlayerOptions } from "../../players/api/queries"
import {
  similarTeamsOptions,
  useCreateHistoricTeam,
  useRegisterTeam,
  useRemoveRegistration,
  useUpdateHistoricTeam,
} from "../api/queries"

/** Fichas que se pueden cargar por equipo en un histórico. */
const MAX_PLAYERS = 10

type Team = Registration["team"]
/** id null: jugador sin ficha, solo el nombre (replanteo 113). */
type Picked = { id: string | null; alias: string }

const GUEST_MIN = 2
const GUEST_MAX = 24

/** Clave de la lista: la ficha o, sin ficha, el nombre. */
const keyOf = (p: Picked) => p.id ?? `sin-ficha:${p.alias.toLowerCase()}`

/**
 * Inscripciones de un torneo histórico (replanteo 80): equipos de la plataforma o históricos
 * (solo nombre, sigla y logo) y de 0 a 10 jugadores opcionales por equipo, sin plantel ni SteamID: fichas o,
 * para quien no está en la plataforma, solo el nombre (replanteo 113).
 */
export function HistoricRegistrations({ event }: { event: EventDetail }) {
  const regs = useQuery(eventRegistrationsOptions(event.id))
  const remove = useRemoveRegistration(event.id)
  const [dialog, setDialog] = useState<
    | { kind: "platform" }
    | { kind: "historic" }
    | { kind: "players"; reg: Registration }
    | { kind: "edit"; team: Team }
    | null
  >(null)
  const [target, setTarget] = useState<Registration | null>(null)
  const open = event.status === "registration"
  // Los jugadores de un equipo ya inscrito se cambian también con el fixture generado o el torneo terminado.
  const playersOpen = event.status !== "cancelled"

  if (regs.isError)
    return <QueryError error={regs.error} onRetry={() => void regs.refetch()} />
  if (!regs.data) return <Skeleton className="h-80 rounded-xl" />
  const registered = new Set(regs.data.map((r) => r.team.id))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {regs.data.length} equipos. Torneo histórico: inscribe equipos de la
          plataforma o carga los que no están; los jugadores son opcionales
          (hasta {MAX_PLAYERS} por equipo).
        </p>
        {open && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setDialog({ kind: "platform" })}>
              Inscribir equipo de la plataforma
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialog({ kind: "historic" })}
            >
              Equipo que no está en la plataforma
            </Button>
          </div>
        )}
      </div>
      {regs.data.length === 0 ? (
        <EmptyState>Todavía no hay equipos inscritos.</EmptyState>
      ) : (
        <TableBox>
          <div className="overflow-x-auto overflow-y-hidden">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Siembra</th>
                  <th className="px-3 py-2 font-medium">Equipo</th>
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
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        <TeamCrest team={r.team} size="xs" />
                        {r.team.name}
                        {r.team.historic && (
                          <Badge variant="muted" size="sm">
                            No está en la plataforma
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.players.length + r.guests.length
                        ? [
                            ...r.players.map((p) => p.alias),
                            ...r.guests.map((g) => `${g} (sin ficha)`),
                          ].join(", ")
                        : "Sin jugadores cargados"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!playersOpen}
                          onClick={() => setDialog({ kind: "players", reg: r })}
                        >
                          Jugadores
                        </Button>
                        {r.team.historic && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDialog({ kind: "edit", team: r.team })
                            }
                          >
                            Editar
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!open}
                          onClick={() => setTarget(r)}
                        >
                          Quitar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableBox>
      )}

      {dialog?.kind === "platform" && (
        <PlatformTeamDialog
          event={event}
          registered={registered}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "historic" && (
        <HistoricTeamDialog
          event={event}
          registered={registered}
          onClose={() => setDialog(null)}
          onCreated={(team) =>
            setDialog({
              kind: "players",
              reg: { team, seed: 0, start_stage: 1, players: [], guests: [] },
            })
          }
        />
      )}
      {dialog?.kind === "players" && (
        <PlayersDialog
          event={event}
          reg={dialog.reg}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "edit" && (
        <EditHistoricTeamDialog
          event={event}
          team={dialog.team}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`¿Quitar a ${target?.team.name ?? ""} del torneo?`}
        description={
          target?.team.historic
            ? "Sale del torneo con sus jugadores. El equipo histórico queda cargado y se puede volver a inscribir."
            : "Sale del torneo con sus jugadores."
        }
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

/** Un equipo oficial de la plataforma, sin exigirle plantel ni activos. */
function PlatformTeamDialog({
  event,
  registered,
  onClose,
}: {
  event: EventDetail
  registered: Set<string>
  onClose: () => void
}) {
  const [q, setQ] = useState("")
  const debounced = useDebouncedValue(q.trim(), 250)
  const teams = useQuery({
    ...teamSearchOptions(debounced),
    enabled: debounced.length > 0,
  })
  const register = useRegisterTeam(event.id)
  const list = (teams.data ?? []).filter((t) => !registered.has(t.id))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Inscribir equipo de la plataforma</DialogTitle>
          <DialogDescription>
            Cualquier equipo oficial. El torneo entra en su historial. Los
            jugadores los sumas después, si quieres.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Nombre o sigla del equipo"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {debounced.length > 0 && teams.data && list.length === 0 && (
            <li className="text-sm text-muted-foreground">
              No hay equipos con ese nombre.
            </li>
          )}
          {list.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                disabled={register.isPending}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                onClick={() =>
                  register.mutate(
                    { teamId: t.id, players: [] },
                    {
                      onSuccess: () => {
                        toast.success(`${t.name} inscrito.`)
                        onClose()
                      },
                    }
                  )
                }
              >
                <TeamCrest team={t} size="xs" />
                <span className="font-medium">{t.name}</span>
                {t.tag && (
                  <span className="text-xs text-muted-foreground">{t.tag}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        {register.error && (
          <ErrorAlert message={errorMessage(register.error)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Cargar un equipo que no está en la plataforma. Antes avisa de los equipos con nombre parecido
 * (de la plataforma o históricos ya cargados), que se pueden inscribir en vez de duplicarlos.
 */
function HistoricTeamDialog({
  event,
  registered,
  onClose,
  onCreated,
}: {
  event: EventDetail
  registered: Set<string>
  onClose: () => void
  onCreated: (team: Team) => void
}) {
  const [name, setName] = useState("")
  const [tag, setTag] = useState("")
  const debounced = useDebouncedValue(name.trim(), 300)
  const similar = useQuery(similarTeamsOptions(event.id, debounced))
  const create = useCreateHistoricTeam(event.id)
  const register = useRegisterTeam(event.id)
  const matches = debounced.length >= 2 ? (similar.data?.items ?? []) : []
  const ready = name.trim().length >= 2 && tag.trim().length >= 1

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Equipo que no está en la plataforma</DialogTitle>
          <DialogDescription>
            Queda como equipo histórico: solo nombre, sigla y logo, sin capitán,
            plantel ni página. Se puede reusar en otro histórico.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ht-name">Nombre</Label>
            <Input
              id="ht-name"
              autoFocus
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ht-tag">Sigla</Label>
            <Input
              id="ht-tag"
              maxLength={8}
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            />
          </div>
        </div>
        {matches.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <TriangleAlertIcon className="size-4 text-amber-600" />
              Ya hay equipos con un nombre parecido. ¿Es alguno de estos?
            </p>
            <ul className="flex flex-col gap-1">
              {matches.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <TeamCrest team={t} size="xs" />
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.kind === "historic" ? "histórico" : "de la plataforma"}
                  </span>
                  <span className="ml-auto">
                    {registered.has(t.id) ? (
                      <span className="text-xs text-muted-foreground">
                        Ya inscrito
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={register.isPending}
                        onClick={() =>
                          register.mutate(
                            { teamId: t.id, players: [] },
                            {
                              onSuccess: () => {
                                toast.success(`${t.name} inscrito.`)
                                onClose()
                              },
                            }
                          )
                        }
                      >
                        Inscribir este
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(create.error ?? register.error) != null && (
          <ErrorAlert message={errorMessage(create.error ?? register.error)} />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!ready || create.isPending}
            onClick={() => {
              const body = { name: name.trim(), tag: tag.trim() }
              create.mutate(body, {
                onSuccess: ({ id }) => {
                  toast.success(`${body.name} cargado e inscrito.`)
                  onCreated({ id, ...body, logo_url: null, historic: true })
                },
              })
            }}
          >
            {matches.length ? "Es otro: cargarlo igual" : "Cargar e inscribir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Jugadores opcionales (0 a 10, estén o no en el plantel): las fichas ven el torneo en su perfil. Quien no está en la
 * plataforma se carga solo con el nombre, que queda en esta inscripción y no en el equipo (replanteo 113).
 */
function PlayersDialog({
  event,
  reg,
  onClose,
}: {
  event: EventDetail
  reg: Registration
  onClose: () => void
}) {
  const [picked, setPicked] = useState<Picked[]>([
    ...reg.players.map((p) => ({ id: p.player_id, alias: p.alias })),
    ...reg.guests.map((g) => ({ id: null, alias: g })),
  ])
  const [q, setQ] = useState("")
  const debounced = useDebouncedValue(q.trim(), 250)
  const players = useQuery(pickPlayerOptions(debounced))
  const register = useRegisterTeam(event.id)
  const keys = new Set(picked.map(keyOf))
  const full = picked.length >= MAX_PLAYERS
  // El nombre sin ficha, con los espacios limpios como lo guarda la base.
  const guest = q.trim().replace(/\s+/g, " ")
  // Sin ficha solo con la búsqueda de este texto ya resuelta, y si no hay una ficha con ese alias exacto:
  // así no se carga como texto a alguien que está en la plataforma.
  const searched =
    debounced === q.trim() && players.isSuccess && !players.isPlaceholderData
  const exact = searched
    ? players.data.items.find(
        (p) => p.alias.toLowerCase() === guest.toLowerCase()
      )
    : undefined
  const canAddGuest =
    searched &&
    !exact &&
    guest.length >= GUEST_MIN &&
    guest.length <= GUEST_MAX &&
    !keys.has(keyOf({ id: null, alias: guest }))
  const pick = (p: Picked) => {
    if (full || keys.has(keyOf(p))) return
    setPicked((all) => [...all, p])
    setQ("")
  }
  const addGuest = () => canAddGuest && pick({ id: null, alias: guest })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Jugadores de {reg.team.name}</DialogTitle>
          <DialogDescription>
            Opcionales, hasta {MAX_PLAYERS}. Los que tienen ficha ven el torneo
            (y el título, si salen campeones) en su perfil. Si alguien no está
            en la plataforma, cárgalo solo con el nombre: queda en este torneo,
            no en el equipo. Un jugador, un solo equipo por torneo.
          </DialogDescription>
        </DialogHeader>
        {picked.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {picked.map((p) => (
              <li key={keyOf(p)}>
                <Badge variant="muted" className="gap-1 pr-1">
                  {p.alias}
                  {p.id === null && (
                    <span className="font-normal text-muted-foreground">
                      · sin ficha
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Quitar a ${p.alias}`}
                    className="rounded-full p-0.5 hover:bg-foreground/10"
                    onClick={() =>
                      setPicked((all) =>
                        all.filter((x) => keyOf(x) !== keyOf(p))
                      )
                    }
                  >
                    <XIcon className="size-3" />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sin jugadores cargados.
          </p>
        )}
        <Input
          placeholder={full ? "Ya cargaste 10" : "Buscar jugador por alias"}
          aria-label="Buscar jugador por alias"
          disabled={full}
          maxLength={60}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return
            e.preventDefault()
            // Enter: la ficha con ese alias exacto o, si no hay, el nombre sin ficha.
            if (exact) pick({ id: exact.id, alias: exact.alias })
            else addGuest()
          }}
        />
        {!full && debounced.length > 0 && (
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {players.data?.items.length === 0 && (
              <li className="text-sm text-muted-foreground">
                No hay jugadores con ese alias.
              </li>
            )}
            {players.data?.items
              .filter((p) => !keys.has(p.id))
              .map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => pick({ id: p.id, alias: p.alias })}
                  >
                    <PlayerAvatar
                      alias={p.alias}
                      photo={p.photo_url}
                      size="row"
                    />
                    {p.alias}
                  </button>
                </li>
              ))}
            {canAddGuest && (
              <li>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={addGuest}
                >
                  <PlusIcon className="size-4 text-muted-foreground" />
                  <span>
                    Agregar «<span className="font-medium">{guest}</span>» sin
                    ficha
                  </span>
                </button>
              </li>
            )}
            {guest.length > GUEST_MAX && (
              <li className="text-xs text-muted-foreground">
                Sin ficha, el nombre tiene hasta {GUEST_MAX} caracteres.
              </li>
            )}
          </ul>
        )}
        {register.error && (
          <ErrorAlert message={errorMessage(register.error)} />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={register.isPending}
            onClick={() =>
              register.mutate(
                {
                  teamId: reg.team.id,
                  players: picked.flatMap((p) => (p.id ? [p.id] : [])),
                  guests: picked.flatMap((p) => (p.id ? [] : [p.alias])),
                },
                {
                  onSuccess: () => {
                    toast.success("Jugadores guardados.")
                    onClose()
                  },
                }
              )
            }
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Corregir nombre, sigla y logo de un equipo histórico. */
function EditHistoricTeamDialog({
  event,
  team,
  onClose,
}: {
  event: EventDetail
  team: Team
  onClose: () => void
}) {
  const [name, setName] = useState(team.name)
  const [tag, setTag] = useState(team.tag ?? "")
  const [logo, setLogo] = useState(team.logo_url ?? null)
  const update = useUpdateHistoricTeam(event.id)
  const upload = useUploadLogo()
  const removeLogo = useRemoveLogo()
  const regs = useQuery(eventRegistrationsOptions(event.id))
  const picker = useLogoPicker(async (blob) => {
    await upload.mutateAsync({ teamId: team.id, blob })
    toast.success("Logo guardado.")
    void regs
      .refetch()
      .then((r) =>
        setLogo(
          r.data?.find((x) => x.team.id === team.id)?.team.logo_url ?? null
        )
      )
  }, upload.isPending)
  const ready = name.trim().length >= 2 && tag.trim().length >= 1
  const error = update.error ?? upload.error ?? removeLogo.error

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Editar equipo histórico</DialogTitle>
          <DialogDescription>
            El cambio se ve en todos los torneos históricos donde está.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3">
          <TeamCrest team={{ ...team, name, logo_url: logo }} size="md" />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={upload.isPending}
              onClick={picker.open}
            >
              {logo ? "Cambiar logo" : "Subir logo"}
            </Button>
            {logo && (
              <Button
                size="sm"
                variant="ghost"
                disabled={removeLogo.isPending}
                onClick={() =>
                  removeLogo.mutate(team.id, {
                    onSuccess: () => {
                      setLogo(null)
                      void regs.refetch()
                      toast.success("Logo quitado.")
                    },
                  })
                }
              >
                Quitar logo
              </Button>
            )}
          </div>
          {picker.elements}
        </div>
        {picker.error && <ErrorAlert message={picker.error} />}
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eht-name">Nombre</Label>
            <Input
              id="eht-name"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eht-tag">Sigla</Label>
            <Input
              id="eht-tag"
              maxLength={8}
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            />
          </div>
        </div>
        {error && <ErrorAlert message={errorMessage(error)} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            disabled={!ready || update.isPending}
            onClick={() =>
              update.mutate(
                { teamId: team.id, name: name.trim(), tag: tag.trim() },
                {
                  onSuccess: () => {
                    toast.success("Equipo guardado.")
                    onClose()
                  },
                }
              )
            }
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
