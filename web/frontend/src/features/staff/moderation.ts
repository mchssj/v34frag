import type { Schemas } from "@/api/client"

// Quiénes somos › Moderación (replanteo 117).

type Member = Schemas["Staff"]["admins"][number]

export type ModRole = "moderator" | "support"

/**
 * Moderación (replanteo 117): los moderadores y los de soporte juntos, por nick (Daniel, 2026-11-13). Sin `supports`
 * (una API de antes), solo los moderadores.
 */
export function moderationTeam(s: {
  moderators: Member[]
  supports?: Member[]
}): { m: Member; role: ModRole }[] {
  return [
    ...s.moderators.map((m) => ({ m, role: "moderator" as ModRole })),
    ...(s.supports ?? []).map((m) => ({ m, role: "support" as ModRole })),
  ].sort((a, b) =>
    a.m.nick.localeCompare(b.m.nick, "es", { sensitivity: "base" })
  )
}

/** "2 moderadores y 1 de soporte". */
export function moderationCount(mods: number, supports: number): string {
  const m = mods === 1 ? "1 moderador" : `${mods} moderadores`
  const s = `${supports} de soporte`
  if (supports === 0) return m
  if (mods === 0) return s
  return `${m} y ${s}`
}
