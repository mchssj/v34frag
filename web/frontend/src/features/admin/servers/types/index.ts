import type { Schemas } from "@/api/client"

// Tipos del módulo (los de la API y los propios).

// Administración › Servidores y ELO (contrato admin.md: Servidores, Demos, ELO, ajustes e interrumpidos).

export type AdminServer = Schemas["AdminServer"]

export type ServerToken = Schemas["AdminServerToken"]

export type ServerCreate = Schemas["AdminServerCreate"]

export type ServerPatch = Schemas["AdminServerPatch"]

export type AdminDemo = Schemas["AdminDemo"]

export type DemoStatus = AdminDemo["demo_status"]

export type DemoWorker = Schemas["DemoWorker"]

export type EloValues = Schemas["EloValues"]

export type EloAdjustment = Schemas["EloAdminAdjustment"]

export type PlayerSummary = Schemas["PlayerSummary"]

export type AdjustInput =
  | { player_ids: string[]; delta: number; reason: string }
  | { player_ids: string[]; set_elo: number; reason: string }
