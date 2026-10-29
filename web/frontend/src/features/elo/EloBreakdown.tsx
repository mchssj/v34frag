import { cn } from "cn"
import { CrownIcon, LockIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

import { DEMO_MIXES_RAW, START_ELO, type DemoMix } from "./demo"
import {
  breakdown,
  DEFAULT_CONFIG,
  inputForProb,
  type Breakdown,
  type BreakdownInput,
  type MatchResult,
} from "./formula"

// Desglose de la fórmula de ELO para VIP (docs/bitacora/2026-10-29-desglose-elo en kyan/pruebas).

const cfg = DEFAULT_CONFIG
const signed = (n: number) => (n > 0 ? `+${n}` : String(n))
const pct = (x: number) => `${Math.round(x * 100)} %`
const RESULT: Record<MatchResult, string> = {
  1: "Victoria",
  0: "Derrota",
  0.5: "Empate",
}

/** Encadena el ELO: el de antes de cada mix es el de después del anterior. */
function chain(): (DemoMix & { b: Breakdown })[] {
  let elo = START_ELO
  const out = [...DEMO_MIXES_RAW].reverse().map((m) => {
    const full = { ...m, elo_before: elo }
    const b = breakdown(full)
    elo = b.elo_after
    return { ...full, b }
  })
  return out.reverse()
}

function deltaClass(n: number) {
  return n > 0 ? "text-win" : n < 0 ? "text-primary" : "text-muted-foreground"
}

function Step({
  n,
  title,
  formula,
  value,
  note,
  muted,
}: {
  n: number
  title: string
  formula: ReactNode
  value: ReactNode
  note?: ReactNode
  muted?: boolean
}) {
  return (
    <li
      className={cn(
        "grid grid-cols-[28px_1fr_auto] gap-x-3 gap-y-1 py-3",
        muted && "opacity-50"
      )}
    >
      <span className="grid size-6 place-items-center rounded-full bg-muted font-mono text-xs">
        {n}
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-sm font-medium">{title}</span>
        <code className="font-mono text-xs text-muted-foreground">
          {formula}
        </code>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </span>
      <span className="self-center text-right font-mono text-lg font-semibold tabular-nums">
        {value}
      </span>
    </li>
  )
}

/** Ticket con cada paso del cálculo de un mix. */
export function Ticket({ i, b }: { i: BreakdownInput; b: Breakdown }) {
  const weightNote =
    b.weight === 0
      ? `Jugaste ${i.rounds} de ${i.total_rounds} rondas: menos del ${cfg.min_pct} %, este mix no te mueve el ELO.`
      : b.weight === 1
        ? `Jugaste ${i.rounds} de ${i.total_rounds} rondas: desde el ${cfg.full_pct} % cuenta completo.`
        : `Jugaste ${i.rounds} de ${i.total_rounds} rondas: entre el ${cfg.min_pct} % y el ${cfg.full_pct} %, cuenta la proporción.`
  return (
    <ol className="divide-y">
      <Step
        n={1}
        title="Probabilidad de que ganara tu equipo"
        formula="p = Φ((fuerza tuya − fuerza rival) / incertidumbre)"
        value={pct(b.win_prob)}
        note={
          b.win_prob > 0.6
            ? "Eran favoritos: ganar da menos y perder resta más."
            : b.win_prob < 0.4
              ? "Eran el equipo menos favorito: ganar da más y perder resta menos."
              : "Equipos parejos."
        }
      />
      <Step
        n={2}
        title={`Base por el resultado (${RESULT[i.result]})`}
        formula={`round(2 × ${cfg.base} × (${i.result} − ${b.win_prob.toFixed(2)}))`}
        value={signed(b.base)}
      />
      <Step
        n={3}
        title={`Bonus por rating (${(i.rating ?? 1).toFixed(2)})`}
        formula={`round((${(i.rating ?? 1).toFixed(2)} − 1) × ${cfg.bonus_factor}), tope ±${cfg.bonus_max}`}
        value={signed(b.bonus)}
        note={
          b.bonus !== b.bonus_raw
            ? `Daba ${signed(b.bonus_raw)}, pero el tope es ±${cfg.bonus_max}.`
            : undefined
        }
      />
      <Step
        n={4}
        title="Peso por rondas jugadas"
        formula={`${i.rounds} / ${i.total_rounds} → ${b.weight === 0 || b.weight === 1 ? b.weight : b.weight.toFixed(2)}`}
        value={`× ${b.weight === 0 || b.weight === 1 ? b.weight : b.weight.toFixed(2)}`}
        note={weightNote}
      />
      <Step
        n={5}
        title="Cambio"
        formula={`round((${b.base} ${b.bonus >= 0 ? "+" : "−"} ${Math.abs(b.bonus)}) × ${b.weight === 0 || b.weight === 1 ? b.weight : b.weight.toFixed(2)})`}
        value={signed(b.scaled)}
      />
      <Step
        n={6}
        title="Mínimo ±1"
        formula="El ganador suma al menos 1 y el perdedor resta al menos 1"
        value={b.min_rule ? signed(b.delta) : "-"}
        muted={!b.min_rule}
        note={
          b.min_rule
            ? `La cuenta daba ${signed(b.scaled)}: se lleva a ${signed(b.delta)}.`
            : "No hizo falta."
        }
      />
      <Step
        n={7}
        title="ELO mínimo"
        formula={`El ELO nunca baja de ${cfg.elo_floor}`}
        value={b.floor_rule ? cfg.elo_floor : "-"}
        muted={!b.floor_rule}
      />
      <li className="flex items-center justify-between py-3">
        <span className="font-medium">Resultado</span>
        <span className="font-mono text-lg">
          {i.elo_before} → <strong>{b.elo_after}</strong>{" "}
          <span className={cn("font-semibold", deltaClass(b.delta))}>
            ({signed(b.delta)})
          </span>
        </span>
      </li>
    </ol>
  )
}

function Sim() {
  const [p, setP] = useState([0.5])
  const [rating, setRating] = useState([1.1])
  const [rounds, setRounds] = useState([24])
  const [result, setResult] = useState<MatchResult>(1)
  const i: BreakdownInput = {
    ...inputForProb(p[0]!),
    elo_before: 1500,
    result,
    rating: rating[0]!,
    rounds: rounds[0]!,
    total_rounds: 24,
  }
  const b = breakdown(i)
  return (
    <section className="flex flex-col gap-4 rounded-xl border p-4">
      <div>
        <h2 className="font-heading text-base font-semibold">Simulador</h2>
        <p className="text-sm text-muted-foreground">
          Mové los valores y mirá cómo cambia tu ELO en un mix de 24 rondas.
        </p>
      </div>
      <span className="inline-flex self-start rounded-lg border p-0.5">
        {([1, 0.5, 0] as MatchResult[]).map((r) => (
          <Button
            key={r}
            size="sm"
            variant={result === r ? "secondary" : "ghost"}
            aria-pressed={result === r}
            onClick={() => setResult(r)}
          >
            {RESULT[r]}
          </Button>
        ))}
      </span>
      {(
        [
          ["Probabilidad de ganar", p, setP, 0.01, 0.99, 0.01, pct(p[0]!)],
          ["Rating", rating, setRating, 0.3, 2.2, 0.01, rating[0]!.toFixed(2)],
          ["Rondas jugadas", rounds, setRounds, 0, 24, 1, `${rounds[0]} de 24`],
        ] as const
      ).map(([label, v, set, min, max, step, show]) => (
        <label key={label} className="flex flex-col gap-2 text-sm">
          <span className="flex justify-between">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-mono">{show}</span>
          </span>
          <Slider
            aria-label={label}
            min={min}
            max={max}
            step={step}
            value={[...v]}
            onValueChange={set}
          />
        </label>
      ))}
      <div className="rounded-lg bg-muted/40 px-3">
        <Ticket i={i} b={b} />
      </div>
    </section>
  )
}

// Los mixes de la demo no cambian: se encadenan una sola vez.
const MIXES = chain()

export function EloBreakdown({ vip }: { vip: boolean }) {
  const mixes = MIXES
  const [sel, setSel] = useState(mixes[0]!.id)
  const m = mixes.find((x) => x.id === sel) ?? mixes[0]!
  const total = mixes.reduce((s, x) => s + x.b.delta, 0)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-base font-semibold">
            Tus últimos mixes
          </h2>
          <span className="text-xs text-muted-foreground">
            Total:{" "}
            <span className={cn("font-mono font-semibold", deltaClass(total))}>
              {signed(total)}
            </span>
          </span>
        </div>
        <ul className="flex flex-col gap-1">
          {mixes.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                aria-pressed={x.id === m.id}
                onClick={() => setSel(x.id)}
                className={cn(
                  "grid w-full grid-cols-[84px_1fr_auto_56px] items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/50",
                  x.id === m.id && "border-primary bg-muted/50"
                )}
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {x.date}
                </span>
                <span>
                  {x.map}{" "}
                  <span className="text-muted-foreground">
                    · {RESULT[x.result]}
                  </span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {x.score[0]}–{x.score[1]}
                </span>
                <span
                  className={cn(
                    "text-right font-mono font-semibold",
                    deltaClass(x.b.delta)
                  )}
                >
                  {signed(x.b.delta)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative flex flex-col gap-2 rounded-xl border p-4">
        <h2 className="font-heading text-base font-semibold">
          {m.map} · {m.date}
        </h2>
        <p className="text-sm text-muted-foreground">{m.note}</p>
        <div
          className={cn(!vip && "pointer-events-none blur-[3px] select-none")}
          aria-hidden={!vip}
        >
          <Ticket i={m} b={m.b} />
        </div>
        {!vip && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex max-w-sm flex-col items-center gap-2 rounded-xl border bg-background/95 p-5 text-center shadow-lg">
              <CrownIcon aria-hidden className="size-6 text-amber-400" />
              <p className="font-semibold">El desglose es para VIP</p>
              <p className="text-sm text-muted-foreground">
                Mirá paso por paso por qué ganaste o perdiste cada punto:
                probabilidad, rating y rondas jugadas.
              </p>
              <LockIcon aria-hidden className="size-4 text-muted-foreground" />
            </div>
          </div>
        )}
      </section>

      {vip && (
        <div className="lg:col-span-2">
          <Sim />
        </div>
      )}
    </div>
  )
}
