import { useQuery } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { PasswordField } from "@/features/matchmaking/PasswordField"
import { useNow } from "@/features/matchmaking/useNow"
import {
  bookingOptions,
  freeServersOptions,
  useBookingAction,
  useSetReady,
  useStartMatch,
  useVeto,
} from "../api/booking"
import {
  clock,
  endedText,
  extendRoom,
  isOpen,
  secondsLeft,
  statusLine,
} from "../lib/booking"
import type { SeriesDetail } from "../lib/series"
import type { Booking, MatchBooking } from "../types/booking"

// Servidor de una partida de torneo o PCW (bitácora 2026-11-02-iniciar-torneo-pcw): iniciar (torneo),
// listos y fila (PCW), veto con reloj, conexión para los planteles y acciones del organizador.

const fail = (e: unknown) => toast.error(errorMessage(e))

export function ServerPanel({
  d,
  names,
}: {
  d: SeriesDetail
  names: [string, string]
}) {
  const q = useQuery(bookingOptions(d.id))
  const mb = q.data
  const b = mb?.booking ?? null
  const open = isOpen(b)
  const now = useNow(open)
  if (!mb) return null

  const ended = !open && b ? endedText(b, names) : null
  const vetoPending = !mb.veto_done && d.status === "upcoming" && !!d.veto?.next
  const show =
    open ||
    !!ended ||
    mb.can_start ||
    mb.can_ready ||
    !!mb.ban_until ||
    (vetoPending && mb.can_veto)
  if (!show) return null

  return (
    <>
      <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
        Servidor
      </h2>
      <Card
        variant="outline"
        className="flex flex-col gap-3 px-4 py-3 text-[13px]"
      >
        {mb.ban_until && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
            Por abandonar una PCW, tu equipo no puede crear ni aceptar PCW hasta
            el{" "}
            {format(parseISO(mb.ban_until), "EEEE d 'de' MMMM, HH:mm", {
              locale: es,
            })}
            .
          </p>
        )}
        {open && <p className="font-medium">{statusLine(mb, names)}</p>}
        {ended && <p className="text-muted-foreground">{ended}</p>}

        {(b?.status === "veto" || (!open && vetoPending && mb.can_veto)) && (
          <VetoTurn d={d} mb={mb} b={open ? b : null} now={now} names={names} />
        )}
        {open && ["assigned", "between", "live", "lost"].includes(b.status) && (
          <Connection mb={mb} b={b} now={now} names={names} />
        )}
        {open && mb.can_manage && mb.kind === "official" && (
          <OrganizerActions matchId={d.id} b={b} now={now} names={names} />
        )}
        {mb.can_start && <StartMatch matchId={d.id} />}
        {mb.kind === "pcw" && mb.my_side > 0 && (
          <PcwReady matchId={d.id} mb={mb} />
        )}
      </Card>
    </>
  )
}

function VetoTurn({
  d,
  mb,
  b,
  now,
  names,
}: {
  d: SeriesDetail
  mb: MatchBooking
  b: Booking | null
  now: number
  names: [string, string]
}) {
  const id = useId()
  const veto = useVeto(d.id)
  const [version, setVersion] = useState<Record<string, string>>({})
  const next = d.veto?.next
  if (!next || !d.veto) return null
  const turn = next.team_id === d.side1.team?.id ? names[0] : names[1]
  const left = b?.veto_deadline ? secondsLeft(b.veto_deadline, now) : null
  const taken = new Set(d.veto.actions.map((a) => a.map))
  const pool = d.veto.pool.filter((m) => !taken.has(m.name))
  const verb = next.action === "pick" ? "elegir" : "banear"

  return (
    <div className="flex flex-col gap-2">
      <p>
        Veto: le toca a <span className="font-semibold">{turn}</span> {verb} un
        mapa
        {left !== null && (
          <>
            {" "}
            · quedan{" "}
            <span className="font-mono tabular-nums">{clock(left)}</span>
          </>
        )}
        .
      </p>
      {left !== null && (
        <p className="text-xs text-muted-foreground">
          Si el turno vence, se elige un mapa al azar ({mb.veto_turn_seconds} s
          por turno).
        </p>
      )}
      {mb.can_veto && (
        <div className="flex flex-wrap gap-1.5" aria-labelledby={id}>
          <span id={id} className="sr-only">
            Mapas para {verb}
          </span>
          {pool.map((m) => (
            <span key={m.name} className="inline-flex items-center gap-1">
              {next.action === "pick" && m.versions.length > 1 && (
                <Select
                  value={version[m.name] ?? m.versions[0]}
                  onValueChange={(v) =>
                    setVersion((s) => ({ ...s, [m.name]: v }))
                  }
                >
                  <SelectTrigger size="sm" aria-label={`Versión de ${m.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {m.versions.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                size="sm"
                variant={next.action === "pick" ? "default" : "outline"}
                disabled={veto.isPending}
                onClick={() =>
                  veto.mutate(
                    {
                      map: m.name,
                      version:
                        next.action === "pick" && m.versions.length > 1
                          ? (version[m.name] ?? m.versions[0])
                          : undefined,
                    },
                    { onError: fail }
                  )
                }
              >
                {next.action === "pick" ? "Elegir" : "Banear"} {m.name}
              </Button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Connection({
  mb,
  b,
  now,
  names,
}: {
  mb: MatchBooking
  b: Booking
  now: number
  names: [string, string]
}) {
  const left = secondsLeft(b.wait_deadline, now)
  const waiting =
    (b.status === "assigned" || b.status === "between") && !!b.wait_deadline
  const side = (k: 1 | 2) => {
    const n = k === 1 ? b.side_n1 : b.side_n2
    const ok = k === 1 ? b.side_ok1 : b.side_ok2
    if (n === null) return null
    return (
      <Badge key={k} variant={ok ? "win" : "warn"} shape="soft" size="sm">
        {names[k - 1]}: {n} en su lado
      </Badge>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">Servidor</dt>
        <dd className="text-right">{b.server?.name ?? "—"}</dd>
        {b.map && (
          <>
            <dt className="text-muted-foreground">Mapa {b.map_no}</dt>
            <dd className="text-right font-mono">{b.map}</dd>
          </>
        )}
        {b.connection && (
          <>
            <dt className="text-muted-foreground">Dirección</dt>
            <dd className="text-right font-mono">{b.connection.address}</dd>
            <dt className="text-muted-foreground">Contraseña</dt>
            <dd className="text-right">
              <PasswordField value={b.connection.password} />
            </dd>
          </>
        )}
      </dl>
      {b.connection && (
        <a href={b.connection.url} className={buttonVariants({ size: "sm" })}>
          Conectarse
        </a>
      )}
      {b.connection && mb.kind === "pcw" && (
        <p className="text-xs text-muted-foreground">
          Si juega un stand-in, pásale tú la contraseña: solo la ven los
          planteles.
        </p>
      )}
      {waiting && (
        <p>
          {left > 0 ? (
            <>
              Espera a los equipos:{" "}
              <span className="font-mono tabular-nums">{clock(left)}</span>.{" "}
              {mb.kind === "pcw"
                ? "Si un equipo no está completo cuando termine, la PCW se da por abandonada."
                : ""}
            </>
          ) : mb.kind === "official" ? (
            "Se terminó la espera: decide el organizador."
          ) : (
            "Se terminó la espera."
          )}
        </p>
      )}
      {(b.side_n1 !== null || b.side_n2 !== null) && (
        <div className="flex flex-wrap gap-1.5">
          {side(1)}
          {side(2)}
        </div>
      )}
    </div>
  )
}

function OrganizerActions({
  matchId,
  b,
  now,
  names,
}: {
  matchId: string
  b: Booking
  now: number
  names: [string, string]
}) {
  const act = useBookingAction(matchId)
  const [confirm, setConfirm] = useState<"cancel" | "release" | null>(null)
  const waiting = b.status === "assigned" || b.status === "between"
  const room = extendRoom(b, now)
  const run = (a: Parameters<typeof act.mutate>[0], ok: string) =>
    act.mutate(a, { onSuccess: () => toast.success(ok), onError: fail })

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <span className="text-xs font-medium text-muted-foreground">
        Organizador
      </span>
      <div className="flex flex-wrap gap-1.5">
        {waiting &&
          ([1, 2] as const).map((k) =>
            (k === 1 ? b.min_roster1 : b.min_roster2) === 4 ? null : (
              <Button
                key={k}
                size="sm"
                variant="outline"
                disabled={act.isPending}
                onClick={() =>
                  run(
                    { action: "allow_four", side: k },
                    `${names[k - 1]} puede empezar con 4.`
                  )
                }
              >
                {names[k - 1]} con 4
              </Button>
            )
          )}
        {waiting && room >= 1 && (
          <Button
            size="sm"
            variant="outline"
            disabled={act.isPending}
            onClick={() =>
              run(
                { action: "extend", minutes: Math.min(5, room) },
                "Espera extendida."
              )
            }
          >
            Esperar {Math.min(5, room)} min más
          </Button>
        )}
        {b.status === "live" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirm("release")}
          >
            Liberar el servidor
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirm("cancel")}
          >
            Cancelar el inicio
          </Button>
        )}
      </div>
      {waiting && b.wait_expired && (
        <p className="text-xs text-muted-foreground">
          Para dar W.O., carga el resultado de la partida en Administración ›
          Torneos: la reserva se cierra sola.
        </p>
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm === "release"
            ? "¿Liberar el servidor?"
            : "¿Cancelar el inicio?"
        }
        description={
          confirm === "release"
            ? "Hay un mapa en juego: el servidor lo corta. Solo moderadores y admins."
            : "El servidor queda libre y la partida vuelve a estar por iniciar, con el marcador como está."
        }
        confirmLabel={confirm === "release" ? "Liberar" : "Cancelar el inicio"}
        danger
        pending={act.isPending}
        error={act.error}
        onConfirm={() =>
          act.mutate(
            { action: confirm === "release" ? "release" : "cancel" },
            { onSuccess: () => setConfirm(null) }
          )
        }
      />
    </div>
  )
}

const WAITS = [5, 10, 15, 20]

function StartMatch({ matchId }: { matchId: string }) {
  const [open, setOpen] = useState(false)
  const [server, setServer] = useState("")
  const [wait, setWait] = useState("10")
  const start = useStartMatch(matchId)
  const free = useQuery({ ...freeServersOptions("official"), enabled: open })
  const items = free.data?.items ?? []

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Iniciar la partida
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setServer("")
        }}
        title="Iniciar la partida"
        description="El servidor queda reservado en el acto para toda la serie. Si falta el veto, arranca con su reloj."
        confirmLabel="Iniciar"
        pending={start.isPending}
        error={start.error}
        incomplete={!server}
        onConfirm={() =>
          start.mutate(
            { server_id: server, wait_minutes: Number(wait) },
            { onSuccess: () => setOpen(false) }
          )
        }
      >
        <div className="flex flex-col gap-3 text-[13px]">
          <div className="flex flex-col gap-1.5">
            <Label>Servidor libre</Label>
            {free.isPending ? (
              <Spinner />
            ) : items.length === 0 ? (
              <p className="text-muted-foreground">
                No hay servidores libres y aptos para torneos. Espera a que se
                libere uno.
              </p>
            ) : (
              <RadioGroup value={server} onValueChange={setServer}>
                {items.map((s) => (
                  <Label
                    key={s.id}
                    className="flex items-center gap-2 font-normal"
                  >
                    <RadioGroupItem value={s.id} />
                    {s.name}
                    {s.region && (
                      <span className="text-muted-foreground">
                        · {s.region}
                      </span>
                    )}
                  </Label>
                ))}
              </RadioGroup>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Espera a los equipos en cada mapa</Label>
            <Select value={wait} onValueChange={setWait}>
              <SelectTrigger aria-label="Minutos de espera">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WAITS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} minutos
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </ConfirmDialog>
    </>
  )
}

function PcwReady({ matchId, mb }: { matchId: string; mb: MatchBooking }) {
  const ready = useSetReady(matchId)
  const b = mb.booking
  const open = isOpen(b)
  const mine = open && (mb.my_side === 1 ? b.ready1 : b.ready2)
  const canUnready =
    open && ["ready", "veto", "queued"].includes(b.status) && mine !== false
  if (!mb.can_ready && !canUnready) return null
  return (
    <div className="flex flex-col gap-2">
      {mb.can_ready && !mine && (
        <>
          <p className="text-xs text-muted-foreground">
            Cuando los dos equipos estén listos, se hace el veto (30 s por
            turno) y la PCW entra a la fila de servidores. Con servidor tienen
            15 minutos para entrar (5 entre mapas): si un equipo no está, la PCW
            se da por abandonada y ese equipo no puede jugar PCW por 3 días.
          </p>
          <Button
            size="sm"
            disabled={ready.isPending}
            onClick={() => ready.mutate(true, { onError: fail })}
          >
            Estamos listos
          </Button>
        </>
      )}
      {canUnready && (
        <Button
          size="sm"
          variant="outline"
          disabled={ready.isPending}
          onClick={() => ready.mutate(false, { onError: fail })}
        >
          Ya no estamos listos
        </Button>
      )}
    </div>
  )
}
