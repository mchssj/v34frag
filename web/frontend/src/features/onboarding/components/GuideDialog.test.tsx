import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { guideSteps } from "../lib/guide"
import { GuideDialog } from "./GuideDialog"

function setup() {
  const onClose = vi.fn()
  const onGo = vi.fn()
  render(<GuideDialog open role="user" onClose={onClose} onGo={onGo} />)
  return { onClose, onGo, user: userEvent.setup() }
}

beforeEach(() => localStorage.setItem("csstv.guide-lang", "es"))

describe("GuideDialog", () => {
  it("cambia de idioma y lo recuerda", async () => {
    const { user } = setup()
    await user.click(screen.getByRole("button", { name: "Português" }))
    expect(screen.getByText("Bem-vindo à CM League")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Começar/ })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "English" }))
    expect(screen.getByText("Welcome to CM League")).toBeInTheDocument()
    expect(localStorage.getItem("csstv.guide-lang")).toBe("en")
  })

  it("avanza y vuelve por los pasos", async () => {
    const { user } = setup()
    expect(screen.getByText("Bienvenido a CM League")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Empezar/ }))
    expect(screen.getByText(/ClientMod: el juego/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Anterior/ }))
    expect(screen.getByText("Bienvenido a CM League")).toBeInTheDocument()
  })

  it("Saltar guía la cierra", async () => {
    const { user, onClose } = setup()
    await user.click(screen.getByRole("button", { name: "Saltar guía" }))
    expect(onClose).toHaveBeenCalled()
  })

  it("pregunta por ClientMod y, con No, muestra la descarga", async () => {
    const { user } = setup()
    await user.click(screen.getByRole("button", { name: /Empezar/ }))
    expect(
      screen.queryByRole("link", { name: /Descargar ClientMod/ })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "No" }))
    expect(
      screen.getByRole("link", { name: /Descargar ClientMod/ })
    ).toHaveAttribute("target", "_blank")
    await user.click(screen.getByRole("button", { name: "Sí, lo tengo" }))
    expect(
      screen.queryByRole("link", { name: /Descargar ClientMod/ })
    ).not.toBeInTheDocument()
  })

  it("pregunta por la consola y, con No, explica cómo activarla", async () => {
    const { user } = setup()
    await user.click(screen.getByRole("tab", { name: /Paso 3:/ }))
    await user.click(screen.getByRole("button", { name: "No sé / No" }))
    expect(
      screen.getByText(/Habilitar consola de desarrollador/)
    ).toBeInTheDocument()
  })

  it("Ir a … cierra y navega", async () => {
    const { user, onClose, onGo } = setup()
    await user.click(screen.getByRole("tab", { name: /Paso 4:/ }))
    await user.click(screen.getByRole("button", { name: /Ir a Jugar/ }))
    expect(onClose).toHaveBeenCalled()
    expect(onGo).toHaveBeenCalledWith("/play")
  })

  it("el último paso termina con Listo", async () => {
    const { user, onClose } = setup()
    const total = guideSteps("user").length
    await user.click(
      screen.getByRole("tab", { name: new RegExp(`Paso ${total}:`) })
    )
    await user.click(screen.getByRole("button", { name: "Listo" }))
    expect(onClose).toHaveBeenCalled()
  })
})
