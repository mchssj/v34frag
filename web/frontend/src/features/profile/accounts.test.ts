import { describe, expect, it } from "vitest"

import type { SteamStatus } from "@/features/onboarding/queries"
import { claimOutcome, gameAccounts, type SteamRequest } from "./accounts"

const A = "76561198000000001"
const B = "76561198000000002"
const C = "76561198000000003"

function status(over: Partial<SteamStatus> = {}): SteamStatus {
  return {
    steam_ids: [],
    max_steam_ids: 3,
    last_code: null,
    pending_requests: 0,
    ...over,
  }
}

const request = (steam_id: string): SteamRequest => ({
  id: 1,
  kind: "add",
  steam_id,
  nick: "zeta",
  note: null,
  status: "pending",
  reason: null,
  created_at: "2026-10-19T10:00:00Z",
  resolved_at: null,
})

const used = (used_steam_id: string | null, result: string) => ({
  code: "K7P2QX",
  status: "used" as const,
  expires_at: "2026-10-19T10:10:00Z",
  used_at: "2026-10-19T10:01:00Z",
  used_steam_id,
  result,
})

describe("gameAccounts", () => {
  it("sin cuentas: vacío y título de la primera", () => {
    const g = gameAccounts(status(), [])
    expect(g).toMatchObject({ empty: true, linked: 0, max: 3, atLimit: false })
    expect(g.addTitle).toBe("Vincula tu primera cuenta desde el juego")
  })

  it("la principal primero y después las pendientes", () => {
    const g = gameAccounts(
      status({
        steam_ids: [
          {
            steam_id: B,
            is_primary: false,
            added_at: null,
            unlink_pending: false,
          },
          {
            steam_id: A,
            is_primary: true,
            added_at: null,
            unlink_pending: false,
          },
        ],
      }),
      [request(C)]
    )
    expect(g.rows.map((r) => [r.kind, r.steamId])).toEqual([
      ["linked", A],
      ["linked", B],
      ["pending", C],
    ])
    expect(g.linked).toBe(2)
    expect(g.addTitle).toBe("¿Quieres enlazar otro SteamID?")
  })

  it("fecha de vínculo, pedido para desvincular y el único SteamID", () => {
    const only = gameAccounts(
      status({
        steam_ids: [
          {
            steam_id: A,
            is_primary: true,
            added_at: "2026-08-14T15:00:00Z",
            unlink_pending: false,
          },
        ],
      }),
      []
    )
    expect(only.rows[0]).toMatchObject({
      since: "Vinculada ago 2026",
      unlinkPending: false,
      // El único SteamID de la ficha no se puede desvincular.
      canUnlink: false,
    })

    const two = gameAccounts(
      status({
        steam_ids: [
          {
            steam_id: A,
            is_primary: true,
            added_at: null,
            unlink_pending: false,
          },
          {
            steam_id: B,
            is_primary: false,
            added_at: "2024-03-02T10:00:00Z",
            unlink_pending: true,
          },
        ],
      }),
      []
    )
    expect(two.rows[0]).toMatchObject({
      since: "Fecha desconocida",
      canUnlink: true,
    })
    expect(two.rows[1]).toMatchObject({
      since: "Vinculada mar 2024",
      unlinkPending: true,
    })
  })

  it("el tope sale de la API y cuenta las pendientes", () => {
    const linked = [
      { steam_id: A, is_primary: true, added_at: null, unlink_pending: false },
      { steam_id: B, is_primary: false, added_at: null, unlink_pending: false },
    ]
    expect(gameAccounts(status({ steam_ids: linked }), []).atLimit).toBe(false)
    expect(
      gameAccounts(status({ steam_ids: linked }), [request(C)]).atLimit
    ).toBe(true)
    expect(
      gameAccounts(status({ steam_ids: linked, max_steam_ids: 2 }), []).atLimit
    ).toBe(true)
  })
})

describe("claimOutcome", () => {
  it("null mientras el código siga sin usar o sea otro", () => {
    expect(claimOutcome("K7P2QX", status(), [])).toBeNull()
    expect(
      claimOutcome(
        "OTRO00",
        status({ last_code: used(A, "Listo: tu cuenta quedó vinculada") }),
        []
      )
    ).toBeNull()
  })

  it("vinculada al instante", () => {
    expect(
      claimOutcome(
        "K7P2QX",
        status({
          steam_ids: [
            {
              steam_id: A,
              is_primary: true,
              added_at: null,
              unlink_pending: false,
            },
          ],
          last_code: used(A, "Listo: tu cuenta quedó vinculada"),
        }),
        []
      )
    ).toEqual({
      tone: "success",
      title: `Cuenta ${A} vinculada`,
      description: null,
    })
  })

  it("adicional: queda pendiente de un admin", () => {
    expect(
      claimOutcome(
        "K7P2QX",
        status({
          steam_ids: [
            {
              steam_id: A,
              is_primary: true,
              added_at: null,
              unlink_pending: false,
            },
          ],
          last_code: used(B, "Pedido enviado: un admin lo tiene que aprobar"),
        }),
        [request(B)]
      )
    ).toEqual({
      tone: "info",
      title: `Pedido enviado: un admin tiene que aprobar ${B}`,
      description: "Pedido enviado: un admin lo tiene que aprobar",
    })
  })

  it("rechazado por el backend: muestra su mensaje", () => {
    expect(
      claimOutcome(
        "K7P2QX",
        status({ last_code: used(C, "Ese SteamID pertenece a otra cuenta") }),
        []
      )
    ).toEqual({
      tone: "error",
      title: "Ese SteamID pertenece a otra cuenta",
      description: null,
    })
  })
})
