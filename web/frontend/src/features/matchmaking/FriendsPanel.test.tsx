import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithQuery } from "@/test/render"
import { createDemoSource } from "./demo"
import { FriendsPanel } from "./FriendsPanel"
import { MmSourceContext } from "./source"
import type { MmFriend } from "./types"

const friend = (nick: string, i: number): MmFriend => ({
  player_id: `p${i}`,
  nick,
  level: 4,
  status: null,
})

function setup(nicks: string[]) {
  const { source } = createDemoSource({ random: () => 0.5 })
  return renderWithQuery(
    <MmSourceContext value={source}>
      <FriendsPanel friends={nicks.map(friend)} />
    </MmSourceContext>
  )
}

const rows = () =>
  within(screen.getByRole("list", { name: "Tus amigos" })).getAllByRole(
    "listitem"
  )

describe("FriendsPanel", () => {
  it("con 3 amigos o menos no muestra el buscador", () => {
    setup(["daniloev", "flowwww", "inst"])
    expect(screen.queryByLabelText("Buscar entre tus amigos")).toBeNull()
    expect(rows()).toHaveLength(3)
  })

  it("con más de 3, filtra por nick sin distinguir mayúsculas ni tildes", async () => {
    const { user } = setup(["daniloev", "flowwww", "inst", "Juanmá^.^", "mew"])
    expect(rows()).toHaveLength(5)
    const search = screen.getByLabelText("Buscar entre tus amigos")
    await user.type(search, "JUANMA")
    expect(rows().map((r) => r.textContent)).toEqual([
      expect.stringContaining("Juanmá^.^"),
    ])
    await user.clear(search)
    await user.type(search, "zzz")
    expect(screen.getByText("Ningún amigo con ese nick.")).toBeInTheDocument()
  })

  it("el buscador para sumar amigos queda aparte", () => {
    setup(["a1", "b2", "c3", "d4"])
    expect(
      screen.getByLabelText("Buscar a quién sumar a amigos")
    ).toHaveAttribute("placeholder", "Sumar amigo por nick")
  })
})
