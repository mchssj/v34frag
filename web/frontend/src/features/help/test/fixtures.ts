import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, vi } from "vitest"

import type { ManualIndice, ManualPagina } from "../types"

// Servidor de MSW y datos de las pruebas de la ayuda.
export const API = "http://api.test"
export const server = setupServer()

export function setupApi() {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
  afterEach(() => {
    server.resetHandlers()
    vi.clearAllMocks()
  })
  afterAll(() => server.close())
}

export const indice: ManualIndice = {
  inicio: "organizador",
  secciones: [
    {
      id: "jugador",
      titulo: "Jugador",
      paginas: [
        {
          tarea: "vincular-steamid",
          titulo: "Vincular tu SteamID",
          resumen: "El !claim en el servidor.",
          texto: "Escribe !claim y el código en el chat de la partida.",
        },
        {
          tarea: "buscar-partida",
          titulo: "Buscar partida",
          resumen: "Solo o en grupo, aceptar y el veto.",
          texto: "Toca Buscar partida. Si un compañero se desconecta, escribe !callreplace en el chat del servidor.",
        },
      ],
    },
    {
      id: "organizador",
      titulo: "Organizador de torneo",
      paginas: [
        {
          tarea: "iniciar-partida",
          titulo: "Iniciar una partida",
          resumen: "Elegir un servidor libre.",
          texto: "Con el veto hecho, el servidor pone la contraseña.",
        },
      ],
    },
  ],
}

export const pagina: ManualPagina = {
  seccion: "jugador",
  tarea: "buscar-partida",
  titulo: "Buscar partida",
  resumen: "Solo o en grupo, aceptar y el veto.",
  markdown: [
    "Entra a [Jugar](/play) y toca **Buscar partida**.",
    "",
    "> **Ojo:** si no aceptas a tiempo, pierdes el lugar.",
    "",
    "| Paso | Qué haces |",
    "|---|---|",
    "| 1 | Aceptar |",
    "",
    "Más en [Vincular](/help/jugador/vincular-steamid), [Discord](https://discord.gg/x) y [raro](javascript:alert(1)).",
    "",
    "![El botón](img/buscar.webp)",
  ].join("\n"),
}

export const handlers = {
  indice: (body: ManualIndice = indice) =>
    http.get(`${API}/api/v1/manual`, () => HttpResponse.json(body)),
  pagina: () =>
    http.get(`${API}/api/v1/manual/jugador/buscar-partida`, () =>
      HttpResponse.json(pagina)
    ),
  imagen: () =>
    http.get(
      `${API}/api/v1/manual/jugador/img/buscar.webp`,
      () =>
        new HttpResponse(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "image/webp" },
        })
    ),
  noExiste: (path: string) =>
    http.get(`${API}/api/v1/manual/${path}`, () =>
      HttpResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "No existe esa página del manual.",
            requestId: "r",
          },
        },
        { status: 404 }
      )
    ),
}
