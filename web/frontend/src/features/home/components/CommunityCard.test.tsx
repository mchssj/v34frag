import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CommunityCard } from "./SideCards"

describe("CommunityCard", () => {
  it("lleva al Discord y al grupo de Steam en otra pestaña", () => {
    render(<CommunityCard />)
    const card = screen.getByRole("region", { name: "Comunidad" })
    const discord = within(card).getByRole("link", { name: /Discord/ })
    const steam = within(card).getByRole("link", { name: /Grupo de Steam/ })

    expect(discord).toHaveAttribute("href", "https://discord.gg/bn5Yxsh9tc")
    expect(steam).toHaveAttribute(
      "href",
      "https://steamcommunity.com/groups/clientmodleague"
    )
    for (const link of [discord, steam]) {
      expect(link).toHaveAttribute("target", "_blank")
      expect(link).toHaveAttribute("rel", "noopener noreferrer")
      expect(link).toHaveAccessibleName(/abre en otra pestaña/)
    }
  })
})
