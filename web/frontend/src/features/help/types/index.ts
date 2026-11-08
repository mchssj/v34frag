// Manual de usuario (plan docs/bitacora/2026-11-02-manual-usuario). La API manda solo lo que ve el rol de la cuenta.

export type ManualSeccionId =
  | "jugador"
  | "capitan"
  | "organizador"
  | "moderador"
  | "admin"
  | "streamer"
  | "servidor-externo"

export type ManualPaginaResumen = {
  tarea: string
  titulo: string
  resumen: string
  /** El cuerpo en texto plano, para el buscador. Solo viene en el índice. */
  texto?: string
}

export type ManualIndice = {
  /** La sección con la que abre la ayuda: la del rol más alto de la cuenta. */
  inicio: ManualSeccionId
  secciones: {
    id: ManualSeccionId
    titulo: string
    paginas: ManualPaginaResumen[]
  }[]
}

export type ManualPagina = ManualPaginaResumen & {
  seccion: ManualSeccionId
  /** Markdown (GFM). Las capturas van como `img/<archivo>`. */
  markdown: string
}
