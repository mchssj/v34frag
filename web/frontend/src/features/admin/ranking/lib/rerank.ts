export const MAX_POINTS = 1000

type TopTeam = { team: { id: string; name: string }; won: number; lost: number }

/** El top de torneos con otros puntos por victoria (mismo desempate que la API: victorias y derrotas). */
export function rerank<T extends TopTeam>(items: T[], perWin: number) {
  return items
    .map((t) => ({ ...t, newPoints: t.won * perWin }))
    .sort(
      (a, b) => b.newPoints - a.newPoints || b.won - a.won || a.lost - b.lost
    )
}
