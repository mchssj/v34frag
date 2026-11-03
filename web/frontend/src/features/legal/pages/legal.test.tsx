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
import { FaqPage } from "./FaqPage"
import { PrivacyPage } from "./PrivacyPage"
import { SecurityPage } from "./SecurityPage"
import { SupportPage } from "./SupportPage"
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
  const others = [
    "/ayuda",
    "/soporte",
    "/terminos",
    "/privacidad",
    "/seguridad",
  ].map((path) => createRoute({ getParentRoute: () => root, path }))
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
  ["Preguntas frecuentes", FaqPage, 7],
  ["Soporte", SupportPage, 7],
  ["Términos", TermsPage, 22],
  ["Privacidad", PrivacyPage, 13],
  ["Seguridad", SecurityPage, 8],
] as const)("%s", (_, Page, count) => {
  it("tiene una entrada del índice por sección, cada una con su destino", async () => {
    await renderPage(Page)
    const index = screen.getByRole("navigation", { name: "En esta página" })
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

it("el menú lateral lleva a las cinco páginas", async () => {
  await renderPage(FaqPage)
  const menu = screen.getByRole("navigation", { name: "Ayuda y legales" })
  const links = [...menu.querySelectorAll("a")].map((a) => a.textContent)
  expect(links).toEqual([
    "Preguntas frecuentes",
    "Soporte",
    "Términos de uso",
    "Privacidad",
    "Seguridad",
  ])
})
