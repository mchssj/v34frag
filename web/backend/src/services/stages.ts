// Nombre de la fase de una partida de torneo, para mostrar ("Semifinal", "Grupo B · fecha 2"…).

export type StageInfo = { stage: string | null; phase: number | null; grp: number | null; round: number | null };

/** Última ronda de cada (fase, etapa), para saber cuál es la final. Clave: `${stage}:${phase}`. */
export function lastRounds(rows: StageInfo[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    if (!r.stage || r.round === null) continue;
    const k = `${r.stage}:${r.phase ?? 1}`;
    out.set(k, Math.max(out.get(k) ?? 0, r.round));
  }
  return out;
}

export function stageLabel(m: StageInfo, last: Map<string, number>): string | null {
  if (!m.stage) return null;
  const round = m.round ?? 1;
  const max = last.get(`${m.stage}:${m.phase ?? 1}`) ?? round;
  switch (m.stage) {
    case 'ko': {
      const d = max - round;
      return d === 0 ? 'Final' : d === 1 ? 'Semifinal' : d === 2 ? 'Cuartos de final' : d === 3 ? 'Octavos de final' : `Ronda ${round}`;
    }
    case 'third':
      return 'Tercer puesto';
    case 'upper':
      return round === max ? 'Final del upper' : `Upper · ronda ${round}`;
    case 'lower':
      return round === max ? 'Final del lower' : `Lower · ronda ${round}`;
    case 'grand':
      return 'Gran final';
    case 'group':
      return `Grupo ${String.fromCharCode(64 + (m.grp ?? 1))} · fecha ${round}`;
    case 'swiss':
      return `Suizo · fase ${m.phase ?? 1} · ronda ${round}`;
    default:
      return m.stage;
  }
}
