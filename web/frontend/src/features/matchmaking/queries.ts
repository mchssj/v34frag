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
  return useMmMutation(() => source[action]())
}

/** Mutación que devuelve el estado nuevo: se guarda directo, sin esperar al socket. */
export function useMmMutation<A = void>(fn: (arg: A) => Promise<MmState>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (state) => queryClient.setQueryData(mmKeys.state, state),
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
 * Escucha el socket: cada evento invalida el estado (el socket no trae datos). Devuelve si está
 * conectado, para que el estado sepa si tiene que hacer polling.
 */
export function useMmSocket(source: MmSource, onEvent?: (e: MmEvent) => void) {
  const queryClient = useQueryClient()
  const [up, setUp] = useState(false)
  const handler = useRef(onEvent)
  useEffect(() => {
    handler.current = onEvent
  })

  useEffect(
    () =>
      source.subscribe((e) => {
        handler.current?.(e)
        void queryClient.invalidateQueries({ queryKey: mmKeys.all })
      }, setUp),
    [source, queryClient]
  )
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
