import { renderHook } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import { useMatchFoundRepeat } from "./alert"

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test("repite el sonido cada 7 s, alterna el título y lo devuelve al aceptar", () => {
  vi.useFakeTimers()
  const play = vi.fn(() => Promise.resolve())
  vi.stubGlobal(
    "Audio",
    vi.fn(function () {
      return { play, pause: vi.fn(), volume: 1 }
    })
  )
  document.title = "Jugar"
  const { rerender } = renderHook(
    ({ active }) => useMatchFoundRepeat(active, "/s.mp3"),
    { initialProps: { active: true } }
  )

  vi.advanceTimersByTime(1000)
  expect(document.title).toBe("¡Partida encontrada! · CM League")
  vi.advanceTimersByTime(6000)
  expect(play).toHaveBeenCalledTimes(1)
  vi.advanceTimersByTime(7000)
  expect(play).toHaveBeenCalledTimes(2)

  rerender({ active: false })
  expect(document.title).toBe("Jugar")
  vi.advanceTimersByTime(14000)
  expect(play).toHaveBeenCalledTimes(2)
})
