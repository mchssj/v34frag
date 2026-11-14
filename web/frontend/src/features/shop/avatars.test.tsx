import { screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { renderWithQuery } from "@/test/render"

import { AVATAR_BATCH, loadPlayerAvatar } from "./avatars"

// El avatar puesto en lugar de la foto en toda la web (bitácora 2026-11-14-avatar-en-toda-la-web).

const API = "http://api.test"
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const id = (n: number) =>
  `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`
const avatar = {
  id: "custom",
  kind: "avatar" as const,
  name: "Avatar propio",
  file: null,
  css_class: null,
  animated: true,
  vip_only: true,
  url: "https://db.test/storage/v1/object/public/cosmetics/u/avatar-1.webm",
  poster_url:
    "https://db.test/storage/v1/object/public/cosmetics/u/avatar-1.webp",
}

/** Responde que solo `con` tiene avatar puesto y anota cada pedido. */
function cosmetics(con: string, asked: string[][]) {
  return http.get(`${API}/api/v1/cosmetics`, ({ request }) => {
    const ids = new URL(request.url).searchParams.get("players")!.split(",")
    asked.push(ids)
    return HttpResponse.json({
      items: ids
        .filter((x) => x === con)
        .map((x) => ({
          player_id: x,
          vip: true,
          frame: null,
          avatar,
          name: null,
          background: null,
          theme: null,
          stickers: [],
        })),
    })
  })
}

describe("el avatar puesto en lugar de la foto", () => {
  it("las fotos de una pantalla se piden juntas; con avatar se ve el avatar, sin avatar la foto", async () => {
    const asked: string[][] = []
    server.use(cosmetics(id(1), asked))
    const { container } = renderWithQuery(
      <ul>
        <PlayerAvatar alias="ana" photo="/ana.png" playerId={id(1)} />
        <PlayerAvatar alias="beto" photo="/beto.png" playerId={id(2)} />
        <PlayerAvatar alias="caro" photo={null} playerId={id(3)} />
      </ul>
    )
    // En jsdom no hay medidas: la foto es "chica" y el avatar se ve quieto (su imagen fija).
    await screen.findByText(
      (_, el) => el?.getAttribute("src") === avatar.poster_url
    )
    expect(asked).toHaveLength(1)
    expect(asked[0]!.sort()).toEqual([id(1), id(2), id(3)])
    expect(container.querySelectorAll("video")).toHaveLength(0)
    expect(screen.getByText("C")).toBeInTheDocument() // caro, sin foto ni avatar: la inicial
  })

  it("sin id de ficha no se pide nada y se ve la foto de siempre", async () => {
    const asked: string[][] = []
    server.use(cosmetics(id(1), asked))
    renderWithQuery(<PlayerAvatar alias="dani" photo={null} />)
    expect(await screen.findByText("D")).toBeInTheDocument()
    await new Promise((ok) => setTimeout(ok, 20))
    expect(asked).toHaveLength(0)
  })

  it(`más de ${AVATAR_BATCH} fichas van en pedidos de a ${AVATAR_BATCH}`, async () => {
    const asked: string[][] = []
    server.use(cosmetics(id(150), asked))
    const all = await Promise.all(
      Array.from({ length: 150 }, (_, i) => loadPlayerAvatar(id(i + 1)))
    )
    expect(asked.map((a) => a.length)).toEqual([AVATAR_BATCH, 50])
    expect(all.filter(Boolean)).toHaveLength(1)
    expect(all[149]).toMatchObject({ url: avatar.url })
  })
})
