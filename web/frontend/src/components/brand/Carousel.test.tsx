import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Carousel } from "./Carousel"
import { ClipCard, clipDuration } from "./ClipCard"

// jsdom no mide: se simula el ancho de la fila y de su contenido.
function size(scrollWidth: number, clientWidth: number) {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(
    scrollWidth
  )
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
    clientWidth
  )
}
afterEach(() => vi.restoreAllMocks())

async function show(n: number) {
  render(
    <Carousel label="Más jugadas" title={<h3>Más jugadas</h3>} as="ul">
      {Array.from({ length: n }, (_, i) => (
        <li key={i}>Clip {i}</li>
      ))}
    </Carousel>
  )
  // La primera medición va en el siguiente cuadro.
  await act(() => new Promise((r) => requestAnimationFrame(() => r(null))))
  return screen.getByRole("list", { name: "Más jugadas" })
}

describe("Carousel", () => {
  it("si todo entra no hay flechas ni degradado", async () => {
    size(600, 800)
    const track = await show(2)
    expect(screen.queryByRole("button", { name: "Siguientes" })).toBeNull()
    expect(track).not.toHaveAttribute("data-more")
    expect(track).not.toHaveAttribute("tabindex")
  })

  it("si no entra: flechas arriba, la de volver apagada al inicio y degradado a la derecha", async () => {
    size(2000, 800)
    const track = await show(8)
    expect(screen.getByRole("button", { name: "Anteriores" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Siguientes" })).toBeEnabled()
    expect(track).toHaveAttribute("data-more", "end")
    expect(track).toHaveAttribute("tabindex", "0")
  })

  it("las flechas y el teclado desplazan casi un ancho", async () => {
    size(2000, 800)
    const by = vi.fn()
    HTMLElement.prototype.scrollBy = by
    const track = await show(8)
    await userEvent.click(screen.getByRole("button", { name: "Siguientes" }))
    expect(by).toHaveBeenLastCalledWith({ left: 680 })
    track.focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(by).toHaveBeenLastCalledWith({ left: -680 })
  })

  it("al final se apaga la de avanzar y el degradado pasa a la izquierda", async () => {
    size(2000, 800)
    const track = await show(8)
    vi.spyOn(track, "scrollLeft", "get").mockReturnValue(1200)
    act(() => {
      track.dispatchEvent(new Event("scroll"))
    })
    expect(screen.getByRole("button", { name: "Siguientes" })).toBeDisabled()
    expect(track).toHaveAttribute("data-more", "start")
  })
})

describe("ClipCard", () => {
  it("con la foto del mapa, el tipo y la duración; elegida queda marcada", async () => {
    const pick = vi.fn()
    const { container } = render(
      <ClipCard
        kind="ACE"
        who="kyan"
        detail="Dust2 · ronda 7"
        image="https://x.test/dust2.webp"
        seconds={75}
        selected
        onSelect={pick}
        label="Ver Ace de kyan"
      />
    )
    const card = screen.getByRole("button", { name: "Ver Ace de kyan" })
    expect(card).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("1:15")).toBeInTheDocument()
    expect(
      container.querySelector('img[src="https://x.test/dust2.webp"]')
    ).not.toBeNull()
    await userEvent.click(card)
    expect(pick).toHaveBeenCalled()
  })

  it("sin foto queda el degradado", () => {
    const { container } = render(
      <ClipCard
        kind="3K"
        who="rei"
        detail="ronda 3"
        onSelect={() => {}}
        label="Ver 3K de rei"
      />
    )
    expect(container.querySelector("img")).toBeNull()
  })

  it("la duración", () => {
    expect(clipDuration(23)).toBe("0:23")
    expect(clipDuration(60.4)).toBe("1:00")
  })
})
