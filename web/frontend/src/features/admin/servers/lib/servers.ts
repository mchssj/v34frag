import { ago, compareVersions } from "../../lib/format"
import type { AdminServer } from "../types"

export const MODES = {
  mix: "Mix",
  competitive: "Competitivo",
  public: "Público",
  deathmatch: "Deathmatch",
  retakes: "Retakes",
  practice: "Práctica",
} as const

/** Activo con algo que mirar: sin señal, licencia por vencer o vencida, o plugin viejo. */
export function serverWarnings(s: AdminServer, latest: string | null) {
  if (!s.active) return []
  const out: string[] = []
  if (!s.online)
    out.push(
      `No valida su licencia desde ${ago(s.last_seen_at)} (lo hace al cargar cada mapa y cada 30 minutos).`
    )
  if (s.license_state === "expiring")
    out.push(
      "La licencia vence en pocos días: renuévala para que siga jugando mixes."
    )
  if (s.license_state === "expired")
    out.push("Licencia vencida: no puede jugar mixes ni subir resultados.")
  if (
    latest &&
    s.plugin_version &&
    compareVersions(s.plugin_version, latest) < 0
  )
    out.push(`Tiene el plugin ${s.plugin_version}; la última es ${latest}.`)
  return out
}
