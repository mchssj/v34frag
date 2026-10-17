import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { THEME_STORAGE_KEY, ThemeProvider } from "@/components/theme-provider"
import { ThemeSwitch } from "./ThemeSwitch"

// jsdom no trae matchMedia; el provider lo usa para el modo Sistema.
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
}))

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ""
})

describe("ThemeSwitch", () => {
  it("marca Sistema por defecto y cambia y guarda el tema elegido", async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemeSwitch />
      </ThemeProvider>
    )
    expect(screen.getByRole("group", { name: "Tema" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sistema" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )

    await user.click(screen.getByRole("button", { name: "Oscuro" }))
    expect(screen.getByRole("button", { name: "Oscuro" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "Sistema" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    expect(document.documentElement).toHaveClass("dark")
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark")
  })
})
