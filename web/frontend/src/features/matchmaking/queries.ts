import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"

import type { QueryClient } from "@tanstack/react-query"

import type { MmSource } from "./source"
import type { MmEvent, MmLobby, MmPlayer, MmState } from "./types"

// Polling de respaldo cuando el socket no está (plan, sección 5).
export const MM_FALLBACK_MS = 5_000
/** Con el socket andando, el estado liviano igual se vuelve a pedir cada 30 s en la cola o en una sala (por si se perdió un aviso). */
export const MM_LIVE_REFRESH_MS = 30_000
/** Lo que casi no cambia (mi ficha, amigos, sonidos), cada 2 minutos (bitácora 2026-11-02-mm-avisos-livianos). */
export const MM_PROFILE_MS = 120_000

/** Avisos del socket que llegan juntos: se piden una sola vez. */
export const MM_EVENT_COALESCE_MS = 100

export const mmKeys = {
  all: ["mm"] as const,
  state: ["mm", "state"] as const,
  profile: ["mm", "profile"] as const,
  lobbyMatch: (id: string) => ["mm", "lobby-match", id] as const,
  partyChat: ["mm", "party-chat"] as const,
  adminServers: ["mm", "admin", "servers"] as const,
  passwords: (id: string) => ["mm", "admin", "passwords", id] as const,
}

const ENDED: MmLobby["status"][] = ["finished", "cancelled"]

/**
 * `lobby` es solo la sala abierta y `last_lobby` la última terminada (replanteo 60). Las respuestas de las acciones
 * (mm_my_state, como la web anterior) todavía traen en `lobby` la terminada en la última hora: se pasa a `last_lobby`.
 */
export function normalizeState(s: MmState): MmState {
  const lobby = s.lobby && !ENDED.includes(s.lobby.status) ? s.lobby : null
  const ended = s.lobby?.status === "finished" ? s.lobby : null
  return { ...s, lobby, last_lobby: s.last_lobby ?? ended }
}

/** ¿Hay algo que seguir? En cola o en una sala que todavía no terminó. */
export function isActive(s: MmState | undefined) {
  return !!s && (!!s.queue || !!s.lobby)
}

export function mmProfileOptions(source: MmSource) {
  return queryOptions({
    queryKey: mmKeys.profile,
    queryFn: ({ signal }) => source.profile(signal),
    staleTime: MM_PROFILE_MS,
    refetchInterval: MM_PROFILE_MS,
  })
}

/** Las estadísticas y los clips de una partida terminada no cambian: se piden una sola vez. */
export function lobbyMatchOptions(source: MmSource, lobbyId: string) {
  return queryOptions({
    queryKey: mmKeys.lobbyMatch(lobbyId),
    queryFn: ({ signal }) => source.lobbyMatch(lobbyId, signal),
    staleTime: Infinity,
  })
}

/** La sala de una partida del matchmaking terminada (el detalle de la partida, replanteo 78). Tampoco cambia. */
export function gameRoomOptions(source: MmSource, gameId: string) {
  return queryOptions({
    queryKey: ["mm", "game-room", gameId] as const,
    queryFn: ({ signal }) => source.gameRoom(gameId, signal),
    staleTime: Infinity,
  })
}

/**
 * El estado de siempre, armado con el liviano (cola, sala, grupo) y lo que casi no cambia (en caché 2 minutos). Las
 * estadísticas de la última partida se piden aparte, al abrir su pestaña (`lobbyMatchOptions`).
 */
export function mmStateOptions(
  source: MmSource,
  socketUp: boolean,
  queryClient: QueryClient
) {
  return queryOptions({
    queryKey: mmKeys.state,
    queryFn: async ({ signal }): Promise<MmState> => {
      const [live, profile] = await Promise.all([
        source.stateLive(signal),
        queryClient.fetchQuery(mmProfileOptions(source)),
      ])
      return normalizeState({ ...profile, ...live } as MmState)
    },
    // Sin socket, nada más lo actualiza: también sin estar buscando (la barra muestra activos y servidores).
    refetchInterval: (q) =>
      isActive(q.state.data)
        ? socketUp
          ? MM_LIVE_REFRESH_MS
          : MM_FALLBACK_MS
        : socketUp
          ? false
          : MM_LIVE_REFRESH_MS,
  })
}

export function adminServersOptions(source: MmSource) {
  return queryOptions({
    queryKey: mmKeys.adminServers,
    queryFn: ({ signal }) => source.adminServers(signal),
  })
}

export function passwordHistoryOptions(source: MmSource, serverId: string) {
  return queryOptions({
    queryKey: mmKeys.passwords(serverId),
    queryFn: ({ signal }) => source.passwordHistory(serverId, signal),
  })
}

type Action = "leave" | "accept" | "decline" | "leaveParty"

export function useMmAction(source: MmSource, action: Action) {
  return useMmMutation(
    () => source[action](),
    action === "accept" ? acceptOptimistic : undefined
  )
}

/** Aceptar: quien mira queda como aceptado antes de que responda la API. */
export function acceptOptimistic(s: MmState): MmState {
  if (!s.lobby) return s
  return {
    ...s,
    lobby: {
      ...s.lobby,
      players: s.lobby.players.map((p) =>
        p.is_me ? { ...p, accepted: true } : p
      ),
    },
  }
}

/** Banear un mapa: queda baneado y pasa el turno antes de que responda la API. */
export function banOptimistic(s: MmState, map: string): MmState {
  const veto = s.lobby?.veto
  if (!s.lobby || !veto || veto.turn === null) return s
  if (veto.bans.some((b) => b.map === map)) return s
  const seq = veto.bans.length + 1
  return {
    ...s,
    lobby: {
      ...s.lobby,
      veto: {
        ...veto,
        bans: [...veto.bans, { seq, team: veto.turn, map, auto: false }],
        turn: veto.turn === 1 ? 2 : 1,
      },
    },
  }
}

/**
 * La última acción propia: cuándo empezó y si salió bien. Su respuesta trae los avisos que llegaron **antes** de que
 * empezara; los que llegan mientras tanto pueden no estar (la respuesta pudo leerse antes), así que esos sí se piden.
 */
const lastOwnAction = { startedAt: 0, ok: false }

/**
 * Mutación que devuelve el estado nuevo: se guarda directo, sin esperar al socket. Con `optimistic`,
 * la pantalla cambia al tocar y vuelve atrás si la API falla.
 */
export function useMmMutation<A = void>(
  fn: (arg: A) => Promise<MmState>,
  optimistic?: (s: MmState, arg: A) => MmState
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onMutate: async (arg: A) => {
      lastOwnAction.startedAt = Date.now()
      lastOwnAction.ok = false
      if (!optimistic) return { prev: undefined }
      await queryClient.cancelQueries({ queryKey: mmKeys.state })
      const prev = queryClient.getQueryData<MmState>(mmKeys.state)
      if (prev) queryClient.setQueryData(mmKeys.state, optimistic(prev, arg))
      return { prev }
    },
    onError: (_e, _arg, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(mmKeys.state, ctx.prev)
    },
    onSuccess: (state) => {
      lastOwnAction.ok = true
      // Las de la cola, la sala y el grupo devuelven solo el estado liviano (mejora B): se combina con lo que ya hay.
      const prev = queryClient.getQueryData<MmState>(mmKeys.state)
      queryClient.setQueryData(
        mmKeys.state,
        normalizeState(prev ? { ...prev, ...state } : state)
      )
      // Las sociales devuelven el completo, con lo que casi no cambia (un sonido elegido, un bloqueo).
      if ("me" in state) queryClient.setQueryData(mmKeys.profile, state)
    },
  })
}

export function playerSearchOptions(source: MmSource, q: string) {
  return queryOptions({
    queryKey: ["mm", "candidates", q] as const,
    queryFn: ({ signal }) => source.searchPlayers(q, signal),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  })
}

export function useRotatePassword(source: MmSource, serverId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => source.rotatePassword(serverId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mmKeys.all }),
  })
}

/** Qué hay que volver a pedir después de unos avisos (se juntan los que llegan seguidos). */
export type MmNeeds = { live: boolean; profile: boolean; chat: boolean }

// queue.changed: desde el replanteo 66 trae el resumen completo; antes, solo size y by_mode.
type QueueSizes = {
  size?: number
  by_mode?: Record<string, number>
  active_players?: number
  live_matches?: number
  servers?: MmState["servers"]
  levels?: MmState["queue_activity"]["levels"]
}
type Found = { mode?: string; size?: number; accept_deadline?: string }

/**
 * queue.changed con el resumen: se actualiza la barra de Jugar sin pedir nada (cuántos buscan, activos, en vivo,
 * servidores libres y niveles). La lista de quiénes buscan no viaja: se pide al abrirla.
 */
export function patchQueueSizes(s: MmState, d: QueueSizes): MmState {
  const byMode = d.by_mode ?? {}
  const per = (mode: string) =>
    (s.modes?.find((m) => m.mode === mode)?.players_per_team ?? 5) * 2
  return {
    ...s,
    queue_size: d.size ?? s.queue_size,
    active_players: d.active_players ?? s.active_players,
    live_matches: d.live_matches ?? s.live_matches,
    servers: d.servers ?? s.servers,
    queue_activity: s.queue_activity && {
      ...s.queue_activity,
      levels: d.levels ?? s.queue_activity.levels,
      modes: s.queue_activity.modes.map((m) => {
        const n = byMode[m.mode] ?? 0
        return { ...m, searching: n, missing: per(m.mode) - (n % per(m.mode)) }
      }),
    },
  }
}

/**
 * "Partida encontrada" en lo que tarda el socket: con el modo, el tamaño y el plazo del aviso se arma una sala mínima
 * para abrir la ventana; los jugadores llegan después con el estado liviano. Aceptar no necesita nada más.
 */
export function seedFoundLobby(s: MmState, lobbyId: string, d: Found): MmState {
  if (s.lobby && s.lobby.id === lobbyId) return s
  const size = d.size ?? 10
  const players = Array.from(
    { length: size },
    (_, i) =>
      ({
        player_id: `pendiente-${i}`,
        nick: "",
        is_me: i === 0,
        accepted: false,
        team: i < size / 2 ? 1 : 2,
      }) as unknown as MmPlayer
  )
  const lobby = {
    id: lobbyId,
    mode: d.mode ?? "5v5",
    region: null,
    match: null,
    status: "accepting",
    map: null,
    accept_deadline: d.accept_deadline ?? null,
    veto: null,
    connect_deadline: null,
    players,
    server: null,
    match_id: null,
    end_reason: null,
    reported: [],
    commended: null,
    elo_stake: null,
  } as MmLobby
  return { ...s, queue: null, lobby }
}

/**
 * Qué hace cada aviso (bitácora 2026-11-02-mm-avisos-livianos): aplica lo que trae y anota qué hay que volver a pedir.
 * Antes, cualquier aviso volvía a pedir todo el matchmaking (también el panel de admin).
 */
export function applyMmEvent(
  queryClient: QueryClient,
  e: MmEvent,
  needs: MmNeeds
) {
  const current = queryClient.getQueryData<MmState>(mmKeys.state)
  const d = (e.d ?? null) as Record<string, unknown> | null
  if (e.t === "ready" || e.t === "resync") {
    needs.live = needs.profile = true
  } else if (e.t === "queue.changed") {
    if (d && current)
      queryClient.setQueryData(mmKeys.state, patchQueueSizes(current, d))
    else needs.live = true
  } else if (e.t === "lobby.found") {
    if (d && e.lobby && current)
      queryClient.setQueryData(
        mmKeys.state,
        seedFoundLobby(current, e.lobby, d as Found)
      )
    needs.live = true
  } else if (e.t.startsWith("lobby.")) {
    // Un aviso de otra sala no cambia nada de lo que se ve.
    const mine = current?.lobby?.id
    if (e.lobby && mine && e.lobby !== mine) return
    if (e.t === "lobby.chat") needs.chat = true
    else needs.live = true
    if (e.t === "lobby.finished") needs.profile = true
  } else if (e.t === "party.chat") {
    // Solo el chat del grupo (prototipo).
    void queryClient.invalidateQueries({ queryKey: mmKeys.partyChat })
  } else if (e.t.startsWith("party.")) {
    needs.live = true
  } else if (e.t === "penalty.lifted") {
    // Un moderador le levantó la sanción: el estado (sin el cartel) y el nivel de la escalera.
    needs.live = needs.profile = true
  } else if (e.t === "friend.changed") {
    // (replanteo 71) Alguien te sumó o te sacó de amigos, o lo hiciste en otra pestaña: solo la lista de amigos.
    needs.profile = true
  } else if (e.t === "friend.searching") {
    // Le llega solo a sus amigos: la lista de amigos (en lo que casi no cambia) muestra que está buscando.
    needs.profile = true
  } else if (e.t === "booking.update") {
    // Es de la página de una serie, no del matchmaking.
  } else {
    // mm.config y cualquier aviso que no se conozca: se vuelve a pedir todo el estado, como antes.
    needs.live = needs.profile = true
  }
}

type SocketShare = {
  refs: number
  up: boolean
  statusListeners: Set<(up: boolean) => void>
  handlers: Set<(e: MmEvent) => void>
  stop: () => void
}
// Una sola suscripción por fuente y QueryClient (plan docs/bitacora/2026-11-02-mm-socket-optimizado, error 3): antes,
// el aviso de reconexión del layout y Jugar abrían un socket cada uno y cada aviso pedía el estado dos veces.
const shares = new WeakMap<QueryClient, Map<MmSource, SocketShare>>()

function acquireSocket(
  source: MmSource,
  queryClient: QueryClient
): SocketShare {
  let bySource = shares.get(queryClient)
  if (!bySource) shares.set(queryClient, (bySource = new Map()))
  const existing = bySource.get(source)
  if (existing) {
    existing.refs++
    return existing
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastEventAt = 0
  let needs: MmNeeds = { live: false, profile: false, chat: false }
  const flush = () => {
    if (queryClient.isMutating() > 0) {
      timer = setTimeout(flush, MM_EVENT_COALESCE_MS)
      return
    }
    timer = undefined
    const n = needs
    needs = { live: false, profile: false, chat: false }
    if (n.chat)
      void queryClient.invalidateQueries({
        queryKey: [...mmKeys.all, "chat"],
      })
    // Lo que casi no cambia se marca como viejo: el estado lo vuelve a pedir al armarse.
    if (n.profile)
      void queryClient.invalidateQueries({
        queryKey: mmKeys.profile,
        refetchType: "none",
      })
    const covered =
      lastOwnAction.ok && lastEventAt < lastOwnAction.startedAt && !n.profile
    if ((n.live || n.profile) && !covered)
      void queryClient.invalidateQueries({ queryKey: mmKeys.state })
  }
  const share: SocketShare = {
    refs: 1,
    up: false,
    statusListeners: new Set(),
    handlers: new Set(),
    stop: () => {},
  }
  const stop = source.subscribe(
    (e) => {
      for (const h of share.handlers) h(e)
      applyMmEvent(queryClient, e, needs)
      lastEventAt = Date.now()
      if ((needs.live || needs.profile || needs.chat) && timer === undefined)
        timer = setTimeout(flush, MM_EVENT_COALESCE_MS)
    },
    (up) => {
      share.up = up
      for (const l of share.statusListeners) l(up)
    }
  )
  share.stop = () => {
    clearTimeout(timer)
    stop()
  }
  bySource.set(source, share)
  return share
}

function releaseSocket(
  source: MmSource,
  queryClient: QueryClient,
  share: SocketShare
) {
  if (--share.refs > 0) return
  share.stop()
  shares.get(queryClient)?.delete(source)
}

/**
 * Escucha el socket. Cada aviso aplica lo que trae y, si hace falta, se vuelve a pedir solo la parte que cambió
 * (el estado liviano, lo que casi no cambia o el chat). Devuelve si está conectado, para el polling de respaldo.
 *
 * Los avisos que llegan juntos se piden una sola vez. Con una acción propia en curso se espera a que termine: si el
 * último aviso llegó antes de empezarla, su respuesta ya lo trae y no se vuelve a pedir el estado. Todos los que usan
 * este hook en la pestaña comparten un solo socket.
 */
export function useMmSocket(source: MmSource, onEvent?: (e: MmEvent) => void) {
  const queryClient = useQueryClient()
  const [up, setUp] = useState(false)
  const handler = useRef(onEvent)
  useEffect(() => {
    handler.current = onEvent
  })

  useEffect(() => {
    const share = acquireSocket(source, queryClient)
    const onShared = (e: MmEvent) => handler.current?.(e)
    share.handlers.add(onShared)
    share.statusListeners.add(setUp)
    // Un hook que se suma a un socket ya abierto arranca con su estado (fuera del cuerpo del efecto).
    let active = true
    queueMicrotask(() => {
      if (active) setUp(share.up)
    })
    return () => {
      active = false
      share.handlers.delete(onShared)
      share.statusListeners.delete(setUp)
      releaseSocket(source, queryClient, share)
    }
  }, [source, queryClient])
  return up
}

export function adminConfigOptions(source: MmSource) {
  return queryOptions({
    queryKey: ["mm", "admin", "config"] as const,
    queryFn: ({ signal }) => source.adminConfig(signal),
  })
}

export function adminMapsOptions(source: MmSource, mode: string) {
  return queryOptions({
    queryKey: ["mm", "admin", "maps", mode] as const,
    queryFn: ({ signal }) => source.adminMaps(mode, signal),
  })
}

export function adminReportsOptions(source: MmSource) {
  return queryOptions({
    queryKey: ["mm", "admin", "reports"] as const,
    queryFn: ({ signal }) => source.adminReports(signal),
  })
}

export function adminBansOptions(source: MmSource) {
  return queryOptions({
    queryKey: ["mm", "admin", "bans"] as const,
    queryFn: ({ signal }) => source.adminBans(signal),
  })
}

export function adminPenaltiesOptions(source: MmSource) {
  return queryOptions({
    queryKey: ["mm", "admin", "penalties"] as const,
    queryFn: ({ signal }) => source.adminPenalties(signal),
  })
}

export function adminStatsOptions(source: MmSource, days: number) {
  return queryOptions({
    queryKey: ["mm", "admin", "stats", days] as const,
    queryFn: ({ signal }) => source.adminStats(days, signal),
  })
}

export function adminLobbiesOptions(source: MmSource) {
  return queryOptions({
    queryKey: ["mm", "admin", "lobbies"] as const,
    queryFn: ({ signal }) => source.adminLobbies(signal),
  })
}

/** Mutación de Administración: al terminar, se vuelve a pedir todo lo del matchmaking. */
export function useMmAdminMutation<A, R>(fn: (arg: A) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mmKeys.all }),
  })
}

export function feedOptions(source: MmSource) {
  return queryOptions({
    queryKey: ["mm", "feed"] as const,
    queryFn: ({ signal }) => source.feed(signal),
    staleTime: 20_000,
    refetchInterval: 30_000,
  })
}
