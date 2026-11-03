import { toast } from "sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  BanIcon,
  CalendarClockIcon,
  ShieldAlertIcon,
  ClockIcon,
  Volume2Icon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { errorMessage } from "@/api/errors"
import { LiveDot } from "@/components/brand/LiveDot"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AcceptDialog } from "./AcceptDialog"
import {
  alertInvite,
  alertFriend,
  alertMatchFound,
  alertServerReady,
  unlockAudio,
  useAudioReady,
} from "./alert"
import { GroupSlots } from "./GroupSlots"
import { InviteDialog } from "./InviteDialog"
import { fmtClock, fmtDateTime, secondsLeft } from "./labels"
import { ANY_REGION, PlayBar } from "./PlayBar"
import { PlayFeed } from "./PlayFeed"
import { SoundSettingsDialog } from "./SoundSettings"
import { MatchRoom } from "./room/MatchRoom"
import { mmStateOptions, useMmAction, useMmSocket } from "./queries"
import { useMmSource } from "./source"
import type { MmInvite, MmLobby, MmState } from "./types"
import { useNow } from "./useNow"

// Jugar (plan docs/bitacora/2026-10-28-matchmaking, sección 7): tu equipo y el panel de partida;
// después, confirmación, veto de capitanes y sala.
// Los datos salen de MmSource (API o demo); el socket solo avisa que hay que volver a pedir.

export function PlayPage() {
  const source = useMmSource()
  const soundUrl = useRef<string | null>(null)
  const socketUp = useMmSocket(source, (e) => {
    if (e.t === "lobby.found") alertMatchFound(soundUrl.current)
    if (e.t === "lobby.server") alertServerReady()
    if (e.t === "friend.searching" && e.friend) {
      const { player_id, nick } = e.friend
      alertFriend(nick)
      toast(`${nick} está buscando partida`, {
        action: {
          label: "Invitar",
          onClick: () =>
            source.invite(player_id).catch((err: unknown) => {
              toast.error(errorMessage(err))
            }),
        },
      })
    }
  })
  const {
    data: state,
    isPending,
    error,
  } = useQuery(mmStateOptions(source, socketUp, useQueryClient()))
  const accept = useMmAction(source, "accept")
  const decline = useMmAction(source, "decline")
  useInviteSound(state?.invites)
  const selectedSound = state?.sounds.url ?? null
  useEffect(() => {
    soundUrl.current = selectedSound
  }, [selectedSound])

  // La sala sigue a la vista después del resultado hasta que el jugador vuelve a Jugar (en la app,
  // además, queda en /match/$id). `kept` la guarda cuando la API ya no la devuelve.
  const [kept, setKept] = useState<MmLobby | null>(null)
  const [closed, setClosed] = useState<string | null>(null)
  const live = state?.lobby ?? null
  if (live?.status === "finished" && live !== kept) setKept(live)
  const candidate = live && live.status !== "accepting" ? live : kept
  const room = candidate && candidate.id !== closed ? candidate : null

  return (
    <section className="flex flex-col gap-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo cargar el matchmaking</AlertTitle>
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      )}
      {isPending && <Skeleton className="h-80 w-full rounded-xl" />}
      {state && (
        <>
          {state.season && <SeasonAlert {...state.season} />}
          {state.ban && (
            <Alert variant="destructive">
              <BanIcon />
              <AlertTitle>Estás excluido del matchmaking</AlertTitle>
              <AlertDescription>
                {state.ban.reason}. Puedes volver a jugar el{" "}
                {fmtDateTime(state.ban.until)}.
              </AlertDescription>
            </Alert>
          )}
          {state.penalty && <PenaltyAlert until={state.penalty.until} />}
          {state.anticheat.required && state.anticheat.status !== "ok" && (
            <Alert variant="destructive">
              <ShieldAlertIcon />
              <AlertTitle>Para jugar necesitas el anticheat activo</AlertTitle>
              <AlertDescription>
                <span>
                  {state.anticheat.status === "stale"
                    ? "Tu agente dejó de responder. Ábrelo de nuevo en esta PC."
                    : "Abre el agente de CM League en tu PC y vincula esta cuenta."}{" "}
                  {/* La ruta está en la rama del anticheat: al mezclar, pasa a <Link>. */}
                  <a
                    href="/anticheat/vincular"
                    className="font-medium underline underline-offset-4"
                  >
                    Vincular el agente
                  </a>
                </span>
              </AlertDescription>
            </Alert>
          )}
          {room ? (
            <MatchRoom
              lobby={room}
              onBack={() => {
                setClosed(room.id)
                setKept(null)
              }}
            />
          ) : (
            <GroupView state={state} socketUp={socketUp} />
          )}
          {state.lobby?.status === "accepting" && (
            <AcceptDialog
              lobby={state.lobby}
              pending={accept.isPending || decline.isPending}
              onAccept={() => accept.mutate()}
              onDecline={() => decline.mutate()}
            />
          )}
          {!state.lobby && state.invites[0] && (
            <InviteDialog key={state.invites[0].id} invite={state.invites[0]} />
          )}
        </>
      )}
    </section>
  )
}

function GroupView({ state, socketUp }: { state: MmState; socketUp: boolean }) {
  const [picked, setPicked] = useState<string | null>(null)
  const [region, setRegion] = useState(ANY_REGION)
  // En cola manda el modo de la cola; si el elegido se apagó, el primero habilitado.
  const mode =
    state.queue?.mode ??
    (state.modes.some((m) => m.mode === picked)
      ? picked!
      : (state.modes[0]?.mode ?? "5v5"))
  const teamSize =
    state.modes.find((m) => m.mode === mode)?.players_per_team ?? 5

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-[-0.4px]">Jugar</h1>
          <p className="max-w-[72ch] text-sm text-pretty text-muted-foreground">
            Entra solo o invita a un amigo. Equipos parejos por ELO, veto de
            capitanes y servidor automático.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/mixes"
            className="inline-flex items-center gap-2 text-[13px] font-medium hover:text-primary"
          >
            <LiveDot />
            Partidas en vivo
            <span className="font-mono text-xs tabular-nums">
              {state.live_matches}
            </span>
          </Link>
          <ConnectionChip up={socketUp} />
          <SoundButton />
          <SoundSettingsDialog sounds={state.sounds} />
        </div>
      </div>
      <Card
        variant="outline"
        className="grid items-stretch overflow-hidden shadow-[0_1px_2px_rgb(0_0_0/.04)] lg:grid-cols-[minmax(0,1fr)_21rem]"
      >
        <section aria-label="Tu equipo" className="flex flex-col gap-3 p-4">
          <h2 className="text-sm font-semibold">
            Tu equipo{" "}
            <span className="font-mono text-xs font-normal text-muted-foreground">
              {mode}
            </span>
          </h2>
          <div className="flex-1">
            <GroupSlots state={state} teamSize={teamSize} />
          </div>
        </section>
        <div className="border-t p-4 lg:border-t-0 lg:border-l">
          <PlayBar
            state={state}
            mode={mode}
            onMode={setPicked}
            region={region}
            onRegion={setRegion}
          />
        </div>
      </Card>
      <PlayFeed state={state} />
    </div>
  )
}

/** Suena una vez por cada invitación nueva, llegue por el socket o por el polling. */
function useInviteSound(invites: MmInvite[] | undefined) {
  const seen = useRef(new Set<string>())
  useEffect(() => {
    for (const inv of invites ?? []) {
      if (seen.current.has(inv.id)) continue
      seen.current.add(inv.id)
      alertInvite(inv.from.nick)
    }
  }, [invites])
}

/** "Activar sonido" mientras el navegador no deja sonar (plan, decisión "Sonido bloqueado"). */
function SoundButton() {
  const ready = useAudioReady()
  if (ready) return null
  return (
    <Button variant="outline" size="sm" onClick={unlockAudio}>
      <Volume2Icon aria-hidden />
      Activar sonido
    </Button>
  )
}

function SeasonAlert({
  ends_at,
  queue_closes_at,
}: {
  ends_at: string
  queue_closes_at: string
}) {
  const now = useNow(true)
  const closed = Date.parse(queue_closes_at) <= now
  return (
    <Alert>
      <CalendarClockIcon />
      <AlertTitle>
        La temporada cierra en {fmtClock(secondsLeft(ends_at, now) * 1000)}
      </AlertTitle>
      <AlertDescription>
        {closed
          ? "La cola ya cerró. Vuelve a abrir con la temporada nueva."
          : `La cola cierra en ${fmtClock(secondsLeft(queue_closes_at, now) * 1000)} y vuelve a abrir con la temporada nueva. Las partidas ya armadas siguen.`}
      </AlertDescription>
    </Alert>
  )
}

function ConnectionChip({ up }: { up: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      title={
        up
          ? "Los cambios llegan al instante"
          : "Sin conexión en tiempo real: se actualiza cada 5 segundos"
      }
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          up ? "bg-win" : "bg-sidebar-primary"
        )}
      />
      {up ? "En tiempo real" : "Actualizando cada 5 s"}
    </span>
  )
}

function PenaltyAlert({ until }: { until: string }) {
  const now = useNow(true)
  return (
    <Alert>
      <ClockIcon />
      <AlertTitle>No puedes entrar a la cola por ahora</AlertTitle>
      <AlertDescription>
        No aceptaste o no entraste a una partida. Puedes volver en{" "}
        <span className="font-mono tabular-nums">
          {fmtClock(secondsLeft(until, now) * 1000)}
        </span>
        .
      </AlertDescription>
    </Alert>
  )
}
