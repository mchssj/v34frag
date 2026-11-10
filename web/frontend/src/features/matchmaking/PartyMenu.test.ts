import { toast } from "sonner"
import { describe, expect, it, vi } from "vitest"

import { noticePartyDisbanded } from "./PartyMenu"

vi.mock("sonner", () => ({ toast: { warning: vi.fn() } }))

// Replanteo 105 (bitácora 2026-11-09-mm-grupo-maximo): el aviso cuando el grupo se desarma porque bajó el máximo.
describe("noticePartyDisbanded", () => {
  it("con 1 dice que se juega sin grupos y, si buscaban, que salió de la cola", () => {
    noticePartyDisbanded({ max: 1, queued: true })
    expect(toast.warning).toHaveBeenLastCalledWith(
      "Se desarmó tu grupo: ahora se juega sin grupos",
      { description: "Saliste de la cola: vuelve a buscar solo." }
    )
  })
  it("con otro máximo lo nombra, sin la línea de la cola", () => {
    noticePartyDisbanded({ max: 2, queued: false })
    expect(toast.warning).toHaveBeenLastCalledWith(
      "Se desarmó tu grupo: ahora el máximo es de 2 por grupo",
      { description: undefined }
    )
  })
})
