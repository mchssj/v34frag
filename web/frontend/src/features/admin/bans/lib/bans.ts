import type { Tone } from "../../lib/format"
import type { Ban, BanStatus } from "../types"
import { endOfDayIso } from "../../lib/format"

// Reglas de la sección Baneos que no dependen de React.

export const BAN_STATUS: Record<BanStatus, { label: string; tone: Tone }> = {
  active: { label: "Activo", tone: "danger" },
  expired: { label: "Vencido", tone: "neutral" },
  lifted: { label: "Levantado", tone: "neutral" },
}

/** Nombre a mostrar: el alias de la ficha, el último nick del SteamID o el SteamID. */
export const banLabel = (b: Ban) =>
  b.player?.alias ?? b.nick ?? b.steam_id ?? "—"

/** Origen para la lista: chip y, debajo, quién lo puso. */
export function banOrigin(b: Ban): { label: string; tone: Tone; by: string } {
  const who = b.created_by?.alias ?? "—"
  if (b.source === "server")
    return {
      label: `!ban · ${b.server?.name ?? "servidor"}`,
      tone: "primary",
      by: who,
    }
  if (b.source === "import")
    return { label: "Importado", tone: "warn", by: "Servidores viejos" }
  return { label: "Web", tone: "neutral", by: who }
}

/** Origen y autor en una frase, para "Qué pasó". */
export function banAuthor(b: Ban): string {
  const who = b.created_by?.alias ?? "—"
  if (b.source === "import")
    return "Importado de los banned_user.cfg de los servidores."
  return b.source === "server"
    ? `Con !ban en ${b.server?.name ?? "el servidor"}, por ${who} (admin del juego).`
    : `Desde la web, por ${who}.`
}

export type BanStep = {
  title: string
  at: string | null
  text: string
  tone: "danger" | "win" | "muted"
  /** Baneo nuevo que reemplazó a este. */
  replacedBy?: string
}

/** "Qué pasó": cuándo se puso y cómo terminó (o cuándo termina). */
export function banSteps(b: Ban): BanStep[] {
  const steps: BanStep[] = [
    { title: "Baneado", at: b.created_at, text: banAuthor(b), tone: "danger" },
  ]
  const by = b.lifted?.by?.alias ?? "—"
  if (b.status === "lifted" && b.lifted?.replaced_by)
    steps.push({
      title: "Reemplazado",
      at: b.lifted.at,
      text: `${by} le puso un baneo nuevo y este quedó levantado.`,
      tone: "muted",
      replacedBy: b.lifted.replaced_by,
    })
  else if (b.status === "lifted")
    steps.push({
      title: "Levantado",
      at: b.lifted?.at ?? null,
      text: `Por ${by}${b.lifted?.reason ? `: ${b.lifted.reason}` : "."}`,
      tone: "win",
    })
  else if (b.status === "expired")
    steps.push({
      title: "Venció",
      at: b.expires_at,
      text: "Puede volver a entrar.",
      tone: "win",
    })
  else if (b.permanent)
    steps.push({
      title: "No vence",
      at: null,
      text: "Hasta que un admin lo levante.",
      tone: "muted",
    })
  else
    steps.push({
      title: "Vence",
      at: b.expires_at,
      text: "Después puede volver a entrar solo, sin que nadie haga nada.",
      tone: "muted",
    })
  return steps
}

/**
 * Cambiar o levantar: solo uno activo, y uno permanente solo si se pueden tocar los permanentes. El soporte
 * (`supportUserId`, replanteo 117), solo los que puso él.
 */
export const canEditBan = (
  b: Ban,
  canPermanent: boolean,
  supportUserId?: string
) =>
  b.status === "active" &&
  (canPermanent || !b.permanent) &&
  (!supportUserId || b.created_by?.id === supportUserId)

/** Lo más largo que banea el soporte, en minutos (replanteo 117). */
export const SUPPORT_BAN_MAX_MINUTES = 120

/** Baneos de soporte por jugador en 7 días. */
export const SUPPORT_WEEKLY_BANS = 3

/** ¿Es un número entero de minutos válido para el soporte (1 a 120)? */
export const validBanMinutes = (m: number) =>
  Number.isInteger(m) && m >= 1 && m <= SUPPORT_BAN_MAX_MINUTES

/** Hasta dónde puede llegar un baneo de soporte al cambiarlo: 120 minutos desde que se puso. */
export const supportBanLimit = (b: Pick<Ban, "created_at">) =>
  new Date(new Date(b.created_at).getTime() + SUPPORT_BAN_MAX_MINUTES * 60_000)

/** "Te queda 1 de 3" / "No te quedan baneos" para el formulario del soporte. */
export function supportQuotaText(remaining: number): string {
  if (remaining <= 0)
    return `Ya tiene ${SUPPORT_WEEKLY_BANS} baneos de soporte en los últimos 7 días: pásale el caso a un moderador.`
  return remaining === 1
    ? `Le queda 1 baneo de soporte de ${SUPPORT_WEEKLY_BANS} esta semana.`
    : `Le quedan ${remaining} baneos de soporte de ${SUPPORT_WEEKLY_BANS} esta semana.`
}

/** Días ("7"), unas horas a elección, hasta una fecha o permanente. */
export type Duration = "hours" | "1" | "3" | "7" | "30" | "date" | "perm"

/** Horas que se pueden poner en un baneo por horas; para más, los días o una fecha. */
export const BAN_MAX_HOURS = 72

/** ¿Es un número entero de horas válido (1 a 72)? */
export const validBanHours = (h: number) =>
  Number.isInteger(h) && h >= 1 && h <= BAN_MAX_HOURS

/** Fecha de vencimiento del baneo (null = permanente). */
export function banExpiry(
  d: Duration,
  date: string,
  now = new Date(),
  hours = 1
): string | null {
  if (d === "perm") return null
  if (d === "date") return endOfDayIso(date)
  if (d === "hours")
    return new Date(now.getTime() + hours * 3_600_000).toISOString()
  return new Date(now.getTime() + Number(d) * 86_400_000).toISOString()
}

/** Cuánto le falta a un baneo activo: minutos u horas si vence en menos de un día. */
export function banRemaining(iso: string, now = new Date()): string {
  const ms = new Date(iso).getTime() - now.getTime()
  if (ms < 3_600_000) return `en ${Math.max(1, Math.ceil(ms / 60_000))} min`
  if (ms < 86_400_000) {
    const h = Math.round(ms / 3_600_000)
    return h === 1 ? "en 1 hora" : `en ${h} horas`
  }
  const days = Math.ceil(ms / 86_400_000)
  return days === 1 ? "mañana" : `en ${days} días`
}
