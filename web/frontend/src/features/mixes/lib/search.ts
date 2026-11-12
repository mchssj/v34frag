import { z } from "zod"

import { STATS_TABS } from "./stats"

// El listado de mixes pasó a Partidas (features/matches). Acá queda el estado de la sala.

/** Sala del mix (/match/$id y /mixes/live/$uid): la pestaña de estadísticas. General no va en la URL. */
export const roomSearchSchema = z.object({
  stats: z.enum(STATS_TABS).optional().catch(undefined),
  /** Serie de torneo o PCW: el juego (mapa) de las estadísticas; vacío = todos los mapas. */
  map: z.uuid().optional().catch(undefined),
  /** (replanteo 83) Partida del matchmaking: abrir la sala en Estadísticas (el aviso de jugadas destacadas);
   *  (replanteo 92) o en la Repetición 2D. */
  view: z.enum(["stats", "replay"]).optional().catch(undefined),
})
export type RoomSearch = z.infer<typeof roomSearchSchema>
