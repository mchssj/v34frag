import { act, screen, within } from "@testing-library/react"
import type { AnchorHTMLAttributes, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithQuery } from "@/test/render"
import { alertInvite } from "./alert"
import { createDemoSource } from "./demo"
import { buildSlots, slotOrder } from "./GroupSlots"
import { PlayPage } from "./PlayPage"
import { MmSourceContext } from "./source"

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))
vi.mock("./alert", () => ({
  alertMatchFound: vi.fn(),
  alertInvite: vi.fn(),
  askNotificationPermission: vi.fn(),
  unlockAudio: vi.fn(),
  useAudioReady: () => true,
}))
// "Partidas en vivo" es un Link: sin router en la prueba, alcanza con un <a>.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...rest
  }: { to: string; children: ReactNode } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "href"
  >) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

function setup() {
  const demo = createDemoSource({ random: () => 0.5 })
  const view = renderWithQuery(
    <MmSourceContext value={demo.source}>
      <PlayPage />
    </MmSourceContext>
  )
  return { ...demo, ...view }
}

async function flush(ms = 600) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

const searchButton = () =>
  screen.findByRole("button", { name: "Buscar partida" })

describe("Mi grupo", () => {
  it("los lugares van del medio hacia afuera", () => {
    expect(slotOrder(5)).toEqual([2, 1, 3, 0, 4])
    expect(slotOrder(2)).toEqual([1, 0])
    expect(slotOrder(1)).toEqual([0])
  })
})

describe("PlayPage (con la demo)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => vi.useRealTimers())

  it("muestra el grupo, el ELO y la barra de abajo", async () => {
    setup()
    expect(await screen.findByText("tu.nick")).toBeInTheDocument()
    expect(
      screen.getByText((_, el) => el?.textContent === "+141 para el nivel 9")
    ).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "5v5" })).toBeChecked()
    // 1v1 está apagado en la configuración de la demo: no se ofrece.
    expect(screen.queryByRole("radio", { name: "1v1" })).toBeNull()
    expect(screen.getByRole("radio", { name: "Público" })).toBeChecked()
    expect(screen.getByText("No hay invitaciones")).toBeInTheDocument()
    // Dúo: un lugar para invitar; los otros 3 los llena la cola.
    expect(
      screen.getAllByRole("button", { name: "Invitar a un amigo" })
    ).toHaveLength(1)
    expect(screen.getAllByText("Se completa con la cola")).toHaveLength(3)
  })

  it("en 2v2 hay dos lugares", async () => {
    const { user } = setup()
    await user.click(await screen.findByRole("radio", { name: "2v2" }))
    expect(screen.queryAllByText("Se completa con la cola")).toHaveLength(0)
    expect(
      screen.getAllByRole("button", { name: "Invitar a un amigo" })
    ).toHaveLength(1)
  })

  it("entra a la cola, acepta y llega a la sala con el servidor", async () => {
    const { user, controls } = setup()
    await user.click(await searchButton())
    expect(
      await screen.findByRole("button", { name: "Cancelar" })
    ).toBeInTheDocument()

    await act(async () => controls.skip())
    await flush()
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Partida encontrada")).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: "Aceptar" }))
    expect(
      await within(dialog).findByRole("button", { name: "Aceptada" })
    ).toBeDisabled()

    // Los demás aceptan, el veto termina, se busca servidor y se asigna.
    await act(async () => {
      controls.skip()
      controls.skip()
      controls.skip()
    })
    await flush()
    expect(
      await screen.findByText("Preparando el servidor")
    ).toBeInTheDocument()
    expect(screen.getByText(/CM League #1/)).toBeInTheDocument()
    expect(screen.getByLabelText("Contraseña oculta")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Conectar/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/^steam:\/\/connect\/45\.235\.98\.12:27062\//)
    )
  })

  it("el capitán banea en su turno y el resto ve el veto", async () => {
    const { user, controls } = setup()
    await user.click(await searchButton())
    await act(async () => {
      controls.skip()
      controls.skip()
    })
    await flush()
    expect(await screen.findByText("Veto de mapas")).toBeInTheDocument()

    // Con random fijo, el equipo B tiene menos ELO y empieza; su capitán (nacho) es un bot.
    expect(screen.getByText("Banea nacho (Equipo B).")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Banear / })).toBeNull()

    await flush(4000)
    expect(
      await screen.findByText("Tu turno: baneá un mapa.")
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Banear Nuke" }))
    expect(
      await screen.findByRole("button", { name: "Nuke, baneado por Equipo A" })
    ).toBeDisabled()
  })

  it("arma un dúo invitando por nick", async () => {
    const { user } = setup()
    await user.click(
      await screen.findByRole("button", { name: "Invitar a un amigo" })
    )
    await user.type(screen.getByLabelText("Buscar jugador por nick"), "ma")
    await user.click(await screen.findByRole("button", { name: /maxi/ }))
    expect(
      await screen.findByText("maxi", { selector: "strong" })
    ).toBeInTheDocument()
    await flush(3500)
    // maxi aceptó: ya es una tarjeta del grupo y no queda lugar para invitar.
    expect(await screen.findByText("maxi")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Invitar a un amigo" })
    ).toBeNull()
    expect(
      screen.getByRole("button", { name: "Salir del grupo" })
    ).toBeInTheDocument()
  })

  it("rechaza invitar a alguien con mucha diferencia de ELO", async () => {
    const { user } = setup()
    const { toast } = await import("sonner")
    await user.click(
      await screen.findByRole("button", { name: "Invitar a un amigo" })
    )
    await user.type(screen.getByLabelText("Buscar jugador por nick"), "nico")
    await user.click(await screen.findByRole("button", { name: /nico\.dlr/ }))
    expect(toast.error).toHaveBeenCalledWith(
      "La diferencia de ELO con nico.dlr es mayor a 500"
    )
  })

  it("una invitación abre el popup con sonido, y aceptarla arma el grupo", async () => {
    const { user, controls } = setup()
    await screen.findByText("tu.nick")
    await act(async () => controls.receiveInvite())
    await flush()
    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByText("Te invitaron a un grupo")
    ).toBeInTheDocument()
    expect(within(dialog).getByText("colo")).toBeInTheDocument()
    expect(alertInvite).toHaveBeenCalledWith("colo")

    await user.click(within(dialog).getByRole("button", { name: "Aceptar" }))
    expect(
      await screen.findByText("colo es el líder y busca por el grupo.")
    ).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("en Privado no llegan invitaciones", async () => {
    const { user, controls } = setup()
    await user.click(await screen.findByRole("radio", { name: "Privado" }))
    expect(
      await screen.findByText("Nadie te puede invitar")
    ).toBeInTheDocument()
    await act(async () => controls.receiveInvite())
    await flush()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("con los servidores ocupados no arma la sala y lo avisa", async () => {
    const { user, controls } = setup()
    await act(async () => controls.setFlag("serversBusy", true))
    await user.click(await searchButton())
    expect(
      await screen.findByText(/Todos los servidores están ocupados/)
    ).toBeInTheDocument()
    expect(screen.getByText("Servidores: 0 de 1 libres")).toBeInTheDocument()
    await flush(9000)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("una cuenta nueva no puede buscar y ve cuánto le falta", async () => {
    const { controls } = setup()
    await screen.findByText("tu.nick")
    await act(async () => controls.setFlag("newcomer", true))
    expect(
      await screen.findByText("Te faltan 2 mixes para jugar matchmaking")
    ).toBeInTheDocument()
    expect(await searchButton()).toBeDisabled()
  })

  it("avisa el cierre de temporada", async () => {
    const { controls } = setup()
    await screen.findByText("tu.nick")
    await act(async () => controls.setFlag("season", true))
    expect(
      await screen.findByText(/La temporada cierra en/)
    ).toBeInTheDocument()
  })

  it("2v2 avisa que no da ELO", async () => {
    const { user } = setup()
    await user.click(await screen.findByRole("radio", { name: "2v2" }))
    expect(
      screen.getByText("2v2 no da ELO: sirve para practicar")
    ).toBeInTheDocument()
  })

  it("en la sala: chat, reportar y desconexión de un compañero", async () => {
    const { user, controls } = setup()
    await user.click(await searchButton())
    await act(async () => {
      controls.skip() // sala
      controls.skip() // veto
      controls.skip() // queda un mapa
    })
    await flush()

    // Chat a todos y al equipo, en el panel que abre el ícono de la barra.
    await user.click(screen.getByRole("button", { name: "Chat de la sala" }))
    await user.type(screen.getByLabelText("Mensaje"), "vamos")
    await user.click(screen.getByRole("button", { name: "Enviar" }))
    expect(await screen.findByText("vamos")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Todos" }))
    await user.type(screen.getByLabelText("Mensaje"), "yo voy B")
    await user.click(screen.getByRole("button", { name: "Enviar" }))
    expect(await screen.findByText("yo voy B")).toBeInTheDocument()
    expect(
      within(screen.getByRole("list", { name: "Mensajes" })).getByText("Equipo")
    ).toBeInTheDocument()
    await user.keyboard("{Escape}")

    // Reportar a un jugador: después queda deshabilitado.
    await user.click(screen.getByRole("button", { name: "Reportar a gordo" }))
    await user.click(screen.getByRole("radio", { name: "Tóxico" }))
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }))
    expect(
      await screen.findByRole("button", { name: "Ya reportaste a gordo" })
    ).toBeDisabled()

    // Partida en vivo y un compañero se desconecta.
    await act(async () => {
      controls.skip() // servidor asignado
      controls.skip() // conectando
      controls.skip() // en vivo
    })
    await flush()
    // Las estadísticas son postpartido: en vivo la pestaña está deshabilitada.
    expect(screen.getByRole("tab", { name: "Estadísticas" })).toBeDisabled()
    await act(async () => controls.teammateLeaves())
    await flush()
    expect(
      await screen.findByText(
        /Se desconectó · 3:00 para volver|Se desconectó · 2:5\d para volver/
      )
    ).toBeInTheDocument()
    await flush(3 * 60_000 + 1000)
    expect(await screen.findByText(/^Abandonó:/)).toBeInTheDocument()
  })

  it("sala terminada: estadísticas, MVP, clips y volver a Jugar", async () => {
    const { user, controls } = setup()
    await user.click(await searchButton())
    await act(async () => {
      for (let i = 0; i < 7; i++) controls.skip() // hasta la partida en vivo
    })
    await flush()
    await act(async () => controls.finish())
    await flush()

    expect(await screen.findByText("Ganador")).toBeInTheDocument()
    expect(screen.getByText("Ver demo")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Estadísticas" }))
    expect(screen.getByRole("region", { name: "MVP" })).toBeInTheDocument()
    expect(screen.getByText("Más kills")).toBeInTheDocument()
    expect(
      screen.getByText("Lo más destacado de la partida")
    ).toBeInTheDocument()
    expect(screen.getByText("Jugada de la partida")).toBeInTheDocument()

    // Por jugadores: una sola tabla con los 10.
    await user.click(
      screen.getByRole("button", { name: "Ordenar por jugadores" })
    )
    expect(screen.getAllByRole("table")).toHaveLength(1)

    // Sigue a la vista aunque la API ya no la devuelva, hasta volver a Jugar.
    await flush(7000)
    expect(
      screen.getByRole("region", { name: "Sala de la partida" })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Descripción general" }))
    await user.click(screen.getByRole("button", { name: "Volver a Jugar" }))
    expect(await searchButton()).toBeInTheDocument()
  })

  it("grupo: el líder pasa el liderazgo y saca a alguien; salir pide confirmación", async () => {
    const { user, controls, source } = setup()
    // Arma un dúo con maxi.
    await user.click(
      await screen.findByRole("button", { name: "Invitar a un amigo" })
    )
    await user.type(screen.getByLabelText("Buscar jugador por nick"), "ma")
    await user.click(await screen.findByRole("button", { name: /maxi/ }))
    await flush(3500)

    // Hacer líder a maxi.
    await user.click(
      await screen.findByRole("button", { name: "Opciones de maxi" })
    )
    await user.click(screen.getByRole("menuitem", { name: "Hacer líder" }))
    await flush()
    expect(
      (await source.state()).party?.members.find((m) => m.nick === "maxi")
        ?.is_leader
    ).toBe(true)
    // Ya no es líder: no puede sacar a nadie.
    expect(
      screen.queryByRole("button", { name: "Opciones de maxi" })
    ).toBeNull()

    // Salir pide confirmación.
    await user.click(screen.getByRole("button", { name: "Salir del grupo" }))
    expect(screen.getByText("¿Salir del grupo?")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Cancelar" }))
    expect((await source.state()).party).not.toBeNull()

    // El compañero se va: aviso y el grupo desaparece.
    await act(async () => controls.partnerLeavesParty())
    await flush()
    const { toast } = await import("sonner")
    expect(toast).toHaveBeenCalledWith(
      "Ya no estás en el grupo: el líder te sacó o el grupo se deshizo"
    )
    expect(screen.queryByRole("button", { name: "Salir del grupo" })).toBeNull()
  })

  it("el líder saca al compañero", async () => {
    const { user, source } = setup()
    await user.click(
      await screen.findByRole("button", { name: "Invitar a un amigo" })
    )
    await user.type(screen.getByLabelText("Buscar jugador por nick"), "ju")
    await user.click(await screen.findByRole("button", { name: /juanchi/ }))
    await flush(3500)
    await user.click(
      await screen.findByRole("button", { name: "Opciones de juanchi" })
    )
    await user.click(screen.getByRole("menuitem", { name: "Sacar del grupo" }))
    expect(screen.getByText("¿Sacar a juanchi del grupo?")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Sacar del grupo" }))
    await flush()
    expect((await source.state()).party).toBeNull()
  })

  it("rechazar la partida deja una sanción", async () => {
    const { user, controls } = setup()
    await user.click(await searchButton())
    await act(async () => controls.skip())
    await flush()
    await user.click(await screen.findByRole("button", { name: "Rechazar" }))
    expect(
      await screen.findByText("No podés entrar a la cola por ahora")
    ).toBeInTheDocument()
  })
})

describe("buildSlots", () => {
  it("con un grupo de 2 y una invitación pendiente no deja lugar para invitar", async () => {
    const { source } = createDemoSource({ random: () => 0.5 })
    const state = await source.state()
    const slots = buildSlots(
      {
        ...state,
        max_party_size: 3,
        party: {
          id: "x",
          max_size: 3,
          pending: { to_nick: "colo", expires_at: new Date().toISOString() },
          members: [
            {
              player_id: "me",
              nick: "tu.nick",
              level: 7,
              elo: 1610,
              is_me: true,
              is_leader: true,
            },
            {
              player_id: "p",
              nick: "maxi",
              level: 8,
              elo: 1750,
              is_me: false,
              is_leader: false,
            },
          ],
        },
      },
      5
    )
    expect(slots.map((s) => s.kind)).toEqual([
      "queue",
      "member",
      "member",
      "pending",
      "queue",
    ])
  })
})
