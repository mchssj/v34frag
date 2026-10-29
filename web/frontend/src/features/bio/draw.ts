import {
  fitFont,
  levelColors,
  loadImage,
  MONO,
  prepareCard,
  roundRect,
  SANS,
  THEMES,
  type CardTheme,
  type Palette,
} from "@/features/export/card"
import type { ExportStats } from "@/features/export/demo"
import { levelOf } from "@/features/matchmaking/room/roomData"
import { LEVEL_FLOORS } from "@/features/player/labels"

// Imágenes para la bio de Twitch y Twitter (docs/bitacora/2026-10-29-widget-bio en kyan/pruebas). Se
// dibujan al doble de la medida que piden las redes, para que se vean nítidas en pantallas de alta densidad.

export type BioFormat = "twitch" | "og" | "firma"

export const BIO_FORMATS: Record<
  BioFormat,
  { label: string; size: [number, number]; scale: number; hint: string }
> = {
  twitch: {
    label: "Panel de Twitch",
    size: [320, 160],
    scale: 2,
    hint: "Twitch → Tu canal → Acerca de → Editar paneles → Agregar panel de texto o imagen",
  },
  og: {
    label: "Tarjeta del link (Twitter/X)",
    size: [1200, 630],
    scale: 1,
    hint: "Lo que aparece al pegar tu link en un tweet o en Discord",
  },
  firma: {
    label: "Firma para webs",
    size: [400, 120],
    scale: 2,
    hint: "Para Linktree, una web propia o cualquier página que acepte HTML",
  },
}

export interface BioData extends ExportStats {
  rank: number | null
  url: string
}

export interface BioOptions {
  data: BioData
  format: BioFormat
  theme: CardTheme
  watermark: boolean
}

function background(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  p: Palette,
  r: number
) {
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, p.bg[0])
  bg.addColorStop(1, p.bg[1])
  ctx.fillStyle = bg
  roundRect(ctx, 0, 0, W, H, r)
  ctx.fill()
  const glow = ctx.createRadialGradient(W, 0, 0, W, 0, W * 0.8)
  glow.addColorStop(0, p.accent + "33")
  glow.addColorStop(1, p.accent + "00")
  ctx.fillStyle = glow
  roundRect(ctx, 0, 0, W, H, r)
  ctx.fill()
}

/** Foto redonda (o la inicial) con aro de acento y la insignia de nivel en la esquina. */
function avatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  d: BioData,
  x: number,
  y: number,
  size: number,
  p: Palette
) {
  const cx = x + size / 2
  const cy = y + size / 2
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
  ctx.clip()
  if (img) {
    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    const side = Math.min(w, h)
    ctx.drawImage(
      img,
      (w - side) / 2,
      (h - side) / 2,
      side,
      side,
      x,
      y,
      size,
      size
    )
  } else {
    ctx.fillStyle = p.tile
    ctx.fillRect(x, y, size, size)
    ctx.fillStyle = p.fg
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.font = `800 ${size * 0.45}px ${SANS}`
    ctx.fillText(d.nick.slice(0, 1).toUpperCase(), cx, cy)
  }
  ctx.restore()
  ctx.beginPath()
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
  ctx.strokeStyle = p.accent
  ctx.lineWidth = size * 0.045
  ctx.stroke()

  const level = levelOf(d.elo, LEVEL_FLOORS)
  const [bg, fg] = levelColors(level, p)
  const b = size * 0.4
  const bx = x + size - b * 0.85
  const by = y + size - b * 0.85
  ctx.fillStyle = p.bg[0]
  roundRect(
    ctx,
    bx - size * 0.03,
    by - size * 0.03,
    b + size * 0.06,
    b + size * 0.06,
    b * 0.32
  )
  ctx.fill()
  ctx.fillStyle = bg
  roundRect(ctx, bx, by, b, b, b * 0.26)
  ctx.fill()
  ctx.fillStyle = fg
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.font = `700 ${b * 0.5}px ${MONO}`
  ctx.fillText(String(level), bx + b / 2, by + b / 2 + b * 0.03)
}

/** Una fila de stats: etiqueta chica arriba, número abajo. */
function stats(
  ctx: CanvasRenderingContext2D,
  items: [string, string][],
  x: number,
  y: number,
  w: number,
  u: number,
  p: Palette
) {
  const col = w / items.length
  items.forEach(([label, value], i) => {
    const sx = x + i * col
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = p.muted
    ctx.font = `600 ${11 * u}px ${SANS}`
    ctx.fillText(label.toUpperCase(), sx, y)
    ctx.fillStyle = p.fg
    fitFont(ctx, value, 800, 22 * u, col - 8 * u)
    ctx.fillText(value, sx, y + 26 * u)
  })
}

const mainStats = (d: BioData): [string, string][] => [
  ["ELO", String(d.elo)],
  ["Puesto", d.rank ? `#${d.rank}` : "-"],
  ["K/D", d.kd.toFixed(2)],
  ["Rating", d.rating.toFixed(2)],
]

function watermark(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.rotate(-Math.PI / 10)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillStyle = "rgba(255,255,255,0.22)"
  ctx.font = `900 ${H * 0.2}px ${SANS}`
  ctx.fillText("VISTA PREVIA", 0, 0)
  ctx.restore()
}

export async function drawBio(canvas: HTMLCanvasElement, o: BioOptions) {
  await prepareCard(o.theme)
  const p = THEMES[o.theme].palette
  const logo = await loadImage(p.logo)
  const img = o.data.avatar_url
    ? await loadImage(o.data.avatar_url).catch(() => null)
    : null
  // Desde acá todo es sincrónico, para que dos dibujos seguidos no se mezclen.
  const f = BIO_FORMATS[o.format]
  const W = f.size[0] * f.scale
  const H = f.size[1] * f.scale
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  ctx.clearRect(0, 0, W, H)
  const d = o.data

  if (o.format === "twitch") {
    // 320 × 160: logo arriba, jugador en el medio y stats abajo.
    const u = f.scale
    background(ctx, W, H, p, 14 * u)
    const pad = 14 * u
    ctx.drawImage(logo, pad, pad, (logo.width / logo.height) * 16 * u, 16 * u)
    ctx.textAlign = "right"
    ctx.textBaseline = "middle"
    ctx.fillStyle = p.muted
    ctx.font = `600 ${10 * u}px ${MONO}`
    ctx.fillText(d.url.replace(/^https?:\/\//, ""), W - pad, pad + 8 * u)
    avatar(ctx, img, d, pad, 42 * u, 52 * u, p)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    if (d.team_tag) {
      ctx.fillStyle = p.muted
      ctx.font = `600 ${11 * u}px ${MONO}`
      ctx.fillText(d.team_tag.toUpperCase(), pad + 66 * u, 58 * u)
    }
    ctx.fillStyle = p.fg
    fitFont(ctx, d.nick, 800, 26 * u, W - pad * 2 - 66 * u)
    ctx.fillText(d.nick, pad + 66 * u, 86 * u)
    stats(ctx, mainStats(d), pad, 122 * u, W - pad * 2, u, p)
  } else if (o.format === "firma") {
    // 400 × 120: foto, nick y stats en una sola fila.
    const u = f.scale
    background(ctx, W, H, p, 12 * u)
    const pad = 14 * u
    avatar(ctx, img, d, pad, 16 * u, 64 * u, p)
    const tx = pad + 80 * u
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = p.fg
    fitFont(ctx, d.nick, 800, 22 * u, W - tx - 100 * u)
    ctx.fillText(d.nick, tx, 38 * u)
    ctx.drawImage(
      logo,
      W - pad - (logo.width / logo.height) * 14 * u,
      22 * u,
      (logo.width / logo.height) * 14 * u,
      14 * u
    )
    stats(ctx, mainStats(d), tx, 66 * u, W - tx - pad, u * 0.85, p)
    ctx.fillStyle = p.muted
    ctx.font = `600 ${10 * u}px ${MONO}`
    ctx.fillText(d.url.replace(/^https?:\/\//, ""), tx, 108 * u)
  } else {
    // 1200 × 630 (Open Graph): grande, se ve en el tweet o en Discord.
    const u = 2.6
    background(ctx, W, H, p, 0)
    const pad = 64
    ctx.drawImage(logo, pad, pad, (logo.width / logo.height) * 54, 54)
    avatar(ctx, img, d, pad, 170, 200, p)
    const tx = pad + 240
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    if (d.team_tag) {
      ctx.fillStyle = p.muted
      ctx.font = `600 34px ${MONO}`
      ctx.fillText(d.team_tag.toUpperCase(), tx, 220)
    }
    ctx.fillStyle = p.fg
    fitFont(ctx, d.nick, 800, 104, W - tx - pad)
    ctx.fillText(d.nick, tx, 320)
    stats(ctx, mainStats(d), tx, 420, W - tx - pad, u, p)
    ctx.fillStyle = p.accent
    ctx.font = `700 34px ${SANS}`
    ctx.fillText("Mirá mi perfil en CM League →", pad, H - pad)
    ctx.textAlign = "right"
    ctx.fillStyle = p.muted
    ctx.font = `600 30px ${MONO}`
    ctx.fillText(d.url.replace(/^https?:\/\//, ""), W - pad, H - pad)
  }

  if (o.theme === "vip") {
    ctx.strokeStyle = p.accent
    ctx.lineWidth = 3 * f.scale
    roundRect(
      ctx,
      1.5 * f.scale,
      1.5 * f.scale,
      W - 3 * f.scale,
      H - 3 * f.scale,
      o.format === "og" ? 0 : 12 * f.scale
    )
    ctx.stroke()
  }
  if (o.watermark) watermark(ctx, W, H)
}
