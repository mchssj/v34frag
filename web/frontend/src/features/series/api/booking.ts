import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { errorFromResponse, networkError } from "@/api/errors"
import { authFetch } from "@/auth/authFetch"
import { shellKeys } from "@/features/shell/api/keys"
import { env } from "@/lib/env"
import { syncServerClock } from "@/features/matchmaking/serverClock"
import { isOpen } from "../lib/booking"
import type { BookingAction, FreeServer, MatchBooking } from "../types/booking"

// Las rutas de la reserva (replanteo 56) todavía no están en la OpenAPI del frontend: se llama con
// authFetch directo, como el matchmaking. Al regenerar el esquema se pasan a `api.GET(...)`.
async function call<T>(
  path: string,
  init?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
  let res: Response
  const started = Date.now()
  try {
    res = await authFetch(`${env.apiUrl}${path}`, init)
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e
    throw networkError()
  }
  const body: unknown = await res.json().catch(() => undefined)
  if (!res.ok) throw errorFromResponse(res, body)
  if (body && typeof body === "object" && "server_now" in body)
    syncServerClock(body.server_now, Date.now() - started)
  return body as T
}
const send = <T>(path: string, body?: unknown, method = "POST") =>
  call<T>(path, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

export const bookingKeys = {
  booking: (id: string) => ["series", "booking", id] as const,
  free: (kind: string) => ["series", "free-servers", kind] as const,
}

/** Con la reserva abierta se refresca cada 5 s (veto con reloj, fila, espera); si no, cada minuto. */
export const BOOKING_OPEN_MS = 5_000

export function bookingOptions(matchId: string) {
  return queryOptions({
    queryKey: bookingKeys.booking(matchId),
    queryFn: ({ signal }) =>
      call<MatchBooking>(`/api/v1/matches/${matchId}/booking`, { signal }),
    refetchInterval: (q) =>
      isOpen(q.state.data?.booking) ? BOOKING_OPEN_MS : 60_000,
  })
}

/** Servidores libres y aptos para un torneo (se piden al abrir el diálogo de "Iniciar"). */
export function freeServersOptions(kind: "official" | "pcw" = "official") {
  return queryOptions({
    queryKey: bookingKeys.free(kind),
    queryFn: ({ signal }) =>
      call<{ items: FreeServer[]; total: number }>(
        `/api/v1/servers/free?kind=${kind}&per=100`,
        { signal }
      ),
    refetchInterval: 10_000,
  })
}

/** Cada acción devuelve la reserva nueva; la partida también se vuelve a pedir (estado, servidor, veto). */
function useBookingMutation<V>(
  matchId: string,
  fn: (v: V) => Promise<MatchBooking | void>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      if (data) qc.setQueryData(bookingKeys.booking(matchId), data)
      void qc.invalidateQueries({ queryKey: bookingKeys.booking(matchId) })
      void qc.invalidateQueries({ queryKey: shellKeys.match(matchId) })
    },
  })
}

export const useStartMatch = (matchId: string) =>
  useBookingMutation(
    matchId,
    (v: { server_id: string; wait_minutes: number }) =>
      send<MatchBooking>(`/api/v1/matches/${matchId}/start`, v)
  )

export const useSetReady = (matchId: string) =>
  useBookingMutation(matchId, (ready: boolean) =>
    send<MatchBooking>(
      `/api/v1/matches/${matchId}/ready`,
      undefined,
      ready ? "POST" : "DELETE"
    )
  )

export const useBookingAction = (matchId: string) =>
  useBookingMutation(matchId, (a: BookingAction) =>
    send<MatchBooking>(`/api/v1/matches/${matchId}/booking/actions`, a)
  )

export const useVeto = (matchId: string) =>
  useBookingMutation(matchId, async (v: { map: string; version?: string }) => {
    await unwrap(
      api.POST("/api/v1/matches/{id}/veto", {
        params: { path: { id: matchId } },
        body: v,
      })
    )
  })
