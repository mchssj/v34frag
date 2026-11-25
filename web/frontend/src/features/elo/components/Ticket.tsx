import { cn } from "cn"
import type { ReactNode } from "react"

import { deltaClass, num, OUTCOME, pct, signed } from "../lib/labels"
import type { EloConfig, EloMix, EloSteps } from "../types"

// Los pasos de la cuenta del ELO de un mix (bitácora 2026-11-24-desglose-elo-vip). Los números los manda la base.

export function Step({
  n,
  title,
  note,
  value,
  muted,
}: {
  n: number
  title: string
  note?: ReactNode
  value: ReactNode
  /** El paso no cambió nada en este mix. */
  muted?: boolean
}) {
  return (
    <li
      className={cn(
        "grid grid-cols-[24px_1fr_auto] gap-x-3 py-2.5",
        muted && "opacity-55"
      )}
    >
      <span
        aria-hidden
        className="grid size-6 place-items-center rounded-full bg-muted font-mono text-xs"
      >
        {n}
      </span>
      <span className="flex flex-col gap-0.5 self-center">
        <span className="text-sm font-medium">{title}</span>
        {note && (
          <span className="text-xs text-pretty text-muted-foreground">
            {note}
          </span>
        )}
      </span>
      <span className="self-center text-right font-mono text-base font-semibold tabular-nums">
        {value}
      </span>
    </li>
  )
}

export const favoriteNote = (p: number) =>
  p > 0.6
    ? "Eran favoritos: ganar da menos y perder resta más."
    : p < 0.4
      ? "El favorito era el otro equipo: ganar da más y perder resta menos."
      : "Equipos parejos."

export const weightNote = (
  rounds: number,
  total: number,
  weight: number,
  c: EloConfig
) =>
  weight === 0
    ? `${rounds} de ${total} rondas: con menos del ${c.min_pct} %, el mix no te mueve el ELO.`
    : weight === 1
      ? `${rounds} de ${total} rondas: desde el ${c.full_pct} % cuenta completo.`
      : `${rounds} de ${total} rondas: cuenta en proporción.`

const multNote = (s: EloSteps, c: EloConfig) =>
  s.counted_as === "draw"
    ? "En un empate, el rating no cambia nada."
    : s.counted_as === "win"
      ? `Al ganar, tu rating del mix (${num(s.rating ?? 1)}), entre ${num(c.mult_win_min)} y ${num(c.mult_win_max)}.`
      : `Al perder, 2 menos tu rating del mix (${num(s.rating ?? 1)}), entre ${num(c.mult_loss_min)} y ${num(c.mult_loss_max)}: jugar bien resta menos.`

export function Ticket({ mix, config }: { mix: EloMix; config: EloConfig }) {
  const s = mix.steps
  if (!s)
    return (
      <p className="py-8 text-center text-[13px] text-muted-foreground">
        Este mix es de antes de la Temporada 2, con otra fórmula: no tiene
        desglose.
      </p>
    )
  if (!s.exact)
    return (
      <p className="py-8 text-center text-[13px] text-pretty text-muted-foreground">
        La configuración del ELO cambió después de este mix, así que la cuenta
        de hoy no da lo mismo. Tu cambio fue{" "}
        <b className={deltaClass(mix.elo_delta)}>{signed(mix.elo_delta)}</b>.
      </p>
    )
  if (s.abandoned)
    return (
      <ol className="divide-y">
        <Step
          n={1}
          title="Abandono"
          note={`Jugaste ${s.rounds} de ${s.total_rounds} rondas. El abandono tiene su propia cuenta: depende de cuánto faltaba y de si tu equipo ganó, y no mira tu rating.`}
          value={signed(s.adjusted)}
        />
        <Total mix={mix} />
      </ol>
    )
  return (
    <ol className="divide-y">
      <Step
        n={1}
        title="Probabilidad de que ganara tu equipo"
        note={favoriteNote(s.win_prob)}
        value={pct(s.win_prob)}
      />
      <Step
        n={2}
        title={`Base por ${OUTCOME[s.counted_as].toLowerCase()}`}
        note={`2 × ${config.base} × (${num(s.counted_as === "win" ? 1 : s.counted_as === "loss" ? 0 : 0.5)} − ${num(s.win_prob)})`}
        value={num(s.base)}
      />
      <Step
        n={3}
        title="Multiplicador por tu rating"
        note={multNote(s, config)}
        value={`× ${num(s.mult)}`}
      />
      <Step
        n={4}
        title="Rondas que jugaste"
        note={weightNote(s.rounds, s.total_rounds, s.weight, config)}
        value={`× ${num(s.weight)}`}
      />
      <Step
        n={5}
        title="Cambio"
        note={`${num(s.base)} × ${num(s.mult)} × ${num(s.weight)}, redondeado.`}
        value={signed(s.raw)}
      />
      <Step
        n={6}
        title="Abandono o rendición"
        note={
          s.adjusted === s.raw
            ? "No hubo."
            : `La cuenta daba ${signed(s.raw)} y se ajustó porque alguien abandonó.`
        }
        value={s.adjusted === s.raw ? "—" : signed(s.adjusted)}
        muted={s.adjusted === s.raw}
      />
      <Step
        n={7}
        title="Tope por equipo"
        note={
          s.scale < 1
            ? `Alguien de tu equipo pasaba de ${config.team_cap}: todos se achican en la misma proporción (× ${num(s.scale)}).`
            : `Nadie de tu equipo pasó de ${config.team_cap}.`
        }
        value={s.scale < 1 ? signed(s.scaled) : "—"}
        muted={s.scale >= 1}
      />
      <Step
        n={8}
        title="Mínimo por mix"
        note={
          s.after_min !== s.scaled
            ? `La cuenta daba ${signed(s.scaled)}; el mínimo de este mix es ${s.min}.`
            : "No hizo falta."
        }
        value={s.after_min !== s.scaled ? signed(s.after_min) : "—"}
        muted={s.after_min === s.scaled}
      />
      {s.floor_hit && (
        <Step
          n={9}
          title="ELO mínimo"
          note="El ELO no baja de ahí."
          value={config.elo_floor}
        />
      )}
      <Total mix={mix} />
    </ol>
  )
}

function Total({ mix }: { mix: EloMix }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <span className="text-sm font-semibold">Resultado</span>
      <span className="font-mono text-base tabular-nums">
        {mix.elo_before} → <b>{mix.elo_after}</b>{" "}
        <span className={cn("font-semibold", deltaClass(mix.elo_delta))}>
          ({signed(mix.elo_delta)})
        </span>
      </span>
    </li>
  )
}
