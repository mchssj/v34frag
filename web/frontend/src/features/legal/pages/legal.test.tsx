import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PrivacyPage } from "./PrivacyPage"
import { TermsPage } from "./TermsPage"

// jsdom no trae matchMedia; el provider lo usa para el modo Sistema.
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
}))

async function renderPage(Page: () => React.JSX.Element) {
  const root = createRootRoute()
  const page = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: Page,
  })
  // Rutas vacías para que los Link entre páginas resuelvan.
  const others = ["/terminos", "/privacidad"].map((path) =>
    createRoute({ getParentRoute: () => root, path })
  )
  const router = createRouter({
    routeTree: root.addChildren([page, ...others]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
  render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  )
  await screen.findByRole("heading", { level: 1 })
}

describe.each([
  ["Términos", TermsPage, 22],
  ["Privacidad", PrivacyPage, 13],
] as const)("%s", (_, Page, count) => {
  it("tiene una entrada del índice por sección, cada una con su destino", async () => {
    await renderPage(Page)
    const index = screen.getByRole("navigation", { name: "Índice" })
    const entries = index.querySelectorAll("a")
    expect(entries).toHaveLength(count)
    expect(document.querySelectorAll("main section")).toHaveLength(count)
  })

  it("no tiene enlaces internos rotos", async () => {
    await renderPage(Page)
    const broken = [
      ...document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'),
    ]
      .map((a) => a.getAttribute("href")!.slice(1))
      .filter((id) => !document.getElementById(id))
    expect(broken).toEqual([])
  })
})
