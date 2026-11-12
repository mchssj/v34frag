import { queryOptions } from "@tanstack/react-query"

/**
 * Radar propio de cada mapa (server/radar/nav_a_svg.py): public/radar/<mapa>.svg y los límites en index.json.
 * Una posición del juego pasa al dibujo con px = x - minx, py = maxy - y.
 */
export interface RadarInfo {
  minx: number
  maxy: number
  width: number
  height: number
  minz: number
  maxz: number
}

export const radarIndexOptions = queryOptions({
  queryKey: ["radar", "index"],
  queryFn: async (): Promise<Record<string, RadarInfo>> => {
    const res = await fetch("/radar/index.json")
    if (!res.ok) throw new Error(`radar ${res.status}`)
    return res.json() as Promise<Record<string, RadarInfo>>
  },
  staleTime: Infinity,
})

export const radarSvgUrl = (map: string) => `/radar/${map}.svg`

/** Proporción del mapa, sin pasar de tres cuartos del alto de la ventana (en el celular, el mapa entero a la vista). */
export const radarBox = (r: RadarInfo) => ({
  aspectRatio: `${r.width} / ${r.height}`,
  maxWidth: `calc(75vh * ${(r.width / r.height).toFixed(3)})`,
  marginInline: "auto",
})

export function toRadar(r: RadarInfo, x: number, y: number) {
  return { px: x - r.minx, py: r.maxy - y }
}

/** Colores de cada lado sobre el radar (gris): CT celeste, T ámbar. */
export const SIDE_FILL: Record<2 | 3, string> = {
  2: "#f2a93b",
  3: "#5aa9f0",
}

export const SIDE_LABEL: Record<2 | 3, string> = { 2: "T", 3: "CT" }
