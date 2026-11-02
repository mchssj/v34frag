import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"

import type { MmSource } from "./source"
import type { MmEvent, MmState } from "./types"

// Polling de respaldo cuando el socket no está (plan, sección 5). Con socket no hace falta.
export const MM_FALLBACK_MS = 5_000

/** Avisos del socket que llegan juntos: se piden una sola vez. */
export const MM_EVENT_COALESCE_MS = 100

export const mmKeys = {
  all: ["mm"] as const,
  state: ["mm", "state"] as const,
  adminServers: ["mm", "admin", "servers"] as const,
  passwords: (id: string) => ["mm", "admin", "passwords", id] as const,
}

/** ¿Hay algo que seguir? En cola o en una sala que todavía no terminó. */
export function isActive(s: MmState | undefined) {
  return !!s && (!!s.queue || !!s.lobby)
}

export function mmStateOptions(source: MmSource, socketUp: boolean) {
  return queryOptions({
    queryKey: mmKeys.state,
    queryFn: ({ signal }) => source.state(signal),
    refetchInterval: (q) =>
      !socketUp && isActive(q.state.data) ? MM_FALLBACK_MS : false,
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

/** Cuándo terminó la última acción propia (para no repetir el pedido con su aviso). */
const lastOwnAction = { at: 0 }

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
      lastOwnAction.at = Date.now()
      queryClient.setQueryData(mmKeys.state, state)
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

/**
 * Escucha el socket: los eventos invalidan el estado (el socket no trae datos). Devuelve si está
 * conectado, para que el estado sepa si tiene que hacer polling.
 *
 * Los avisos que llegan juntos se piden una sola vez. Con una acción propia en curso se espera a
 * que termine: si su respuesta llegó después del último aviso, ya trae ese cambio (el aviso sale al
 * confirmar en la base, antes de que la API arme el estado) y no se vuelve a pedir.
 */
export function useMmSocket(source: MmSource, onEvent?: (e: MmEvent) => void) {
  const queryClient = useQueryClient()
  const [up, setUp] = useState(false)
  const handler = useRef(onEvent)
  useEffect(() => {
    handler.current = onEvent
  })

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let lastEventAt = 0
    const flush = () => {
      if (queryClient.isMutating() > 0) {
        timer = setTimeout(flush, MM_EVENT_COALESCE_MS)
        return
      }
      timer = undefined
      if (lastOwnAction.at > lastEventAt) return
      void queryClient.invalidateQueries({ queryKey: mmKeys.all })
    }
    const stop = source.subscribe((e) => {
      handler.current?.(e)
      lastEventAt = Date.now()
      if (timer === undefined) timer = setTimeout(flush, MM_EVENT_COALESCE_MS)
    }, setUp)
    return () => {
      clearTimeout(timer)
      stop()
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
