import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  acceptOptimistic,
  applyMmEvent,
  banOptimistic,
  MM_EVENT_COALESCE_MS,
  mmStateOptions,
  type MmNeeds,
  mmKeys,
  normalizeState,
  patchQueueSizes,
  seedFoundLobby,
  useMmMutation,
  useMmSocket,
} from "./queries"
import type { MmSource } from "./source"
import type { MmEvent, MmLobby, MmState } from "./types"

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

describe("useMmMutation con respuesta liviana (mejora B)", () => {
  it("combina la respuesta con lo que ya había y no pisa el perfil", async () => {
    const queryClient = new QueryClient()
    const profile = { me: { nick: "kyan" }, friends: [] }
    queryClient.setQueryData(mmKeys.profile, profile)
    queryClient.setQueryData(mmKeys.state, {
      ...profile,
      lobby: null,
      queue: null,
    } as unknown as MmState)
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const live = { lobby: null, queue: { mode: "5v5" } } as unknown as MmState
    const { result } = renderHook(() => useMmMutation(async () => live), {
      wrapper,
    })
    await act(async () => {
      await result.current.mutateAsync()
    })
    expect(queryClient.getQueryData(mmKeys.state)).toMatchObject({
      me: { nick: "kyan" },
      queue: { mode: "5v5" },
    })
    expect(queryClient.getQueryData(mmKeys.profile)).toBe(profile)
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
    expect(invalidate).toHaveBeenCalledWith({ queryKey: mmKeys.state })
  })

  it("dos hooks en la pestaña comparten un solo socket y piden el estado una sola vez", async () => {
    let emit: (e: MmEvent) => void = () => {}
    let stopped = 0
    const subscribe = vi.fn(
      (on: (e: MmEvent) => void, up: (v: boolean) => void) => {
        emit = on
        up(true)
        return () => stopped++
      }
    )
    const source = { subscribe } as unknown as MmSource
    const queryClient = new QueryClient()
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined)
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const seen: string[] = []
    const a = renderHook(() => useMmSocket(source), { wrapper })
    const b = renderHook(() => useMmSocket(source, (e) => seen.push(e.t)), {
      wrapper,
    })
    expect(subscribe).toHaveBeenCalledTimes(1)
    await act(async () => {})
    expect(a.result.current).toBe(true)
    expect(b.result.current).toBe(true)
    act(() => emit({ t: "lobby.veto" }))
    act(() => vi.advanceTimersByTime(MM_EVENT_COALESCE_MS))
    expect(seen).toEqual(["lobby.veto"])
    expect(invalidate).toHaveBeenCalledTimes(1)
    a.unmount()
    expect(stopped).toBe(0)
    b.unmount()
    expect(stopped).toBe(1)
  })

  it("un aviso después del anterior vuelve a pedir", () => {
    const { emit, invalidate } = setup()
    emit({ t: "lobby.accept" })
    act(() => vi.advanceTimersByTime(MM_EVENT_COALESCE_MS))
    emit({ t: "lobby.veto" })
    act(() => vi.advanceTimersByTime(MM_EVENT_COALESCE_MS))
    expect(invalidate).toHaveBeenCalledTimes(2)
  })

  it("un aviso que llega durante una acción propia se pide al terminarla (la respuesta pudo leerse antes)", async () => {
    const { emit, invalidate, start, finish, mutating } = setup()
    await start()
    emit({ t: "lobby.accept" })
    act(() => vi.advanceTimersByTime(MM_EVENT_COALESCE_MS * 3))
    expect(invalidate).not.toHaveBeenCalled()
    await finish()
    expect(mutating()).toBe(0)
    await act(() => vi.advanceTimersByTimeAsync(MM_EVENT_COALESCE_MS * 3))
    expect(invalidate).toHaveBeenCalledTimes(1)
  })

  it("un aviso de antes de empezar la acción no se pide: la respuesta ya lo trae", async () => {
    const { emit, invalidate, start, finish } = setup()
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    emit({ t: "lobby.veto" })
    await act(() => vi.advanceTimersByTimeAsync(5))
    await start()
    await finish()
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

describe("avisos livianos", () => {
  const needs = (): MmNeeds => ({ live: false, profile: false, chat: false })
  const base = () =>
    ({
      queue_size: 1,
      modes: [{ mode: "5v5", players_per_team: 5 }],
      queue_activity: { modes: [{ mode: "5v5", searching: 1, missing: 9 }] },
      lobby: null,
    }) as unknown as MmState

  it("patchQueueSizes actualiza el contador y lo que falta", () => {
    const next = patchQueueSizes(base(), { size: 7, by_mode: { "5v5": 7 } })
    expect(next.queue_size).toBe(7)
    expect(next.queue_activity!.modes[0]).toMatchObject({
      searching: 7,
      missing: 3,
    })
  })

  it("patchQueueSizes aplica el resumen completo (replanteo 66)", () => {
    const levels = [{ label: "Nivel 1 a 3", count: 2 }]
    const next = patchQueueSizes(
      {
        ...base(),
        active_players: 1,
        live_matches: 0,
        servers: { total: 2, free: 2 },
        queue_activity: { ...base().queue_activity, levels: [], players: [] },
      } as unknown as MmState,
      {
        size: 2,
        by_mode: { "5v5": 2 },
        active_players: 12,
        live_matches: 1,
        servers: { total: 2, free: 1 },
        levels,
      }
    )
    expect(next).toMatchObject({
      active_players: 12,
      live_matches: 1,
      servers: { total: 2, free: 1 },
    })
    expect(next.queue_activity.levels).toBe(levels)
    // Lo que no trae el aviso (la lista de quiénes buscan) queda como estaba.
    expect(next.queue_activity.players).toEqual([])
  })

  it("con el aviso viejo (solo tamaños) lo demás queda como estaba", () => {
    const prev = {
      ...base(),
      active_players: 5,
      servers: { total: 2, free: 2 },
    } as unknown as MmState
    const next = patchQueueSizes(prev, { size: 3, by_mode: { "5v5": 3 } })
    expect(next.active_players).toBe(5)
    expect(next.servers).toBe(prev.servers)
  })

  it("sin socket pide el estado cada 30 s aunque no esté buscando; con socket, no", () => {
    const qc = new QueryClient()
    const source = {} as MmSource
    const idle = { state: { data: base() } } as never
    const sin = mmStateOptions(source, false, qc).refetchInterval as (
      q: never
    ) => unknown
    const con = mmStateOptions(source, true, qc).refetchInterval as (
      q: never
    ) => unknown
    expect(sin(idle)).toBe(30_000)
    expect(con(idle)).toBe(false)
  })

  it("queue.changed con el dato no pide nada", () => {
    const qc = new QueryClient()
    qc.setQueryData(mmKeys.state, base())
    const n = needs()
    applyMmEvent(
      qc,
      { t: "queue.changed", d: { size: 4, by_mode: { "5v5": 4 } } },
      n
    )
    expect(n).toEqual(needs())
    expect(qc.getQueryData<MmState>(mmKeys.state)!.queue_size).toBe(4)
  })

  it("lobby.found arma la sala al instante y pide el estado", () => {
    const qc = new QueryClient()
    qc.setQueryData(mmKeys.state, base())
    const n = needs()
    const deadline = "2026-11-02T20:00:30Z"
    applyMmEvent(
      qc,
      {
        t: "lobby.found",
        lobby: "L1",
        d: { mode: "5v5", size: 10, accept_deadline: deadline },
      },
      n
    )
    const lobby = qc.getQueryData<MmState>(mmKeys.state)!.lobby!
    expect(lobby).toMatchObject({
      id: "L1",
      status: "accepting",
      accept_deadline: deadline,
    })
    expect(lobby.players).toHaveLength(10)
    expect(lobby.players.filter((p) => p.is_me)).toHaveLength(1)
    expect(n.live).toBe(true)
  })

  it("seedFoundLobby no pisa la sala que ya está", () => {
    const s = { ...base(), lobby: { id: "L1" } } as unknown as MmState
    expect(seedFoundLobby(s, "L1", {})).toBe(s)
  })

  it("un aviso de otra sala se ignora y el chat pide solo el chat", () => {
    const qc = new QueryClient()
    qc.setQueryData(mmKeys.state, { ...base(), lobby: { id: "L1" } })
    const otra = needs()
    applyMmEvent(qc, { t: "lobby.update", lobby: "L2" }, otra)
    expect(otra).toEqual(needs())
    const chat = needs()
    applyMmEvent(qc, { t: "lobby.chat", lobby: "L1" }, chat)
    expect(chat).toEqual({ live: false, profile: false, chat: true })
  })

  it("penalty.lifted renueva el estado y el perfil (el nivel de la escalera)", () => {
    const qc = new QueryClient()
    qc.setQueryData(mmKeys.state, base())
    const n = needs()
    applyMmEvent(qc, { t: "penalty.lifted" }, n)
    expect(n).toEqual({ live: true, profile: true, chat: false })
  })

  it("lobby.finished también renueva el perfil", () => {
    const qc = new QueryClient()
    qc.setQueryData(mmKeys.state, { ...base(), lobby: { id: "L1" } })
    const n = needs()
    applyMmEvent(qc, { t: "lobby.finished", lobby: "L1" }, n)
    expect(n).toMatchObject({ live: true, profile: true })
  })
})

describe("normalizeState", () => {
  const lobby = (id: string, status: string) =>
    ({ id, status }) as unknown as MmLobby

  it("una sala terminada pasa a last_lobby y lobby queda vacío", () => {
    const s = normalizeState({
      lobby: lobby("L1", "finished"),
    } as unknown as MmState)
    expect(s.lobby).toBeNull()
    expect(s.last_lobby!.id).toBe("L1")
  })

  it("si ya viene last_lobby manda ese, y una cancelada no es la última partida", () => {
    const s = normalizeState({
      lobby: lobby("L2", "cancelled"),
      last_lobby: lobby("L1", "finished"),
    } as unknown as MmState)
    expect(s.lobby).toBeNull()
    expect(s.last_lobby!.id).toBe("L1")
  })

  it("la sala abierta queda en lobby", () => {
    const s = normalizeState({
      lobby: lobby("L3", "live"),
      last_lobby: null,
    } as unknown as MmState)
    expect(s.lobby!.id).toBe("L3")
    expect(s.last_lobby).toBeNull()
  })
})
