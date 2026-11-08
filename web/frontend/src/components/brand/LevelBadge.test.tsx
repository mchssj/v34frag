import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { LevelBadge, levelColor, levelTier } from "./LevelBadge"

describe("LevelBadge (anillo de 10 segmentos)", () => {
  it("el tramo de color de cada nivel", () => {
    expect([1, 2, 3, 4, 7, 8, 9, 10].map(levelTier)).toEqual([
      1, 2, 2, 4, 4, 8, 8, 10,
    ])
    expect(levelColor(5)).toBe("var(--level-4)")
  })

  it("enciende tantos segmentos como el nivel y muestra el número", () => {
    const { container } = render(<LevelBadge level={7} />)
    expect(screen.getByRole("img", { name: "Nivel 7" })).toBeInTheDocument()
    expect(container.querySelectorAll("path")).toHaveLength(10)
    expect(container.querySelectorAll("path[data-on]")).toHaveLength(7)
    expect(container.querySelector("text")).toHaveTextContent("7")
  })

  it("el 10 enciende todo el anillo", () => {
    const { container } = render(<LevelBadge level={10} size={48} />)
    expect(container.querySelectorAll("path[data-on]")).toHaveLength(10)
  })
})
