import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { BackButton } from "./BackButton"

// Tres páginas: el torneo y Partidas llevan a la partida; la partida tiene la flecha de volver.
function setup(start: string) {
  const root = createRootRoute({ component: () => <Outlet /> })
  const page = (path: string, body: () => React.ReactNode) =>
    createRoute({ getParentRoute: () => root, path, component: body })
  const tree = root.addChildren([
    page("/events/t1", () => (
      <>
        <h1>Torneo</h1>
        <Link to={"/match/m1" as never}>Ver partida</Link>
      </>
    )),
    page("/matches", () => <h1>Partidas</h1>),
    page("/match/m1", () => (
      <BackButton
        fallback={{ to: "/matches", search: { kind: "pcw" } }}
        label="PCW"
      />
    )),
  ])
  const router = createRouter({
    routeTree: tree,
    history: createMemoryHistory({ initialEntries: [start] }),
  })
  render(<RouterProvider router={router as never} />)
  return { user: userEvent.setup(), router }
}

describe("BackButton", () => {
  it("si se llegó navegando, vuelve a donde estaba (el torneo, no Partidas)", async () => {
    const { user } = setup("/events/t1")
    await user.click(await screen.findByRole("link", { name: "Ver partida" }))
    const back = await screen.findByRole("link", { name: "Volver" })
    await user.click(back)
    expect(
      await screen.findByRole("heading", { name: "Torneo" })
    ).toBeInTheDocument()
  })

  it("si se entró directo, va a la sección con su nombre", async () => {
    const { user, router } = setup("/match/m1")
    await user.click(await screen.findByRole("link", { name: "PCW" }))
    expect(
      await screen.findByRole("heading", { name: "Partidas" })
    ).toBeInTheDocument()
    expect(router.state.location.search).toEqual({ kind: "pcw" })
  })
})
