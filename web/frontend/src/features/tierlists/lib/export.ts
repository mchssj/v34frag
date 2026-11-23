import lockup from "@/assets/brand/cmleague-lockup-color-fondo-oscuro.svg"
import { initialOf } from "@/components/brand/initial"
import { saveJpeg } from "@/features/player/recap/export"
import type { Schemas } from "@/api/client"
import { tierColor } from "./board"

// La tierlist como imagen (JPEG), dibujada en un canvas sin librerías, como el recap. Solo los tiers (sin el banco),
// con la foto o el logo de cada ítem; si una imagen no carga (o no deja CORS), va la inicial.

const W = 1200
const PAD = 40
const LABEL = 140
const TILE = 96
const NAME_H = 22
const GAP = 10
const SANS = '"Inter Variable", sans-serif'
const BG = "#0b0d12"
const ROW_BG = "#161a22"
const TEXT = "#f3f4f6"
const MUTED = "#9ca3af"

type Tierlist = Pick<Schemas["Tierlist"], "name" | "tiers" | "owner" | "kind">

function loadImage(src: string, cors = false) {
  return new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image()
    if (cors) img.crossOrigin = "anonymous"
    img.onload = () => ok(img)
    img.onerror = fail
    img.src = src
  })
}

function fit(x: CanvasRenderingContext2D, text: string, max: number) {
  if (x.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && x.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t}…`
}

/** Corta el texto en líneas que entren en `max` (para las etiquetas largas de los tiers). */
function lines(
  x: CanvasRenderingContext2D,
  text: string,
  max: number,
  limit: number
) {
  const out: string[] = []
  let cur = ""
  for (const w of text.split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w
    if (x.measureText(next).width <= max || !cur) cur = next
    else {
      out.push(cur)
      cur = w
    }
  }
  if (cur) out.push(cur)
  return out.slice(0, limit).map((l) => fit(x, l, max))
}

export async function renderTierlist(t: Tierlist) {
  const perRow = Math.floor(
    (W - PAD * 2 - LABEL - GAP * 2 + GAP) / (TILE + GAP)
  )
  const rowH = (n: number) =>
    Math.max(1, Math.ceil(n / perRow)) * (TILE + NAME_H + GAP) + GAP
  const HEADER = 136
  const FOOT = 50
  const H =
    HEADER + t.tiers.reduce((s, r) => s + rowH(r.items.length), 0) + FOOT + PAD

  const images = new Map<string, HTMLImageElement | null>()
  const [logo] = await Promise.all([
    loadImage(lockup).catch(() => null),
    ...t.tiers.flatMap((r) =>
      r.items
        .filter((i) => i.image_url && !images.has(i.image_url))
        .map(async (i) => {
          images.set(i.image_url!, null)
          images.set(
            i.image_url!,
            await loadImage(i.image_url!, true).catch(() => null)
          )
        })
    ),
  ])

  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const x = canvas.getContext("2d")!
  x.fillStyle = BG
  x.fillRect(0, 0, W, H)

  x.fillStyle = TEXT
  x.font = `700 34px ${SANS}`
  x.textBaseline = "alphabetic"
  x.fillText(fit(x, t.name, W - PAD * 2 - 220), PAD, PAD + 34)
  x.fillStyle = MUTED
  x.font = `500 18px ${SANS}`
  x.fillText(
    `Tierlist de ${t.kind === "players" ? "jugadores" : "equipos"} · por ${t.owner.nick}`,
    PAD,
    PAD + 66
  )
  if (logo) {
    const h = 36
    const w = (logo.width / logo.height) * h
    x.drawImage(logo, W - PAD - w, PAD + 8, w, h)
  }

  let y = HEADER
  t.tiers.forEach((r, ti) => {
    const h = rowH(r.items.length)
    x.fillStyle = tierColor(ti)
    x.fillRect(PAD, y, LABEL, h - 4)
    x.fillStyle = ROW_BG
    x.fillRect(PAD + LABEL, y, W - PAD * 2 - LABEL, h - 4)
    x.fillStyle = "#111111"
    x.font = `800 ${r.label.length <= 3 ? 40 : 18}px ${SANS}`
    x.textAlign = "center"
    x.textBaseline = "middle"
    const ls = lines(x, r.label, LABEL - 16, 4)
    const lh = r.label.length <= 3 ? 44 : 22
    ls.forEach((l, i) =>
      x.fillText(
        l,
        PAD + LABEL / 2,
        y + (h - 4) / 2 + (i - (ls.length - 1) / 2) * lh
      )
    )

    r.items.forEach((it, i) => {
      const cx = PAD + LABEL + GAP + (i % perRow) * (TILE + GAP)
      const cy = y + GAP + Math.floor(i / perRow) * (TILE + NAME_H + GAP)
      const img = it.image_url ? images.get(it.image_url) : null
      x.save()
      x.beginPath()
      x.roundRect(cx, cy, TILE, TILE, 12)
      x.clip()
      if (img) {
        const s = Math.max(TILE / img.width, TILE / img.height)
        x.drawImage(
          img,
          cx + (TILE - img.width * s) / 2,
          cy + (TILE - img.height * s) / 2,
          img.width * s,
          img.height * s
        )
      } else {
        x.fillStyle = "#2a303c"
        x.fillRect(cx, cy, TILE, TILE)
        x.fillStyle = TEXT
        x.font = `700 36px ${SANS}`
        x.fillText(
          it.kind === "team" && it.tag
            ? fit(x, it.tag, TILE - 10)
            : initialOf(it.name),
          cx + TILE / 2,
          cy + TILE / 2
        )
      }
      x.restore()
      x.fillStyle = TEXT
      x.font = `600 13px ${SANS}`
      x.fillText(
        fit(x, it.name, TILE + GAP - 2),
        cx + TILE / 2,
        cy + TILE + NAME_H / 2 + 1
      )
    })
    y += h
  })

  x.textAlign = "left"
  x.textBaseline = "alphabetic"
  x.fillStyle = MUTED
  x.font = `500 15px ${SANS}`
  x.fillText("Hecha en CMLeague · cmleague.lat", PAD, H - PAD + 10)
  return canvas
}

export async function downloadTierlist(t: Tierlist) {
  const name =
    t.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "tierlist"
  await saveJpeg(await renderTierlist(t), `tierlist-${name}`)
}
