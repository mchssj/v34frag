import type { ServerStatus } from "../types"

type ServerMode = NonNullable<ServerStatus["mode"]>

export const SERVER_MODE: Record<ServerMode, string> = {
  mix: "Mix",
  competitive: "Competitivo",
  public: "Público",
  deathmatch: "Deathmatch",
  retakes: "Retakes",
  practice: "Práctica",
}

/** Servidor para el `connect` del `!claim`: uno de mix en línea; si no hay, cualquiera en línea. */
export function claimServer(servers: ServerStatus[]): ServerStatus | null {
  const reachable = servers.filter((s) => s.online && s.address)
  return reachable.find((s) => s.mode === "mix") ?? reachable[0] ?? null
}

const numberFormat = new Intl.NumberFormat("es-AR")

export const formatNumber = (n: number) => numberFormat.format(n)

/** Copy de mixes reportados: "Más de 1.800" redondeando a centenas, o el número exacto si es chico. */
export function mixesCopy(total: number): { title: string; subtitle: string } {
  const amount =
    total > 100
      ? `Más de ${formatNumber(Math.floor((total - 1) / 100) * 100)}`
      : formatNumber(total)
  return {
    title: `${amount} mixes reportados por el servidor.`,
    subtitle: "Cada uno suma al ELO de quienes jugaron.",
  }
}

/** Nombre de un bando: el equipo si lo hay, si no el nombre del bando. */
// Tipo estructural: el generado para `team` es un allOf nullable difícil de usar.
export function sideName(side: {
  name: string | null
  team: { name: string } | null
}): string {
  return side.team?.name ?? side.name ?? "Por definir"
}
