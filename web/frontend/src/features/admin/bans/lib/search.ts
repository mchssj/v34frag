import { z } from "zod"

// "mm": las sanciones del matchmaking (cola y exclusiones), que no son baneos de los servidores.
export const STATUS_TABS = ["active", "expired", "lifted", "all", "mm"] as const

/** Filtros de la URL de `/admin/bans` (todos opcionales; sin estado = Activos). */
export const banSearchSchema = z.object({
  status: z.enum(STATUS_TABS).optional().catch(undefined),
  source: z.enum(["web", "server", "import"]).optional().catch(undefined),
  server: z.uuid().optional().catch(undefined),
  q: z.string().max(60).optional().catch(undefined),
  sort: z.enum(["recent", "soon"]).optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
  ban: z.uuid().optional().catch(undefined),
})
