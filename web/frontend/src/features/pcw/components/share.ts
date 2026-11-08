import { toast } from "sonner"

import { icsFor, pcwLink } from "../lib/pcw"
import type { BestOf } from "../types"

// Acciones de compartir de la página de PCW (copiar el link y agregar al calendario).

export async function copyLink(id: string, kind: "post" | "match") {
  const url = pcwLink(window.location.origin, id, kind)
  try {
    await navigator.clipboard.writeText(url)
    toast.success("Link copiado", { description: url })
  } catch {
    toast.error("No se pudo copiar el link", { description: url })
  }
}

export function downloadIcs(opts: {
  id: string
  title: string
  startsAt: string
  bestOf: BestOf
  kind: "post" | "match"
}) {
  const ics = icsFor({
    ...opts,
    url: pcwLink(window.location.origin, opts.id, opts.kind),
    now: new Date(),
  })
  const href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }))
  const a = document.createElement("a")
  a.href = href
  a.download = "pcw-cmleague.ics"
  a.click()
  URL.revokeObjectURL(href)
}
