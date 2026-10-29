import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  BanIcon,
  CalendarClockIcon,
  ClockIcon,
  Volume2Icon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { errorMessage } from "@/api/errors"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AcceptDialog } from "./AcceptDialog"
import {
  alertInvite,
  alertMatchFound,
  unlockAudio,
  useAudioReady,
} from "./alert"
import { EloMeter } from "./EloMeter"
import { GroupSlots } from "./GroupSlots"
import { InviteDialog } from "./InviteDialog"
import { fmtClock, fmtDateTime, secondsLeft } from "./labels"
import { ANY_REGION, PlayBar } from "./PlayBar"
import { MatchRoom } from "./room/MatchRoom"
import { mmStateOptions, useMmAction, useMmSocket } from "./queries"
import { useMmSource } from "./source"
import type { MmInvite, MmLobby, MmState } from "./types"
import { useNow } from "./useNow"

// Jugar (plan docs/bitacora/2026-10-28-matchmaking, sección 7): "Mi grupo" con el diseño de la
// captura de Daniel; después, confirmación, veto de capitanes y sala.
// Los datos salen de MmSource (API o demo); el socket solo avisa que hay que volver a pedir.

export function PlayPage() {
  const source = useMmSource()
  const socketUp = useMmSocket(source, (e) => {
    if (e.t === "lobby.found") alertMatchFound()
  })
  const {
    data: state,
    isPending,
    error,
  } = useQuery(mmStateOptions(source, socketUp))
  const accept = useMmAction(source, "accept")
  const decline = useMmAction(source, "decline")
  useInviteSound(state?.invites)

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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <nav aria-label="Jugar" className="flex items-center gap-1">
          <span
            aria-current="page"
            className="rounded-lg border bg-muted/60 px-3 py-1.5 text-sm font-semibold"
          >
            Mi grupo
          </span>
          <Link
            to="/mixes"
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Partidas en vivo
            {state && (
              <span className="ml-2 font-mono text-xs tabular-nums">
                {state.live_matches}
              </span>
            )}
          </Link>
        </nav>
        <div className="flex items-start gap-4">
          <SoundButton />
          <ConnectionChip up={socketUp} />
          {state && <EloMeter elo={state.me.elo} level={state.me.level} />}
        </div>
      </header>

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
                {state.ban.reason}. Podés volver a jugar el{" "}
                {fmtDateTime(state.ban.until)}.
              </AlertDescription>
            </Alert>
          )}
          {state.penalty && <PenaltyAlert until={state.penalty.until} />}
          {room ? (
            <MatchRoom
              lobby={room}
              onBack={() => {
                setClosed(room.id)
                setKept(null)
              }}
            />
          ) : (
            <GroupView state={state} />
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

function GroupView({ state }: { state: MmState }) {
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
    <div className="flex flex-col gap-6 rounded-2xl border bg-card/40 p-5">
      <GroupSlots state={state} teamSize={teamSize} />
      <PlayBar
        state={state}
        mode={mode}
        onMode={setPicked}
        region={region}
        onRegion={setRegion}
      />
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
      className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground"
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
      <AlertTitle>No podés entrar a la cola por ahora</AlertTitle>
      <AlertDescription>
        No aceptaste o no entraste a una partida. Podés volver en{" "}
        <span className="font-mono tabular-nums">
          {fmtClock(secondsLeft(until, now) * 1000)}
        </span>
        .
      </AlertDescription>
    </Alert>
  )
}
