import type { EloValues } from "../types"

type Key = keyof EloValues

type FieldDef = {
  key: Key
  group: string
  label: string
  help: string
  min: number
  max: number
  unit?: string
  decimals?: boolean
}

// Rangos del contrato (admin.md, "ELO (admin)"). Desde el replanteo 100 (bitácora 2026-11-09-elo-por-partida):
// multiplicador por el rating del mix, tope por equipo y mínimo por partida.
export const ELO_FIELDS: FieldDef[] = [
  {
    key: "base",
    group: "Por mix",
    label: "ELO base",
    min: 5,
    max: 100,
    help: "Con equipos parejos y rating 1,00 (la mitad de K).",
  },
  {
    key: "team_cap",
    group: "Por mix",
    label: "Tope por equipo",
    min: 5,
    max: 200,
    help: "Si alguien lo pasa, todo su equipo se achica en proporción.",
  },
  {
    key: "min_delta",
    group: "Por mix",
    label: "Mínimo por partida",
    min: 0,
    max: 100,
    help: "Lo menos que gana o pierde cada uno en un mix terminado.",
  },
  {
    key: "mult_win_min",
    group: "Multiplicador por rating",
    label: "Gana: mínimo",
    min: 0.1,
    max: 1,
    decimals: true,
    help: "Al ganar, el multiplicador es su rating del mix.",
  },
  {
    key: "mult_win_max",
    group: "Multiplicador por rating",
    label: "Gana: máximo",
    min: 1,
    max: 3,
    decimals: true,
    help: "Tope del rating que cuenta al ganar.",
  },
  {
    key: "mult_loss_min",
    group: "Multiplicador por rating",
    label: "Pierde: mínimo",
    min: 0.1,
    max: 1,
    decimals: true,
    help: "Al perder, es 2 − su rating: el que jugó bien pierde menos.",
  },
  {
    key: "mult_loss_max",
    group: "Multiplicador por rating",
    label: "Pierde: máximo",
    min: 1,
    max: 3,
    decimals: true,
    help: "Lo más que pierde el que jugó mal.",
  },
  {
    key: "start_elo",
    group: "Límites",
    label: "ELO inicial",
    min: 100,
    max: 5000,
    help: "Con el que empieza un jugador nuevo.",
  },
  {
    key: "elo_floor",
    group: "Límites",
    label: "ELO mínimo",
    min: 0,
    max: 1000,
    help: "Nadie baja de este valor.",
  },
  {
    key: "min_pct",
    group: "Participación",
    label: "Mínima",
    unit: "%",
    min: 1,
    max: 100,
    help: "Con menos rondas que esto, el ELO no cambia.",
  },
  {
    key: "full_pct",
    group: "Participación",
    label: "Completa",
    unit: "%",
    min: 1,
    max: 100,
    help: "Desde acá cuenta entero; en el medio, proporcional.",
  },
  {
    key: "bonus_max",
    group: "Mixes anteriores a la Temporada 2",
    label: "Tope por rendimiento",
    min: 0,
    max: 20,
    help: "Solo para recalcular mixes viejos: máximo que el rating sumaba o restaba.",
  },
  {
    key: "bonus_factor",
    group: "Mixes anteriores a la Temporada 2",
    label: "Bonus por punto de rating",
    min: 0,
    max: 50,
    decimals: true,
    help: "Solo para recalcular mixes viejos.",
  },
]

/** Un número con coma decimal (0,75). */
export const fmtNum = (n: number) => String(n).replace(".", ",")

export type Draft = Record<Key, string>

/** Valida el borrador con los rangos del contrato. Devuelve los valores o los errores por campo. */
export function parseElo(d: Draft): {
  values: EloValues | null
  errors: Partial<Record<Key, string>>
} {
  const errors: Partial<Record<Key, string>> = {}
  const out: Partial<EloValues> = {}
  for (const f of ELO_FIELDS) {
    const raw = d[f.key].trim().replace(",", ".")
    const n = Number(raw)
    if (!raw || Number.isNaN(n)) errors[f.key] = "Escribe un número."
    else if (!f.decimals && !Number.isInteger(n))
      errors[f.key] = "Tiene que ser un número entero."
    else if (n < f.min || n > f.max)
      errors[f.key] = `Entre ${fmtNum(f.min)} y ${fmtNum(f.max)}.`
    else out[f.key] = n
  }
  if (
    out.start_elo !== undefined &&
    out.elo_floor !== undefined &&
    out.start_elo < out.elo_floor
  )
    errors.start_elo = "No puede ser menor que el ELO mínimo."
  if (
    out.full_pct !== undefined &&
    out.min_pct !== undefined &&
    out.full_pct < out.min_pct
  )
    errors.full_pct = "No puede ser menor que la mínima."
  if (
    out.min_delta !== undefined &&
    out.team_cap !== undefined &&
    out.min_delta > out.team_cap
  )
    errors.min_delta = "No puede pasar el tope por equipo."
  return {
    values: Object.keys(errors).length ? null : (out as EloValues),
    errors,
  }
}
