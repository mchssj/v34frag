import { queryOptions, useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { useId, useLayoutEffect, useMemo, useRef } from "react"

import { applyDesign } from "./svg"
import { templateOf, type MedalLook } from "./templates"

// <Medal>: trae el SVG de la plantilla (public/medallas), le aplica el diseño y lo mete en la página (plan, sección 3).
// Va inline y no en un <img> para que use las fuentes de la página (Montserrat) y se pueda configurar.

const svgOptions = (path: string) =>
  queryOptions({
    queryKey: ["medal-svg", path],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/medallas/${path}`, { signal })
      if (!res.ok) throw new Error(`No se pudo cargar la medalla ${path}`)
      return res.text()
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })

type Props = {
  look: MedalLook
  /** Bloqueada: gris y con los rombos apagados. */
  locked?: boolean
  /** Ancho en px; el alto sale de la proporción 260×300. */
  size?: number
  title?: string
  className?: string
}

export function Medal({
  look,
  locked = false,
  size = 96,
  title,
  className,
}: Props) {
  const template = templateOf(look.template)
  const uid = `m${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const ref = useRef<HTMLSpanElement>(null)
  const svg = useQuery({
    ...svgOptions(template?.svg ?? ""),
    enabled: !!template,
  })
  const height = Math.round((size * 300) / 260)
  const name =
    (title ?? template?.title ?? "Medalla") + (locked ? " (bloqueada)" : "")
  // El objeto `look` cambia en cada render: se compara por contenido.
  const lookKey = JSON.stringify(look)
  const stable = useMemo(() => JSON.parse(lookKey) as MedalLook, [lookKey])

  useLayoutEffect(() => {
    const host = ref.current
    if (!host || !template || !svg.data) return
    try {
      const el = applyDesign(svg.data, {
        look: stable,
        template,
        locked,
        uid,
        title: title ?? template.title,
      })
      el.setAttribute("width", String(size))
      el.setAttribute("height", String(height))
      host.replaceChildren(el)
    } catch {
      host.replaceChildren()
    }
  }, [svg.data, template, stable, locked, uid, title, size, height])

  return (
    <span
      ref={ref}
      role={svg.data ? undefined : "img"}
      aria-label={svg.data ? undefined : name}
      className={cn(
        "inline-flex shrink-0 leading-none",
        !svg.data && "rounded-lg bg-muted/40",
        className
      )}
      style={{ width: size, height }}
    />
  )
}

/** La medalla de un tramo de temporada (ranking, historial, vista previa del cierre). Sin definición, nada. */
export function SeasonMedal({
  medal,
  size = 32,
}: {
  medal: { name: string; design: (MedalLook & { title: string }) | null }
  size?: number
}) {
  if (!medal.design) return null
  return <Medal look={medal.design} size={size} title={medal.design.title} />
}
