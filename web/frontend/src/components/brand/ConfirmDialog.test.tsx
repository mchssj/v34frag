import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ConfirmDialog, matchesPhrase } from "./ConfirmDialog"

describe("ConfirmDialog", () => {
  it("la frase acepta mayúsculas y espacios en los bordes", () => {
    expect(matchesPhrase("  Estoy Seguro ", "estoy seguro")).toBe(true)
    expect(matchesPhrase("estoy", "estoy seguro")).toBe(false)
  })

  it("con frase, confirma solo después de escribirla y pasa el motivo", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Cerrar la temporada"
        confirmLabel="Cerrar"
        typed="estoy seguro"
        reason={{ label: "Motivo", required: false }}
        pending={false}
        error={null}
        onConfirm={onConfirm}
      />
    )
    const dialog = screen.getByRole("alertdialog", {
      name: "Cerrar la temporada",
    })
    const confirm = screen.getByRole("button", { name: "Cerrar" })
    expect(dialog).toBeInTheDocument()
    expect(confirm).toBeDisabled()

    await user.type(screen.getByLabelText("Motivo"), " fin de año ")
    await user.type(screen.getByLabelText(/para confirmar/), "Estoy seguro")
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith("fin de año")
  })

  it("mientras corre la mutación no se puede cancelar", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Expulsar"
        confirmLabel="Expulsar"
        pending
        error={null}
        onConfirm={() => {}}
      />
    )
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Un momento…" })).toBeDisabled()
  })
})
