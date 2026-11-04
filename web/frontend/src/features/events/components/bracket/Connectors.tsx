import { useLayoutEffect, useRef } from "react"

export type Connector = {
  /** `data-node` de los dos extremos, dentro del mismo tablero. */
  from: string
  to: string
  /** `line`: llave (codo); `win`/`lose`: flecha del suizo (curva punteada). */
  tone?: "line" | "win" | "lose"
  /** Parte del camino del equipo bajo el cursor. */
  hot?: boolean
  /** Altura de salida, de 0 (arriba) a 1 (abajo). */
  fromAt?: number
}

const SVG = "http://www.w3.org/2000/svg"

const STROKE = {
  line: "var(--border)",
  win: "var(--win)",
  lose: "var(--destructive)",
}

/**
 * Líneas entre tarjetas, medidas sobre el DOM: se dibujan a mano (sin estado) y se vuelven a
 * medir cuando el tablero cambia de tamaño. Va como hijo directo del tablero (`relative`).
 */
export function Connectors({ links }: { links: Connector[] }) {
  const ref = useRef<SVGSVGElement>(null)

  useLayoutEffect(() => {
    const svg = ref.current
    const board = svg?.parentElement
    if (!svg || !board) return

    const draw = () => {
      const box = board.getBoundingClientRect()
      // Con `zoom` en un ancestro, el rectángulo viene escalado: se vuelve a la escala del tablero.
      const scale = board.offsetWidth ? box.width / board.offsetWidth : 1
      const at = (el: Element) => {
        const r = el.getBoundingClientRect()
        return {
          left: (r.left - box.left) / scale,
          right: (r.right - box.left) / scale,
          top: (r.top - box.top) / scale,
          height: r.height / scale,
        }
      }
      const node = (id: string) =>
        board.querySelector(`[data-node="${CSS.escape(id)}"]`)
      svg.replaceChildren()
      for (const l of links) {
        const a = node(l.from)
        const b = node(l.to)
        if (!a || !b) continue
        const p = at(a)
        const q = at(b)
        const tone = l.tone ?? "line"
        const x1 = p.right + (tone === "line" ? 0 : 3)
        const y1 = p.top + p.height * (l.fromAt ?? 0.5)
        const x2 = q.left - (tone === "line" ? 0 : 7)
        const y2 = q.top + Math.min(q.height / 2, 44)
        const mid = (x2 - x1) / 2
        const path = document.createElementNS(SVG, "path")
        path.setAttribute(
          "d",
          tone === "line"
            ? `M${x1} ${y1}H${x1 + mid}V${y2}H${x2}`
            : `M${x1} ${y1}C${x1 + mid} ${y1} ${x2 - mid} ${y2} ${x2} ${y2}`
        )
        path.setAttribute("fill", "none")
        path.setAttribute("stroke", l.hot ? "var(--primary)" : STROKE[tone])
        path.setAttribute("stroke-width", l.hot ? "2" : "1.5")
        if (tone !== "line") {
          path.setAttribute("stroke-dasharray", "4 4")
          path.setAttribute("marker-end", `url(#bracket-arrow-${tone})`)
        }
        svg.append(path)
      }
      if (links.some((l) => l.tone && l.tone !== "line")) svg.prepend(arrows())
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(board)
    return () => ro.disconnect()
  }, [links])

  return (
    <svg
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
    />
  )
}

function arrows() {
  const defs = document.createElementNS(SVG, "defs")
  for (const tone of ["win", "lose"] as const) {
    const marker = document.createElementNS(SVG, "marker")
    marker.setAttribute("id", `bracket-arrow-${tone}`)
    marker.setAttribute("viewBox", "0 0 8 8")
    marker.setAttribute("refX", "6")
    marker.setAttribute("refY", "4")
    marker.setAttribute("markerWidth", "7")
    marker.setAttribute("markerHeight", "7")
    marker.setAttribute("orient", "auto")
    const head = document.createElementNS(SVG, "path")
    head.setAttribute("d", "M0 0L8 4L0 8z")
    head.setAttribute("fill", STROKE[tone])
    marker.append(head)
    defs.append(marker)
  }
  return defs
}
