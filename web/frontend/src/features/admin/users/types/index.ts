import type { Schemas } from "@/api/client"

// Tipos del módulo (los de la API y los propios).

// Administración › Usuarios: cuentas (alias, rol, VIP y la marca de streamer del HUD) y palabras bloqueadas.

export type AdminUser = Schemas["AdminUser"]

export type BlockedHit = Schemas["BlockedHit"]

// Correos temporales bloqueados (replanteo 148, docs/bitacora/2026-11-26-correos-bloqueados).
export type EmailDomain = Schemas["EmailDomain"]
export type EmailDomainAccount = Schemas["EmailDomainAccount"]
/** Filtro de la lista: todos, los de la lista pública, los agregados por un admin o las excepciones. */
export type EmailDomainFilter = "all" | "lista" | "admin" | "exceptions"

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
