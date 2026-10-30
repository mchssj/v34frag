import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"

import { MapPoolPicker } from "./MapPoolPicker"
import type { MapEntry } from "./queries"

const map = (name: string, position: number, veto = true): MapEntry => ({
  name,
  versions: [name],
  active: true,
  position,
  mixes: true,
  veto_default: veto,
  image_url: null,
})

const maps = [
  map("de_dust2", 1),
  map("de_inferno", 2),
  map("de_nuke", 3),
  map("de_russka", 4, false),
]

function Harness({ min }: { min: number }) {
  const [v, setV] = useState<string[] | null>(null)
  return (
    <MapPoolPicker
      maps={maps}
      value={v}
      onChange={setV}
      minMaps={min}
      kind="torneo"
    />
  )
}

describe("MapPoolPicker", () => {
  it("elegir los mapas arranca con el pool por defecto y suma uno de afuera", () => {
    render(<Harness min={3} />)
    expect(screen.getByText(/3 mapas · mínimo 3/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("radio", { name: /Elegir los mapas/ }))
    expect(screen.getByRole("checkbox", { name: /de_dust2/ })).toBeChecked()
    fireEvent.click(screen.getByRole("checkbox", { name: /de_russka/ }))
    expect(screen.getByText(/4 elegidos/)).toBeInTheDocument()
  })

  it("avisa si faltan mapas para el BO", () => {
    render(<Harness min={5} />)
    expect(screen.getByRole("alert")).toHaveTextContent(/necesita 5/)
  })
})
