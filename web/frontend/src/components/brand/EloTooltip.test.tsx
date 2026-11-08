import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { EloChart } from "@/features/player/components/EloChart"
import { EloTooltip } from "./EloTooltip"

const point = (
  elo_after: number,
  elo_delta: number | null,
  map: string | null
) => ({
  match_id: crypto.randomUUID(),
  map,
  at: "2026-11-03T22:00:00Z",
  elo_before: elo_delta === null ? null : elo_after - elo_delta,
  elo_after,
  elo_delta,
})

describe("EloTooltip", () => {
  it("muestra el ELO, el cambio con signo, la fecha y el mapa", () => {
    render(
      <EloTooltip point={point(1210, 18, "de_dust2")} left="50%" frac={0.5} />
    )
    expect(screen.getByText("1210")).toBeInTheDocument()
    expect(screen.getByText("+18")).toHaveClass("text-win")
    expect(screen.getByText("3 nov · de_dust2")).toBeInTheDocument()
  })

  it("una derrota va en rojo y sin cambio cuenta como +0", () => {
    const { rerender } = render(
      <EloTooltip point={point(1180, -22, null)} left="0%" frac={0} />
    )
    expect(screen.getByText("-22")).toHaveClass("text-destructive")
    rerender(<EloTooltip point={point(1000, null, null)} left="0%" frac={0} />)
    expect(screen.getByText("+0")).toBeInTheDocument()
  })
})

describe("EloChart del perfil", () => {
  afterEach(() => vi.restoreAllMocks())

  it("al tocar la gráfica muestra el globo de la partida más cercana", () => {
    const points = [
      point(1000, null, "de_inferno"),
      point(1020, 20, "de_nuke"),
      point(1005, -15, "de_dust2"),
    ]
    const { container } = render(
      <EloChart points={points} floor={901} level={4} />
    )
    const area = container.firstElementChild as HTMLElement
    vi.spyOn(area, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 300,
    } as DOMRect)

    expect(screen.queryByText("-15")).not.toBeInTheDocument()
    fireEvent.pointerDown(area, { clientX: 290 })
    expect(screen.getByText("-15")).toBeInTheDocument()
    expect(screen.getByText("3 nov · de_dust2")).toBeInTheDocument()

    fireEvent.pointerLeave(area)
    expect(screen.queryByText("-15")).not.toBeInTheDocument()
  })
})
