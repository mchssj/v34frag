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

// Rangos del contrato (admin.md, "ELO (admin)").
export const ELO_FIELDS: FieldDef[] = [
  {
    key: "base",
    group: "Por mix",
    label: "ELO base",
    min: 5,
    max: 100,
    help: "Lo que gana o pierde cada uno con equipos parejos.",
  },
  {
    key: "bonus_max",
    group: "Por mix",
    label: "Tope por rendimiento",
    min: 0,
    max: 20,
    help: "Máximo que el rating suma o resta.",
  },
  {
    key: "bonus_factor",
    group: "Por mix",
    label: "Bonus por punto de rating",
    min: 0,
    max: 50,
    decimals: true,
    help: "Por cada 1,00 de rating sobre o bajo 1,00.",
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
]

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
      errors[f.key] = `Entre ${f.min} y ${f.max}.`
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
  return {
    values: Object.keys(errors).length ? null : (out as EloValues),
    errors,
  }
}
