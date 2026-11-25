import type { Outcome } from "../types"

export const OUTCOME: Record<Outcome, string> = {
  win: "Victoria",
  loss: "Derrota",
  draw: "Empate",
}

export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0")

const dec = new Intl.NumberFormat("es", { maximumFractionDigits: 2 })
export const num = (n: number) => dec.format(n)
export const pct = (x: number) => `${Math.round(x * 100)} %`

export const deltaClass = (n: number) =>
  n > 0 ? "text-win" : n < 0 ? "text-destructive" : "text-muted-foreground"
