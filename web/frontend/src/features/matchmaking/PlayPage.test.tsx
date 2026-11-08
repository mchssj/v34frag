import { act, screen, waitFor, within } from "@testing-library/react"
import type { AnchorHTMLAttributes, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import { renderWithQuery } from "@/test/render"
import { alertFriend, alertInvite } from "./alert"
import { createDemoSource } from "./demo"
import { buildSlots, slotOrder } from "./GroupSlots"
import { PlayPage } from "./PlayPage"
import { ReconnectBanner } from "./ReconnectBanner"
import { MmSourceContext } from "./source"

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}))
vi.mock("./alert", () => ({
  alertMatchFound: vi.fn(),
  alertInvite: vi.fn(),
  alertFriend: vi.fn(),
  previewSound: vi.fn(),
  alertServerReady: vi.fn(),
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
    <TooltipProvider>
      <MmSourceContext value={demo.source}>
        <PlayPage />
      </MmSourceContext>
    </TooltipProvider>
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

  it("buscando, avisa en Discord y después espera los 15 minutos", async () => {
    const { user } = setup()
    await user.click(await searchButton())
    const avisar = await screen.findByRole("button", {
      name: "Avisar en Discord",
    })
    await waitFor(() => expect(avisar).toBeEnabled())
    expect(
      screen.getByText("Le avisa al rol @player que hay gente buscando")
    ).toBeInTheDocument()
    await user.click(avisar)
    expect(
      await screen.findByText(
        /Ya se avisó hace poco: el próximo aviso, en 1[45]:/
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Avisar en Discord" })
    ).toBeDisabled()
  })

  it("si cerró la web buscando, al volver Jugar le dice por qué ya no busca", async () => {
    const { user, controls } = setup()
    await user.click(await searchButton())
    await screen.findByRole("button", { name: "Avisar en Discord" })
    act(() => controls.closeWeb())
    expect(
      await screen.findByText("Te sacamos de la cola porque cerraste la web")
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Entendido" }))
    expect(
      screen.queryByText("Te sacamos de la cola porque cerraste la web")
    ).toBeNull()
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
    expect(screen.getAllByText(/CM League #1/).length).toBeGreaterThan(0)
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
      await screen.findByText("Tu turno: banea un mapa.")
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
    await user.click(
      await screen.findByRole("button", {
        name: /^(?!Invitar|Sacar|Eliminar).*maxi/,
      })
    )
    expect(
      await screen.findByText("maxi", { selector: "strong" })
    ).toBeInTheDocument()
    await flush(3500)
    // maxi aceptó: ya es una tarjeta del grupo y no queda lugar para invitar.
    expect(
      await screen.findByRole("button", { name: "Opciones de maxi" })
    ).toBeInTheDocument()
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

  it("sin el agente no deja buscar; apagado en el admin, sí", async () => {
    const { controls, source } = setup()
    await screen.findByText("tu.nick")
    expect(screen.getByText("Anticheat activo")).toBeInTheDocument()
    await act(async () => controls.setFlag("noAgent", true))
    expect(
      await screen.findByText("Para jugar necesitas el anticheat activo")
    ).toBeInTheDocument()
    expect(await searchButton()).toBeDisabled()

    const config = await source.adminConfig()
    await act(async () => {
      await source.saveConfig({ ...config, require_anticheat: false })
    })
    expect(
      await screen.findByText("Anticheat no obligatorio")
    ).toBeInTheDocument()
    expect(await searchButton()).toBeEnabled()
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

    // Chat general y chat de equipo, cada uno por su lado.
    await user.type(screen.getByLabelText("Mensaje a todos"), "vamos")
    await user.click(screen.getByRole("button", { name: "Enviar a todos" }))
    const general = screen.getByRole("region", { name: "Chat general" })
    expect(await within(general).findByText("vamos")).toBeInTheDocument()
    await user.type(screen.getByLabelText("Mensaje a tu equipo"), "yo voy B")
    await user.click(screen.getByRole("button", { name: "Enviar a tu equipo" }))
    const equipo = screen.getByRole("region", { name: "Chat de equipo" })
    expect(await within(equipo).findByText("yo voy B")).toBeInTheDocument()
    expect(within(general).queryByText("yo voy B")).toBeNull()

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
      for (let i = 0; i < 6; i++) controls.skip() // hasta la partida en vivo
    })
    await flush()
    expect(
      await screen.findByRole("region", { name: "Sala de la partida" })
    ).toBeInTheDocument()
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

    // Las mismas tablas de Mixes, una por equipo.
    expect(screen.getAllByRole("table")).toHaveLength(2)

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
    await user.click(
      await screen.findByRole("button", {
        name: /^(?!Invitar|Sacar|Eliminar).*maxi/,
      })
    )
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
    await user.click(
      await screen.findByRole("button", {
        name: /^(?!Invitar|Sacar|Eliminar).*juanchi/,
      })
    )
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

  it("muestra con quién ya jugaste y lleva a la partida", async () => {
    const { user, controls } = setup()
    await user.click(await searchButton())
    await act(async () => {
      controls.skip()
      controls.skip()
      controls.skip()
    })
    await flush()
    const nacho = screen.getAllByRole("button", {
      name: /^Jugaste \d+ (con|contra) nacho$/,
    })
    expect(nacho.length).toBeGreaterThan(0)
    // Quien no jugó nunca contigo no muestra nada.
    expect(
      screen.queryByRole("button", { name: /^Jugaste \d+ (con|contra) gordo$/ })
    ).toBeNull()
    await user.click(nacho[0]!)
    expect(
      (await screen.findAllByRole("link", { name: /:/ })).length
    ).toBeGreaterThan(0)
  })

  it("muestra la probabilidad de ganar, el ELO en juego y sugiere qué banear", async () => {
    const { user, controls } = setup()
    await screen.findByText("tu.nick")
    await act(async () => controls.setFlag("captain", true))
    await user.click(await searchButton())
    await act(async () => {
      controls.skip()
      controls.skip()
    })
    // El rival banea primero: después es tu turno.
    await flush(4000)
    expect(
      await screen.findByRole("img", { name: /Probabilidad de ganar/ })
    ).toBeInTheDocument()
    expect(screen.getByText(/En juego:/)).toBeInTheDocument()
    expect(screen.getByText(/Te conviene banear/)).toBeInTheDocument()
  })

  it("al terminar: resumen, felicitar una vez y jugar de nuevo", async () => {
    const { user, controls } = setup()
    await user.click(await searchButton())
    await act(async () => {
      for (let i = 0; i < 6; i++) controls.skip()
    })
    await flush()
    await act(async () => controls.finish())
    await flush()
    expect(await screen.findByText("Tu partida")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Felicitar a nacho" }))
    expect(
      await screen.findByRole("button", { name: "Felicitaste a nacho" })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Felicitar a lauti" })
    ).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Jugar de nuevo" }))
    expect(
      await screen.findByRole("button", { name: "Cancelar" })
    ).toBeInTheDocument()
  })

  it("el bloqueo es de VIP, de 1 solo, y te lo manda al otro equipo", async () => {
    const { user, controls, source } = setup()
    await user.type(
      await screen.findByLabelText("Buscar a quién bloquear"),
      "lau"
    )
    await user.click(
      await screen.findByRole("button", { name: "Bloquear a lauti" })
    )
    expect(
      await screen.findByRole("button", { name: "Sacar el bloqueo a lauti" })
    ).toBeInTheDocument()
    expect(screen.queryByLabelText("Buscar a quién bloquear")).toBeNull()

    await user.click(await searchButton())
    await act(async () => controls.skip())
    await flush()
    const players = (await source.state()).lobby!.players
    const team = (n: string) => players.find((p) => p.nick === n)!.team
    expect(team("lauti")).not.toBe(team("tu.nick"))
  })

  it("sin VIP el bloqueo está cerrado", async () => {
    const { controls } = setup()
    await screen.findByText("tu.nick")
    await act(async () => controls.setFlag("notVip", true))
    expect(await screen.findByText("Exclusivo para VIP")).toBeInTheDocument()
  })

  it("si te desconectas, el aviso aparece y se va cuando vuelves", async () => {
    const demo = createDemoSource({ random: () => 0.5 })
    renderWithQuery(
      <MmSourceContext value={demo.source}>
        <ReconnectBanner />
      </MmSourceContext>
    )
    await demo.source.join("5v5", null)
    for (let i = 0; i < 10; i++) {
      if ((await demo.source.state()).lobby?.status === "live") break
      await act(async () => demo.controls.skip())
      await flush()
    }
    await act(async () => demo.controls.meLeaves())
    await flush()
    expect(
      await screen.findByText("Te desconectaste de la partida")
    ).toBeInTheDocument()
    await act(async () => demo.controls.meLeaves())
    await flush()
    expect(screen.queryByText("Te desconectaste de la partida")).toBeNull()
  })

  it("muestra la cola, las sanciones y avisa si un amigo busca", async () => {
    const { controls, user } = setup()
    await act(async () =>
      (
        await screen.findByRole("button", {
          name: "Ver quiénes están buscando partida",
        })
      ).focus()
    )
    await flush(1000)
    expect((await screen.findAllByText("faltan 4")).length).toBeGreaterThan(0)
    expect(
      screen.getByText("Baneo del servidor", { exact: false })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Invitar a maxi al grupo" })
    ).toBeInTheDocument()
    // (replanteo 85) Todos los amigos muestran su estado, y la solicitud recibida se acepta desde el panel.
    expect(screen.getByText("Desconectado")).toBeInTheDocument()
    await act(async () => controls.friendRequest())
    await flush()
    const received = await screen.findByRole("group", {
      name: "Solicitudes recibidas",
    })
    await user.click(
      within(received).getByRole("button", { name: /^Aceptar la solicitud/ })
    )
    await flush()
    expect(
      screen.queryByRole("group", { name: "Solicitudes recibidas" })
    ).not.toBeInTheDocument()
    await act(async () => controls.friendSearches())
    await flush()
    expect(alertFriend).toHaveBeenCalledWith("maxi")
    expect(await screen.findByText("Buscando partida")).toBeInTheDocument()
  })

  it("eligen un sonido de los admins, y subir uno propio es de VIP", async () => {
    const { user, controls, source } = setup()
    await user.click(
      await screen.findByRole("button", { name: "Configuración" })
    )
    await user.click(await screen.findByRole("button", { name: "Campana" }))
    await flush()
    const state = await source.state()
    expect(state.sounds.selected).toBe("snd-campana")
    expect(state.sounds.url).toMatch(/^data:audio/)

    await user.upload(
      screen.getByLabelText("Archivo de tu sonido"),
      new File(["x"], "mio.mp3", { type: "audio/mpeg" })
    )
    await flush()
    expect((await source.state()).sounds.custom?.name).toBe("mio.mp3")

    await act(async () => controls.setFlag("notVip", true))
    await flush()
    expect(await screen.findByText(/exclusivo para VIP/)).toBeInTheDocument()
    // Sin VIP vuelve al predeterminado: su sonido deja de usarse.
    expect((await source.state()).sounds.selected).toBeNull()
  })

  it("si otro no acepta, avisa que se canceló y que volviste a la cola", async () => {
    const { user, controls } = setup()
    await user.click(await searchButton())
    await act(async () => controls.skip())
    await flush()
    await user.click(await screen.findByRole("button", { name: "Aceptar" }))
    await act(async () => controls.someoneDeclines())
    await flush()
    const { toast } = await import("sonner")
    expect(toast.warning).toHaveBeenCalledWith(
      "La partida se canceló: Un jugador no aceptó a tiempo",
      { description: "Si aceptaste, volviste a la cola con tu lugar." }
    )
    expect(screen.queryByText("Partida encontrada")).toBeNull()
  })

  it("al volver a Jugar después de una partida: Jugar primero y la pestaña Tu última partida", async () => {
    const demo = createDemoSource({ random: () => 0.5 })
    await demo.source.join("5v5", null)
    for (let i = 0; i < 10; i++) {
      if ((await demo.source.state()).lobby?.status === "live") break
      demo.controls.skip()
    }
    demo.controls.finish()
    const { user } = renderWithQuery(
      <TooltipProvider>
        <MmSourceContext value={demo.source}>
          <PlayPage />
        </MmSourceContext>
      </TooltipProvider>
    )
    expect(await searchButton()).toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "Sala de la partida" })
    ).toBeNull()
    await user.click(screen.getByRole("tab", { name: "Tu última partida" }))
    expect(await screen.findByText("Ganador")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Jugar" }))
    expect(await searchButton()).toBeInTheDocument()
  })

  it("rechazar la partida deja una sanción", async () => {
    const { user, controls } = setup()
    await user.click(await searchButton())
    await act(async () => controls.skip())
    await flush()
    await user.click(await screen.findByRole("button", { name: "Rechazar" }))
    expect(
      await screen.findByText("No puedes entrar a la cola por ahora")
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
