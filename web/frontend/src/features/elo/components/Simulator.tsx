import { cn } from "cn"
import { useState } from "react"

import { Segmented } from "@/components/brand/Segmented"
import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { simulate } from "../lib/formula"
import { deltaClass, num, OUTCOME, pct, signed } from "../lib/labels"
import type { EloConfig, Outcome } from "../types"
import { weightNote } from "./Ticket"

const TOTAL = 24

/** Cuánto ganarías o perderías en un mix, con la configuración vigente. */
export function Simulator({ config }: { config: EloConfig }) {
  const [outcome, setOutcome] = useState<Outcome>("win")
  const [prob, setProb] = useState(0.5)
  const [rating, setRating] = useState(1.1)
  const [rounds, setRounds] = useState(TOTAL)
  const r = simulate({ outcome, prob, rating, rounds, total: TOTAL }, config)

  return (
    <Card variant="outline" className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
          <h2 className="text-sm font-semibold">Simulador</h2>
          <p className="text-[13px] text-muted-foreground">
            Un mix de {TOTAL} rondas, sin abandonos.
          </p>
        </div>
        <Segmented
          size="sm"
          label="Resultado"
          value={outcome}
          options={(["win", "draw", "loss"] as const).map((o) => ({
            value: o,
            label: OUTCOME[o],
          }))}
          onChange={setOutcome}
        />
      </div>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
        <Control
          label="Probabilidad de ganar"
          show={pct(prob)}
          value={prob}
          range={[0.05, 0.95, 0.01]}
          onChange={setProb}
        />
        <Control
          label="Tu rating"
          show={num(rating)}
          value={rating}
          range={[0.3, 2.2, 0.05]}
          onChange={setRating}
        />
        <Control
          label="Rondas jugadas"
          show={`${rounds} de ${TOTAL}`}
          value={rounds}
          range={[0, TOTAL, 1]}
          onChange={setRounds}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-muted/50 px-4 py-3">
        <span
          aria-live="polite"
          className={cn(
            "font-mono text-3xl font-bold tabular-nums",
            deltaClass(r.delta)
          )}
        >
          {signed(r.delta)}
        </span>
        <span className="min-w-[200px] flex-1 text-[13px] text-pretty text-muted-foreground">
          {r.weight === 0
            ? weightNote(rounds, TOTAL, 0, config)
            : `${num(r.base)} de base × ${num(r.mult)} por tu rating × ${num(r.weight)} por las rondas = ${signed(r.raw)}.`}
          {r.weight > 0 &&
            r.scale < 1 &&
            ` El tope por equipo lo deja en ${signed(r.scaled)}.`}
          {r.weight > 0 &&
            r.delta !== r.scaled &&
            ` El mínimo por mix lo lleva a ${signed(r.delta)}.`}
        </span>
      </div>
    </Card>
  )
}

function Control({
  label,
  show,
  value,
  range: [min, max, step],
  onChange,
}: {
  label: string
  show: string
  value: number
  range: [number, number, number]
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">{show}</span>
      </span>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="py-2"
      />
    </div>
  )
}
