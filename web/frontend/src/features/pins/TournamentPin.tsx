import { cn } from "cn"
import { useId, useLayoutEffect, useRef } from "react"

import {
  awardOf,
  pinSvg,
  tierOf,
  type PinAward,
  type PinMetal,
  type PinStyle,
  type PinTier,
} from "./pinSvg"

type Props = {
  /** Escalón por puesto, o `award` para un premio individual. */
  tier?: PinTier
  award?: PinAward
  metal?: PinMetal
  style?: PinStyle
  event: string
  year: number | string
  locked?: boolean
  /** Ancho en px; el alto sale de la proporción 200×240. */
  size?: number
  className?: string
}

// El SVG se arma como texto y se mete parseado (sin dangerouslySetInnerHTML), igual que <Medal>.
export function TournamentPin({
  tier,
  award,
  metal,
  style,
  event,
  year,
  locked,
  size = 120,
  className,
}: Props) {
  const uid = `p${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const ref = useRef<HTMLSpanElement>(null)
  const height = Math.round((size * 240) / 200)
  const name = award ? awardOf(award).name : tierOf(tier ?? "champion").name

  useLayoutEffect(() => {
    const host = ref.current
    if (!host) return
    const svg = pinSvg({ tier, award, metal, style, event, year, uid, locked })
    const el = new DOMParser().parseFromString(
      svg,
      "image/svg+xml"
    ).documentElement
    if (el.nodeName !== "svg") return
    el.setAttribute("width", String(size))
    el.setAttribute("height", String(height))
    host.replaceChildren(document.importNode(el, true))
  }, [tier, award, metal, style, event, year, locked, uid, size, height])

  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex shrink-0 leading-none",
        locked && "opacity-60",
        className
      )}
      style={{ width: size, height }}
      aria-label={`${name} · ${event} ${year}`}
    />
  )
}
