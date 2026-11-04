import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { MapBackdrop } from "./MapBackdrop"

describe("MapBackdrop", () => {
  it("con foto: la imagen de fondo y la franja oscura", () => {
    const { container } = render(
      <MapBackdrop image="https://img.test/nuke.webp">
        <span>9 : 7</span>
      </MapBackdrop>
    )
    const band = container.firstElementChild!
    expect(band).toHaveAttribute("data-photo")
    expect(band).toHaveClass("dark")
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://img.test/nuke.webp"
    )
    expect(screen.getByText("9 : 7")).toBeVisible()
  })

  it("si la foto no carga, queda lisa", () => {
    const { container } = render(
      <MapBackdrop image="https://img.test/rota.webp">
        <span>9 : 7</span>
      </MapBackdrop>
    )
    fireEvent.error(container.querySelector("img")!)
    expect(container.firstElementChild).not.toHaveAttribute("data-photo")
    expect(container.querySelector("img")).toBeNull()
  })

  it("sin foto: lisa", () => {
    const { container } = render(
      <MapBackdrop image={null}>
        <span>9 : 7</span>
      </MapBackdrop>
    )
    expect(container.firstElementChild).not.toHaveAttribute("data-photo")
    expect(container.querySelector("img")).toBeNull()
  })
})
