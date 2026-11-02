import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  acceptOptimistic,
  banOptimistic,
  MM_EVENT_COALESCE_MS,
  mmKeys,
  useMmMutation,
  useMmSocket,
} from "./queries"
import type { MmSource } from "./source"
import type { MmEvent, MmState } from "./types"

const state = (lobby: unknown) => ({ lobby }) as unknown as MmState

describe("acceptOptimistic", () => {
  it("marca como aceptado solo a quien mira", () => {
    const s = state({
      players: [
        { player_id: "a", is_me: true, accepted: false },
        { player_id: "b", is_me: false, accepted: false },
      ],
    })
    const next = acceptOptimistic(s)
    expect(next.lobby!.players.map((p) => p.accepted)).toEqual([true, false])
    expect(s.lobby!.players[0]!.accepted).toBe(false)
  })

  it("sin sala no cambia nada", () => {
    const s = state(null)
    expect(acceptOptimistic(s)).toBe(s)
  })
})

describe("banOptimistic", () => {
  const veto = (turn: 1 | 2 | null, bans: { map: string }[] = []) =>
    state({
      veto: {
        pool: [],
        deadline: null,
        turn,
        bans: bans.map((b, i) => ({ seq: i + 1, team: 1, auto: false, ...b })),
      },
    })

  it("suma el baneo del equipo del turno y pasa el turno", () => {
    const next = banOptimistic(veto(2, [{ map: "de_dust2" }]), "de_nuke")
    expect(next.lobby!.veto!.bans.at(-1)).toEqual({
      seq: 2,
      team: 2,
      map: "de_nuke",
      auto: false,
    })
    expect(next.lobby!.veto!.turn).toBe(1)
  })

  it("un mapa ya baneado o el veto terminado no cambian", () => {
    const repetido = veto(1, [{ map: "de_nuke" }])
    expect(banOptimistic(repetido, "de_nuke")).toBe(repetido)
    const terminado = veto(null)
    expect(banOptimistic(terminado, "de_nuke")).toBe(terminado)
  })
})

describe("useMmSocket", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function setup() {
    let emit: (e: MmEvent) => void = () => {}
    const source = {
      subscribe: (on: (e: MmEvent) => void, up: (v: boolean) => void) => {
        emit = on
        up(true)
        return () => {}
      },
    } as unknown as MmSource
    const queryClient = new QueryClient()
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    let resolve: (s: MmState) => void = () => {}
    const { result } = renderHook(
      () => ({
        socket: useMmSocket(source),
        action: useMmMutation(() => new Promise<MmState>((r) => (resolve = r))),
      }),
      { wrapper }
    )
    return {
      emit: (e: MmEvent) => act(() => emit(e)),
      invalidate,
      mutating: () => queryClient.isMutating(),
      // La función de la mutación arranca un instante después de mutate.
      start: async () => {
        await act(async () => {
          result.current.action.mutate()
          await vi.advanceTimersByTimeAsync(0)
        })
      },
      finish: async () => {
        await act(async () => {
          resolve(state(null))
          await vi.advanceTimersByTimeAsync(0)
        })
      },
    }
  }

  it("varios avisos juntos piden el estado una sola vez", () => {
    const { emit, invalidate } = setup()
    emit({ t: "lobby.accept" })
    emit({ t: "lobby.accept" })
    emit({ t: "lobby.veto" })
    expect(invalidate).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(MM_EVENT_COALESCE_MS))
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: mmKeys.all })
  })

  it("un aviso después del anterior vuelve a pedir", () => {
    const { emit, invalidate } = setup()
    emit({ t: "lobby.accept" })
    act(() => vi.advanceTimersByTime(MM_EVENT_COALESCE_MS))
    emit({ t: "lobby.veto" })
    act(() => vi.advanceTimersByTime(MM_EVENT_COALESCE_MS))
    expect(invalidate).toHaveBeenCalledTimes(2)
  })

  it("el aviso de una acción propia no vuelve a pedir: la respuesta ya lo trae", async () => {
    const { emit, invalidate, start, finish, mutating } = setup()
    await start()
    emit({ t: "lobby.accept" })
    act(() => vi.advanceTimersByTime(MM_EVENT_COALESCE_MS * 3))
    expect(invalidate).not.toHaveBeenCalled()
    await finish()
    expect(mutating()).toBe(0)
    await act(() => vi.advanceTimersByTimeAsync(MM_EVENT_COALESCE_MS * 3))
    expect(invalidate).not.toHaveBeenCalled()
  })

  it("un aviso que llega después de la respuesta sí pide", async () => {
    const { emit, invalidate, start, finish } = setup()
    await start()
    await finish()
    // Después de la respuesta (y de la hora que dejó la prueba anterior, que es del mismo módulo).
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    emit({ t: "lobby.veto" })
    act(() => vi.advanceTimersByTime(MM_EVENT_COALESCE_MS))
    expect(invalidate).toHaveBeenCalledTimes(1)
  })
})
