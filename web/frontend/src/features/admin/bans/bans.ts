import type { Tone } from "../format"
import type { Ban, BanStatus } from "./queries"

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

/** Cambiar o levantar: solo uno activo, y uno permanente solo si se pueden tocar los permanentes. */
export const canEditBan = (b: Ban, canPermanent: boolean) =>
  b.status === "active" && (canPermanent || !b.permanent)
