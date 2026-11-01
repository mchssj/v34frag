import type { Schemas } from "@/api/client"

// Tipos del módulo (los de la API y los propios).

// Equipos: Mi equipo, vista pública, Crear y Buscar (handoff_equipo). Bitácoras 2026-10-24-equipo y
// 2026-10-29-equipo-torneos-api-frontend.

export type TeamDetail = Schemas["TeamDetail"]

export type TeamSummary = Schemas["TeamSummary"]

export type RosterEntry = Schemas["RosterEntry"]

export type TeamInvite = Schemas["Invite"]

export type TeamRequest = Schemas["TeamRequest"]

export type MatchSummary = Schemas["MatchSummary"]

export type PlayerSummary = Schemas["PlayerSummary"]

export type MyTeamEntry = Schemas["MyTeam"]

export type TeamEvent = Schemas["TeamEvent"]

export type RosterStatusValue = Schemas["InviteBody"]["role"]
