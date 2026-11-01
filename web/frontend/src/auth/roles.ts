import type { Role } from "./queries"

export const ROLE_LABEL: Record<Role, string> = {
  user: "Usuario",
  organizer: "Organizador",
  moderator: "Moderador",
  admin: "Admin",
}
