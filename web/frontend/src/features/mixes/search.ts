import { z } from "zod"

import { STATS_TABS } from "./stats"

// El listado de mixes pasó a Partidas (features/matches). Acá queda el estado de la sala.

/** Sala del mix (/match/$id y /mixes/live/$uid): la pestaña de estadísticas. General no va en la URL. */
export const roomSearchSchema = z.object({
  stats: z.enum(STATS_TABS).optional().catch(undefined),
})
export type RoomSearch = z.infer<typeof roomSearchSchema>
