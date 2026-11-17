import type { Schemas } from "@/api/client"

// Códigos canjeables para sorteos (replanteo 126, bitácora 2026-11-16-codigos-canjeables): formato y textos.

export type CodePrize = Pick<
  Schemas["CodePrize"],
  "reward" | "item" | "amount" | "days"
>
export type CodeState = Schemas["AdminCode"]["state"]

/**
 * Da formato a lo que escribe o pega el jugador: en mayúsculas y, si empieza con CML, con los guiones de
 * `CML-XXXX-XXXX-XXXX`. Un código personalizado (`NAVIDAD-2026`) queda como lo escribió, en mayúsculas.
 */
export function formatCode(raw: string): string {
  const up = raw.toUpperCase().replace(/[^A-Z0-9\s-]/g, "")
  const flat = up.replace(/[\s-]/g, "")
  if (flat.startsWith("CML")) {
    const groups = flat.slice(3, 15).match(/.{1,4}/g) ?? []
    return ["CML", ...groups].join("-")
  }
  return up.replace(/\s+/g, " ").trimStart().slice(0, 30)
}

/** Lo que tiene que tener para mandarlo: un código CML completo o uno personalizado de 8 o más letras y números. */
export function codeReady(code: string): boolean {
  const flat = code.replace(/[\s-]/g, "")
  return flat.startsWith("CML") ? flat.length === 15 : flat.length >= 8
}

const num = (n: number) => n.toLocaleString("es")

/** El premio en palabras: "Marco Mira por 7 días", "500 puntos", "VIP por 30 días". */
export function prizeText(p: CodePrize): string {
  switch (p.reward) {
    case "item":
      return `${p.item?.name ?? "Un artículo"} ${p.days ? `por ${daysText(p.days)}` : "para siempre"}`
    case "points":
      return `${num(p.amount ?? 0)} puntos`
    case "vip_coins":
      return `${num(p.amount ?? 0)} monedas VIP`
    case "vip":
      return `VIP por ${daysText(p.days ?? 0)}`
  }
}

export const daysText = (d: number) => (d === 1 ? "1 día" : `${num(d)} días`)

/** Cuánto le queda: "Vence en 5 días", "Vence hoy" o "Venció el 12 nov.". */
export function untilText(until: string, now = Date.now()): string {
  const t = Date.parse(until)
  if (t <= now)
    return `Venció el ${new Date(t).toLocaleDateString("es", { day: "numeric", month: "short" })}`
  const days = Math.floor((t - now) / 86_400_000)
  return days < 1 ? "Vence hoy" : `Vence en ${daysText(days)}`
}

/** Minutos que faltan, para el bloqueo por intentos ("15 minutos", "3 horas"). */
export function waitText(seconds: number): string {
  const m = Math.ceil(seconds / 60)
  if (m < 60) return m === 1 ? "1 minuto" : `${m} minutos`
  const h = Math.ceil(m / 60)
  return h === 1 ? "1 hora" : `${h} horas`
}

export const STATE_LABEL: Record<CodeState, string> = {
  scheduled: "Programado",
  active: "Activo",
  used_up: "Agotado",
  expired: "Vencido",
  revoked: "Revocado",
}

/** CSV de los códigos de un lote, para bajar (el código y el premio, una fila por código). */
export function codesCsv(
  codes: { code: string }[],
  prize: string,
  label: string
): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`
  return [
    "codigo,premio,sorteo",
    ...codes.map((c) => [c.code, prize, label].map(q).join(",")),
  ].join("\n")
}
