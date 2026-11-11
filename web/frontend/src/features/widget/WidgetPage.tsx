import { useQuery } from "@tanstack/react-query"
import { useLocation } from "@tanstack/react-router"
import { useEffect, type ReactNode } from "react"

import { isApiError } from "@/api/errors"
import { widgetDataOptions } from "./api"
import { mergeOptions, parseOptions } from "./options"
import { StreamWidget } from "./StreamWidget"

// La página /widget que va en la fuente de navegador de OBS (bitácora 2026-11-10-widget-streamers-en-main).
// Usa lo que el streamer guardó en su cuenta (2026-11-11-widget-guardar) con las opciones de la URL encima: las URLs
// viejas traen todo adentro y se siguen viendo igual. `bg=1` pone un fondo gris para verlo en el navegador.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Mientras está esta página, html y body sin fondo (o gris con `bg=1`). */
function usePageBackground(color: string) {
  useEffect(() => {
    const els = [document.documentElement, document.body]
    const before = els.map((e) => e.style.background)
    for (const e of els) e.style.background = color
    return () => els.forEach((e, i) => (e.style.background = before[i]!))
  }, [color])
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <span className="dark inline-block rounded-lg bg-black/70 px-3 py-2 text-[13px] font-semibold text-foreground">
      {children}
    </span>
  )
}

export function WidgetPage() {
  const search = useLocation({ select: (l) => l.searchStr })
  const q = new URLSearchParams(search)
  const id = (q.get("id") ?? "").trim()
  const valid = UUID.test(id)
  usePageBackground(q.get("bg") === "1" ? "#3a3f47" : "transparent")

  // Sin `v` en la URL, la API usa el período guardado.
  const data = useQuery(
    widgetDataOptions(id, q.has("v") ? parseOptions(q).period : null, valid)
  )
  const options = mergeOptions(data.data?.settings ?? null, q)

  let body: ReactNode = null
  if (!valid) body = <Notice>Falta el jugador en la URL</Notice>
  else if (data.data) body = <StreamWidget data={data.data} options={options} />
  else if (isApiError(data.error, "NOT_FOUND"))
    body = <Notice>Jugador no encontrado</Notice>
  else if (data.isError) body = <Notice>Sin conexión, reintentando…</Notice>

  return <div className="inline-block p-1">{body}</div>
}
