/** Claves de las consultas del shell. Aparte para que otros features las importen sin ciclos. */
export const shellKeys = {
  pcwOpen: ["shell", "pcw-open"] as const,
  match: (id: string) => ["match", id] as const,
  search: (what: "players" | "teams" | "events", q: string) =>
    ["shell", "search", what, q] as const,
}
