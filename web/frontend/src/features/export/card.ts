import lockup from "@/assets/brand/cmleague-lockup-color-fondo-oscuro.svg"
import lockupLight from "@/assets/brand/cmleague-lockup-color-fondo-claro.svg"
import { levelOf } from "@/features/matchmaking/room/roomData"
import { LEVEL_FLOORS } from "@/features/player/labels"

import { PERIOD_LABEL, type ExportPeriod, type ExportStats } from "./demo"

// Tarjeta de stats para redes (docs/bitacora/2026-10-29-exportar-stats en kyan/pruebas). Se dibuja en
// un canvas para que la vista previa sea exactamente el PNG o el PDF que se descarga.

export type CardFormat = "square" | "story" | "wide"
export type CardTheme = "cm" | "light" | "vip"

export const FORMATS: Record<
  CardFormat,
  { label: string; size: [number, number] }
> = {
  square: { label: "Cuadrado", size: [1080, 1080] },
  story: { label: "Historia", size: [1080, 1920] },
  wide: { label: "Horizontal", size: [1600, 900] },
}

interface Palette {
  bg: [string, string]
  fg: string
  muted: string
  accent: string
  tile: string
  line: string
  logo: string
}

export const THEMES: Record<
  CardTheme,
  { label: string; vip?: boolean; palette: Palette }
> = {
  cm: {
    label: "CM League",
    palette: {
      bg: ["#0a0a0a", "#2a1206"],
      fg: "#fafafa",
      muted: "#a1a1a1",
      accent: "#ff6900",
      tile: "rgba(255,255,255,0.06)",
      line: "rgba(255,255,255,0.10)",
      logo: lockup,
    },
  },
  light: {
    label: "Claro",
    palette: {
      bg: ["#ffffff", "#fff1e6"],
      fg: "#0a0a0a",
      muted: "#737373",
      accent: "#e05a00",
      tile: "rgba(0,0,0,0.04)",
      line: "rgba(0,0,0,0.08)",
      logo: lockupLight,
    },
  },
  vip: {
    label: "VIP dorado",
    vip: true,
    palette: {
      bg: ["#0d0a04", "#3a2a0c"],
      fg: "#fff8e6",
      muted: "#c8b48a",
      accent: "#f2c14e",
      tile: "rgba(242,193,78,0.08)",
      line: "rgba(242,193,78,0.22)",
      logo: lockup,
    },
  },
}

export type StatKey =
  | "kd"
  | "rating"
  | "hs"
  | "adr"
  | "winrate"
  | "matches"
  | "mvp"
  | "peak"
  | "streak"
  | "bestmap"

export const STATS: Record<
  StatKey,
  { label: string; value: (s: ExportStats) => string }
> = {
  kd: { label: "K/D", value: (s) => s.kd.toFixed(2) },
  rating: { label: "Rating", value: (s) => s.rating.toFixed(2) },
  hs: { label: "HS %", value: (s) => `${s.hs.toFixed(1)}%` },
  adr: { label: "ADR", value: (s) => s.adr.toFixed(1) },
  winrate: {
    label: "Victorias",
    value: (s) => `${Math.round((s.wins / s.matches) * 100)}%`,
  },
  matches: { label: "Mixes", value: (s) => String(s.matches) },
  mvp: { label: "MVP", value: (s) => String(s.mvp) },
  peak: { label: "ELO máximo", value: (s) => String(s.peak_elo) },
  streak: { label: "Mejor racha", value: (s) => `${s.streak} V` },
  bestmap: {
    label: "Mejor mapa",
    value: (s) => (s.maps[0]?.name ?? "-").replace(/^de_/, ""),
  },
}
export const MAX_STATS = 6

export interface CardOptions {
  stats: ExportStats
  period: ExportPeriod
  format: CardFormat
  theme: CardTheme
  keys: StatKey[]
  /** Sin VIP: marca de agua encima. */
  watermark: boolean
}

const SANS = '"Inter Variable", Inter, system-ui, sans-serif'
const MONO = '"Geist Mono Variable", ui-monospace, monospace'

const images = new Map<string, Promise<HTMLImageElement>>()
function loadImage(src: string) {
  let p = images.get(src)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
    images.set(src, p)
  }
  return p
}

/** Espera las fuentes y el logo: sin esto el primer dibujo sale con la fuente del sistema. */
export async function prepareCard(theme: CardTheme) {
  await Promise.all([
    document.fonts.load(`800 40px ${SANS}`),
    document.fonts.load(`600 40px ${MONO}`),
    loadImage(THEMES[theme].palette.logo),
  ])
}

function levelColors(level: number, p: Palette): [string, string] {
  if (level >= 10) return [p.accent, "#0a0a0a"]
  if (level >= 8) return ["#f54900", "#fff"]
  if (level >= 4) return [p.fg, p.bg[0]]
  return [p.muted, p.bg[0]]
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Achica la fuente hasta que el texto entra en `max` px. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  size: number,
  max: number
) {
  let s = size
  ctx.font = `${weight} ${s}px ${SANS}`
  while (s > 12 && ctx.measureText(text).width > max) {
    s -= 2
    ctx.font = `${weight} ${s}px ${SANS}`
  }
  return s
}

function drawChart(
  ctx: CanvasRenderingContext2D,
  data: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  u: number,
  p: Palette
) {
  ctx.fillStyle = p.tile
  roundRect(ctx, x, y, w, h, 28 * u)
  ctx.fill()

  const padX = 32 * u
  const top = y + 76 * u
  const bottom = y + h - 32 * u
  ctx.fillStyle = p.muted
  ctx.font = `600 ${24 * u}px ${SANS}`
  ctx.textBaseline = "alphabetic"
  ctx.textAlign = "left"
  ctx.fillText("EVOLUCIÓN DEL ELO", x + padX, y + 48 * u)
  const diff = data.at(-1)! - data[0]!
  ctx.textAlign = "right"
  ctx.fillStyle = diff >= 0 ? "#22c55e" : "#ef4444"
  ctx.font = `700 ${28 * u}px ${MONO}`
  ctx.fillText(`${diff >= 0 ? "+" : ""}${diff}`, x + w - padX, y + 48 * u)

  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = Math.max(1, max - min)
  const px = (i: number) =>
    x + padX + (i / Math.max(1, data.length - 1)) * (w - 2 * padX)
  const py = (v: number) => bottom - ((v - min) / span) * (bottom - top)

  const grad = ctx.createLinearGradient(0, top, 0, bottom)
  grad.addColorStop(0, p.accent + "55")
  grad.addColorStop(1, p.accent + "00")
  ctx.beginPath()
  ctx.moveTo(px(0), bottom)
  data.forEach((v, i) => ctx.lineTo(px(i), py(v)))
  ctx.lineTo(px(data.length - 1), bottom)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  ctx.beginPath()
  data.forEach((v, i) =>
    i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))
  )
  ctx.strokeStyle = p.accent
  ctx.lineWidth = 5 * u
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(px(data.length - 1), py(data.at(-1)!), 9 * u, 0, Math.PI * 2)
  ctx.fillStyle = p.accent
  ctx.fill()
}

function drawStats(
  ctx: CanvasRenderingContext2D,
  o: CardOptions,
  x: number,
  y: number,
  w: number,
  cols: number,
  u: number,
  p: Palette,
  tileH = 150 * u
) {
  const gap = 20 * u
  const tileW = (w - gap * (cols - 1)) / cols
  o.keys.forEach((k, i) => {
    const tx = x + (i % cols) * (tileW + gap)
    const ty = y + Math.floor(i / cols) * (tileH + gap)
    ctx.fillStyle = p.tile
    roundRect(ctx, tx, ty, tileW, tileH, 24 * u)
    ctx.fill()
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = p.muted
    ctx.font = `600 ${24 * u}px ${SANS}`
    ctx.fillText(STATS[k].label.toUpperCase(), tx + 28 * u, ty + 50 * u)
    ctx.fillStyle = p.fg
    fitFont(
      ctx,
      STATS[k].value(o.stats),
      800,
      Math.min(84 * u, tileH * 0.42),
      tileW - 56 * u
    )
    ctx.fillText(STATS[k].value(o.stats), tx + 28 * u, ty + tileH - 32 * u)
  })
  const rows = Math.ceil(o.keys.length / cols)
  return rows * tileH + Math.max(0, rows - 1) * gap
}

function drawMaps(
  ctx: CanvasRenderingContext2D,
  s: ExportStats,
  x: number,
  y: number,
  w: number,
  u: number,
  p: Palette
) {
  ctx.textAlign = "left"
  ctx.fillStyle = p.muted
  ctx.font = `600 ${24 * u}px ${SANS}`
  ctx.fillText("MAPAS MÁS JUGADOS", x, y + 24 * u)
  s.maps.forEach((m, i) => {
    const ry = y + 56 * u + i * 84 * u
    ctx.fillStyle = p.tile
    roundRect(ctx, x, ry, w, 68 * u, 20 * u)
    ctx.fill()
    ctx.fillStyle = p.fg
    ctx.font = `700 ${30 * u}px ${SANS}`
    ctx.textAlign = "left"
    ctx.fillText(m.name, x + 28 * u, ry + 45 * u)
    ctx.textAlign = "right"
    ctx.font = `600 ${26 * u}px ${MONO}`
    ctx.fillStyle = p.muted
    ctx.fillText(`${m.matches} mixes`, x + w - 200 * u, ry + 44 * u)
    ctx.fillStyle = m.winrate >= 50 ? "#22c55e" : "#ef4444"
    ctx.fillText(`${m.winrate.toFixed(0)}% V`, x + w - 28 * u, ry + 44 * u)
  })
  return 56 * u + s.maps.length * 84 * u
}

/** Bloque del jugador: insignia de nivel, nick, tag, ELO y barra al próximo nivel. Devuelve el alto. */
function drawPlayer(
  ctx: CanvasRenderingContext2D,
  s: ExportStats,
  x: number,
  y: number,
  w: number,
  u: number,
  p: Palette
) {
  const level = levelOf(s.elo, LEVEL_FLOORS)
  const badge = 132 * u
  const [bg, fg] = levelColors(level, p)
  ctx.fillStyle = bg
  roundRect(ctx, x, y, badge, badge, 30 * u)
  ctx.fill()
  ctx.fillStyle = fg
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.font = `700 ${64 * u}px ${MONO}`
  ctx.fillText(String(level), x + badge / 2, y + badge / 2 + 4 * u)

  const tx = x + badge + 36 * u
  const tw = w - badge - 36 * u
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  if (s.team_tag) {
    ctx.fillStyle = p.muted
    ctx.font = `600 ${30 * u}px ${MONO}`
    ctx.fillText(s.team_tag.toUpperCase(), tx, y + 34 * u)
  }
  ctx.fillStyle = p.fg
  fitFont(ctx, s.nick, 800, 92 * u, tw)
  ctx.fillText(s.nick, tx, y + 118 * u)

  // ELO y barra al próximo nivel.
  const by = y + badge + 56 * u
  const floor = LEVEL_FLOORS[level - 1]!
  const next = level < 10 ? LEVEL_FLOORS[level]! : null
  const pct =
    next === null
      ? 1
      : Math.min(1, Math.max(0, (s.elo - floor) / (next - floor)))
  ctx.fillStyle = p.accent
  ctx.font = `800 ${72 * u}px ${SANS}`
  ctx.fillText(String(s.elo), x, by + 56 * u)
  const eloW = ctx.measureText(String(s.elo)).width
  ctx.fillStyle = p.muted
  ctx.font = `600 ${28 * u}px ${SANS}`
  ctx.fillText("ELO", x + eloW + 14 * u, by + 54 * u)
  ctx.textAlign = "right"
  ctx.fillText(
    next === null ? "Nivel máximo" : `${next - s.elo} para nivel ${level + 1}`,
    x + w,
    by + 54 * u
  )
  ctx.textAlign = "left"
  ctx.fillStyle = p.line
  roundRect(ctx, x, by + 84 * u, w, 14 * u, 7 * u)
  ctx.fill()
  ctx.fillStyle = p.accent
  roundRect(ctx, x, by + 84 * u, Math.max(14 * u, w * pct), 14 * u, 7 * u)
  ctx.fill()
  return badge + 56 * u + 98 * u
}

/** Dibuja la tarjeta completa en `canvas` (le pone el tamaño del formato). */
export async function drawCard(canvas: HTMLCanvasElement, o: CardOptions) {
  await prepareCard(o.theme)
  // Todo lo que sigue es sincrónico, así dos dibujos seguidos no se mezclan en el mismo canvas.
  const logo = await loadImage(THEMES[o.theme].palette.logo)
  const [W, H] = FORMATS[o.format].size
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  const p = THEMES[o.theme].palette
  const u = Math.min(W, H) / 1080
  const wide = o.format === "wide"
  const pad = 72 * u

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, p.bg[0])
  bg.addColorStop(1, p.bg[1])
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  // Brillo del color de acento arriba a la derecha.
  const glow = ctx.createRadialGradient(W, 0, 0, W, 0, W * 0.7)
  glow.addColorStop(0, p.accent + "33")
  glow.addColorStop(1, p.accent + "00")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  if (o.theme === "vip") {
    ctx.strokeStyle = p.accent
    ctx.lineWidth = 6 * u
    roundRect(ctx, 24 * u, 24 * u, W - 48 * u, H - 48 * u, 36 * u)
    ctx.stroke()
  }

  // Encabezado: logo y período.
  const logoH = 60 * u
  ctx.drawImage(logo, pad, pad, (logo.width / logo.height) * logoH, logoH)
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  ctx.fillStyle = p.muted
  ctx.font = `600 ${28 * u}px ${SANS}`
  ctx.fillText(PERIOD_LABEL[o.period].toUpperCase(), W - pad, pad + logoH / 2)

  const top = pad + logoH + 64 * u
  const footer = H - pad
  if (wide) {
    const colW = W * 0.54 - pad
    let y = top
    y += drawPlayer(ctx, o.stats, pad, y, colW, u, p) + 48 * u
    drawStats(ctx, o, pad, y, colW, 3, u, p)
    const cx = pad + colW + 48 * u
    drawChart(
      ctx,
      o.stats.elo_history,
      cx,
      top,
      W - pad - cx,
      footer - 56 * u - top,
      u,
      p
    )
  } else {
    const w = W - 2 * pad
    let y = top
    y += drawPlayer(ctx, o.stats, pad, y, w, u, p) + 56 * u
    if (o.format === "square") {
      // En el cuadrado no entra el gráfico: las stats ocupan todo el alto que queda.
      const rows = Math.max(1, Math.ceil(o.keys.length / 3))
      const tileH = (footer - 56 * u - y - (rows - 1) * 20 * u) / rows
      drawStats(ctx, o, pad, y, w, 3, u, p, Math.min(220 * u, tileH))
    } else {
      y += drawStats(ctx, o, pad, y, w, 3, u, p) + 40 * u
      y += drawMaps(ctx, o.stats, pad, y + 16 * u, w, u, p) + 56 * u
      drawChart(ctx, o.stats.elo_history, pad, y, w, footer - 56 * u - y, u, p)
    }
  }

  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = p.muted
  ctx.font = `600 ${26 * u}px ${MONO}`
  ctx.textAlign = "left"
  ctx.fillText("cmleague.lat", pad, footer)
  ctx.textAlign = "right"
  ctx.fillText(new Date().toLocaleDateString("es-AR"), W - pad, footer)

  if (o.watermark) {
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.rotate(-Math.PI / 7)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = "rgba(255,255,255,0.16)"
    ctx.strokeStyle = "rgba(0,0,0,0.16)"
    ctx.lineWidth = 2 * u
    ctx.font = `900 ${150 * u}px ${SANS}`
    for (const dy of [-1, 0, 1]) {
      ctx.fillText("VISTA PREVIA", 0, dy * 360 * u)
      ctx.strokeText("VISTA PREVIA", 0, dy * 360 * u)
    }
    ctx.restore()
  }
}

export function toBlob(
  canvas: HTMLCanvasElement,
  type: "image/png" | "image/jpeg",
  quality?: number
) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("No se pudo generar la imagen.")),
      type,
      quality
    )
  )
}
