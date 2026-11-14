import type { Schemas } from "@/api/client"

// Tipos del módulo (los de la API y los propios).

// Administración › Usuarios: cuentas (alias, rol, VIP y la marca de streamer del HUD) y palabras bloqueadas.

export type AdminUser = Schemas["AdminUser"]

export type BlockedHit = Schemas["BlockedHit"]

export type VipGrant = Schemas["VipGrant"]

export type Streamer = Schemas["Streamer"]

export type SettableRole = "user" | "organizer" | "support" | "moderator"

export type AccountFilter =
  | "all"
  | "admin"
  | "moderator"
  | "support"
  | "organizer"
  | "streamer"
  | "noplayer"
