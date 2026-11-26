import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { cn } from "cn"
import { LoaderCircleIcon, SwordsIcon, XIcon } from "lucide-react"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  inLauncher,
  launcherStatus,
  registerLauncherHandlers,
  type LauncherStatus,
} from "@/lib/launcher"
import { AcceptDialog } from "./AcceptDialog"
import { alertMatchFound, alertServerReady } from "./alert"
import { fmtClock } from "./labels"
import { noticePartyDisbanded } from "./PartyMenu"
import { mmStateOptions, useMmAction, useMmSocket } from "./queries"
import { useMmSource } from "./source"
import type { MmLobby } from "./types"
import { useNow } from "./useNow"

// La cola fuera de Jugar (Kyan, 2026-11-08): la partida encontrada salta en cualquier pantalla, y mientras se busca
// la barra de arriba lo muestra. En Jugar no hacen nada: ahí ya están la ventana y el estado de la cola.

/** ¿Está en Jugar? `away` lo fuerza (la demo simula otra pantalla). */
function useOnPlay(away?: boolean) {
  const path = useRouterState({ select: (s) => s.location.pathname })
  return away === undefined ? path.startsWith("/play") : !away
}

/**
 * Va en el layout `_app`: la ventana para aceptar la partida, su sonido, el aviso del servidor listo y el título de
 * la pestaña ("Buscando…" y "¡Partida encontrada!"), en cualquier pantalla que no sea Jugar.
 */
export function GlobalMatchAlerts({ away }: { away?: boolean } = {}) {
  const source = useMmSource()
  const onPlay = useOnPlay(away)
  const navigate = useNavigate()
  const soundUrl = useRef<string | null>(null)
  const onPlayRef = useRef(onPlay)
  useEffect(() => {
    onPlayRef.current = onPlay
  }, [onPlay])

  const toPlay = () => {
    if (away === undefined) void navigate({ to: "/play" })
  }
  const socketUp = useMmSocket(source, (e) => {
    // En Jugar suenan y avisan los de la página.
    if (onPlayRef.current) return
    if (e.t === "lobby.found") alertMatchFound(soundUrl.current)
    if (e.t === "lobby.server") {
      alertServerReady()
      toast.success("El servidor está listo", {
        description: "Entra desde la sala de la partida.",
        action: { label: "Ir a la sala", onClick: toPlay },
      })
    }
    if (e.t === "lobby.cancelled") toast.warning("La partida se canceló")
    if (e.t === "party.disbanded") noticePartyDisbanded(e.d)
  })
  const { data: state } = useQuery(
    mmStateOptions(source, socketUp, useQueryClient())
  )
  const accept = useMmAction(source, "accept")
  const decline = useMmAction(source, "decline")
  const selected = state?.sounds.url ?? null
  useEffect(() => {
    soundUrl.current = selected
  }, [selected])

  const lobby = state?.lobby ?? null
  const accepting = lobby?.status === "accepting"
  const searching = !!state?.queue && !lobby

  // Launcher de escritorio: el estado para la bandeja y Discord, y "Aceptar partida" desde la bandeja.
  const status = launcherStatusOf(state)
  const statusKey = JSON.stringify(status)
  useEffect(() => {
    if (inLauncher()) launcherStatus(JSON.parse(statusKey) as LauncherStatus)
  }, [statusKey])
  const acceptRef = useRef(() => {})
  useEffect(() => {
    acceptRef.current = () =>
      accept.mutate(undefined, {
        onSuccess: toPlay,
        onError: (e) => toast.error(errorMessage(e)),
      })
  })
  useEffect(
    () => registerLauncherHandlers({ accept: () => acceptRef.current() }),
    []
  )

  // El título de la pestaña avisa aunque estés en otra pestaña; el de la partida encontrada lo pone AcceptDialog.
  useEffect(() => {
    if (onPlay || !searching) return
    const before = document.title
    document.title = `Buscando partida · ${before}`
    return () => {
      document.title = before
    }
  }, [onPlay, searching])

  if (onPlay || !lobby || !accepting) return null
  return (
    <AcceptDialog
      key={lobby.id}
      lobby={lobby}
      pending={accept.isPending || decline.isPending}
      // Al aceptar, la partida sigue en Jugar: veto, servidor y chat.
      onAccept={() =>
        accept.mutate(undefined, {
          onSuccess: toPlay,
          onError: (e) => toast.error(errorMessage(e)),
        })
      }
      onDecline={() => decline.mutate()}
      auto={!!state?.auto_accept?.allowed && !!state.auto_accept.enabled}
      sound={selected}
    />
  )
}

/** El estado del matchmaking como lo muestra el launcher (bandeja y Discord). */
export function launcherStatusOf(
  state:
    | {
        queue: { mode: string; joined_at: string } | null
        lobby: MmLobby | null
      }
    | undefined
): LauncherStatus {
  const lobby = state?.lobby ?? null
  const queue = state?.queue ?? null
  if (lobby) {
    const base = { mode: lobby.mode, map: lobby.map }
    if (lobby.status === "accepting") return { state: "found", ...base }
    if (lobby.status === "live")
      return {
        state: "live",
        ...base,
        score: lobby.match
          ? `${lobby.match.score1}-${lobby.match.score2}`
          : null,
      }
    if (lobby.status !== "finished" && lobby.status !== "cancelled")
      return { state: "lobby", ...base }
  }
  if (queue)
    return {
      state: "queue",
      mode: queue.mode,
      since: Date.parse(queue.joined_at),
    }
  return { state: "idle" }
}

/**
 * En la barra de arriba, fuera de Jugar: "Buscando 1:23" mientras estás en la cola (con cancelar) o "Partida en
 * curso" con una sala abierta. Lleva a Jugar.
 */
export function SearchingPill({
  away,
  className,
}: {
  away?: boolean
  className?: string
}) {
  const source = useMmSource()
  const onPlay = useOnPlay(away)
  const socketUp = useMmSocket(source)
  const { data: state } = useQuery(
    mmStateOptions(source, socketUp, useQueryClient())
  )
  const leave = useMmAction(source, "leave")
  const queue = state?.queue ?? null
  const lobby = state?.lobby ?? null
  const now = useNow(!!queue && !onPlay)
  if (onPlay || (!queue && !lobby)) return null

  const pill =
    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium"
  if (lobby)
    return (
      <Link
        to="/play"
        className={cn(
          pill,
          "border-primary/60 bg-primary/10 text-primary",
          className
        )}
      >
        <SwordsIcon aria-hidden className="size-3.5" />
        {lobby.status === "accepting"
          ? "¡Partida encontrada!"
          : "Partida en curso"}
      </Link>
    )
  return (
    <span className={cn(pill, "border-primary/50 pr-1", className)}>
      <Link
        to="/play"
        className="inline-flex items-center gap-1.5"
        aria-label={`Buscando partida ${queue!.mode}: ir a Jugar`}
      >
        <LoaderCircleIcon
          aria-hidden
          className="size-3.5 animate-spin text-primary"
        />
        <span className="hidden sm:inline">Buscando</span>
        <span className="font-mono tabular-nums">
          {fmtClock(Math.max(0, now - Date.parse(queue!.joined_at)))}
        </span>
      </Link>
      <Button
        variant="ghost"
        size="icon-xs"
        className="rounded-full"
        aria-label="Dejar de buscar"
        title="Dejar de buscar"
        disabled={leave.isPending}
        onClick={() =>
          leave.mutate(undefined, {
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      >
        <XIcon />
      </Button>
    </span>
  )
}
