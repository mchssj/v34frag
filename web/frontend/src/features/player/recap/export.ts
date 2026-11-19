import heroWebp from "@/assets/landing-bg.webp"
import lockup from "@/assets/brand/cmleague-lockup-color-fondo-oscuro.svg"
import { levelTier } from "@/components/brand/LevelBadge"
import {
  dateLabel,
  mapLabel as baseMap,
  recapEnd,
  type SeasonRecap,
  type StatKey,
} from "./types"
import { fmt, statLabel } from "./hints"

// Exporta la vista completa del recap como imagen (JPEG) o PDF, sin dependencias: se dibuja en un canvas
// con el mismo diseño (fondo de la landing, tarjetas, gráfico) y el PDF lleva esa imagen. Los clips no van.

type Derived = {
  wr: number
  kd: number
  delta: number
  marks: StatKey[]
  values: Record<StatKey, number>
}

const W = 1200
const PAD = 48
const GAP = 14
const SCALE = 1.5

const SANS = '"Inter Variable", sans-serif'
const MONO = '"Geist Mono Variable", ui-monospace, monospace'

const mapLabel = (m: string | null) => {
  const s = m ? baseMap(m) : "Mix"
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`
const WEAPONS: Record<string, string> = {
  ak47: "AK-47",
  m4a1: "M4A1",
  awp: "AWP",
  deagle: "Desert Eagle",
}

/** Colores del tema oscuro, leídos de las variables de la página. */
function palette(el: Element) {
  const cs = getComputedStyle(el)
  const v = (name: string) => cs.getPropertyValue(name).trim()
  return {
    bg: v("--background"),
    fg: v("--foreground"),
    muted: v("--muted-foreground"),
    primary: v("--primary"),
    win: v("--win"),
    loss: v("--destructive"),
    level: (n: number) => v(`--level-${levelTier(n)}`),
    levelOff: "rgba(255,255,255,.12)",
    line: "rgba(255,255,255,.10)",
    box: "rgba(255,255,255,.04)",
    card: "rgba(10,10,10,.62)",
    amber: "#fcd34d",
  }
}

/** Cualquier color CSS (oklch incluido) a RGB, pintándolo en un píxel. */
function rgbOf(color: string): [number, number, number] {
  const cv = document.createElement("canvas")
  cv.width = cv.height = 1
  const x = cv.getContext("2d")!
  x.fillStyle = color
  x.fillRect(0, 0, 1, 1)
  const [r, g, b] = x.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = fail
    img.src = src
  })
}

/** La medalla ya dibujada en la página (`[data-export-medal] svg`), como imagen. */
async function medalImage(root: Element) {
  const svg = root.querySelector("[data-export-medal] svg")
  if (!svg) return null
  const xml = new XMLSerializer().serializeToString(svg)
  try {
    return await loadImage(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
    )
  } catch {
    return null
  }
}

export async function renderRecap(r: SeasonRecap, d: Derived, root: Element) {
  await Promise.all([
    document.fonts.load(`600 20px ${SANS}`),
    document.fonts.load(`700 20px ${SANS}`),
    document.fonts.load(`600 20px ${MONO}`),
  ])
  const [bg, logo, medal] = await Promise.all([
    loadImage(heroWebp).catch(() => null),
    loadImage(lockup).catch(() => null),
    medalImage(root),
  ])
  const c = palette(root)

  const H = 1560
  const canvas = document.createElement("canvas")
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const g = canvas.getContext("2d")!
  g.scale(SCALE, SCALE)

  // ---------- helpers ----------
  const font = (size: number, weight = 400, mono = false) => {
    g.font = `${weight} ${size}px ${mono ? MONO : SANS}`
  }
  const text = (
    s: string,
    x: number,
    y: number,
    o: {
      size: number
      weight?: number
      mono?: boolean
      color?: string
      align?: CanvasTextAlign
      max?: number
    }
  ) => {
    font(o.size, o.weight ?? 400, o.mono)
    g.fillStyle = o.color ?? c.fg
    g.textAlign = o.align ?? "left"
    g.textBaseline = "alphabetic"
    let t = s
    if (o.max)
      while (t.length > 1 && g.measureText(t).width > o.max)
        t = t.slice(0, -2) + "…"
    g.fillText(t, x, y)
    return g.measureText(t).width
  }
  const rrect = (
    x: number,
    y: number,
    w: number,
    h: number,
    rad: number,
    fill?: string,
    stroke?: string
  ) => {
    g.beginPath()
    g.roundRect(x, y, w, h, rad)
    if (fill) {
      g.fillStyle = fill
      g.fill()
    }
    if (stroke) {
      g.strokeStyle = stroke
      g.lineWidth = 1
      g.stroke()
    }
  }
  const card = (x: number, y: number, w: number, h: number) =>
    rrect(x, y, w, h, 16, c.card, c.line)
  const kicker = (s: string, x: number, y: number, color = c.primary) =>
    text(s.toUpperCase().split("").join(String.fromCharCode(8202)), x, y, {
      size: 12,
      weight: 600,
      mono: true,
      color,
    })
  const kv = (
    x: number,
    y: number,
    w: number,
    label: string,
    value: string,
    color?: string
  ) => {
    rrect(x, y, w, 64, 12, c.box, c.line)
    text(label, x + 14, y + 24, { size: 12, color: c.muted })
    text(value, x + 14, y + 50, { size: 21, weight: 600, mono: true, color })
  }
  const levelRing = (cx: number, cy: number, rad: number, level: number) => {
    const n = Math.max(0, Math.min(10, Math.round(level)))
    for (let i = 0; i < 10; i++) {
      const a0 = -Math.PI / 2 + (i / 10) * Math.PI * 2 + 0.09
      const a1 = -Math.PI / 2 + ((i + 1) / 10) * Math.PI * 2 - 0.09
      g.beginPath()
      g.arc(cx, cy, rad, a0, a1)
      g.strokeStyle = i < n ? c.level(n) : c.levelOff
      g.lineWidth = rad * 0.22
      g.lineCap = "butt"
      g.stroke()
    }
    text(String(level), cx, cy + rad * 0.36, {
      size: rad * 0.95,
      weight: 800,
      align: "center",
    })
  }

  // ---------- fondo ----------
  g.fillStyle = c.bg
  g.fillRect(0, 0, W, H)
  if (bg) {
    g.save()
    g.globalAlpha = 0.2
    g.globalCompositeOperation = "screen"
    g.filter = "invert(1) contrast(1.2)"
    const h = H
    const w = (bg.width / bg.height) * h
    g.drawImage(bg, W - w, 0, w, h)
    g.restore()
  }
  const fade = g.createLinearGradient(0, 0, W, 0)
  fade.addColorStop(0, c.bg)
  fade.addColorStop(0.32, c.bg)
  fade.addColorStop(0.7, "transparent")
  g.fillStyle = fade
  g.fillRect(0, 0, W, H)

  // ---------- encabezado ----------
  let y = PAD
  g.save()
  g.beginPath()
  g.arc(PAD + 30, y + 30, 30, 0, Math.PI * 2)
  g.fillStyle = "#262626"
  g.fill()
  g.strokeStyle = c.primary
  g.lineWidth = 2
  g.stroke()
  g.restore()
  text(r.player.nick.charAt(0).toUpperCase(), PAD + 30, y + 39, {
    size: 24,
    weight: 600,
    align: "center",
  })
  kicker(`Recap · ${r.season.name}`, PAD + 78, y + 12)
  text(r.player.nick, PAD + 78, y + 52, { size: 40, weight: 700, max: 640 })
  text(
    `Del ${dateLabel(r.season.starts_at)} al ${dateLabel(recapEnd(r))} · ${r.season.players} jugadores en la temporada`,
    PAD + 78,
    y + 78,
    { size: 15, color: c.muted }
  )
  if (logo) {
    const lh = 34
    const lw = (logo.width / logo.height) * lh
    g.drawImage(logo, W - PAD - lw, y + 8, lw, lh)
  }
  y += 108

  // Tus mejores marcas
  if (d.marks.length) {
    let x = PAD
    for (const k of d.marks) {
      const label = `🏆 Top ${Math.max(1, 100 - r.compare[k].pct)}% en ${statLabel(k).split(" (")[0]}`
      font(14, 500)
      const w = g.measureText(label).width + 28
      rrect(x, y, w, 32, 16, "rgba(251,191,36,.10)", "rgba(251,191,36,.40)")
      text(label, x + 14, y + 21, { size: 14, weight: 500, color: c.amber })
      x += w + 8
    }
    y += 50
  }

  // ---------- puesto y ELO ----------
  const leftW = 360
  const rightW = W - PAD * 2 - leftW - GAP
  const rowH = 330
  card(PAD, y, leftW, rowH)
  const cx = PAD + leftW / 2
  if (medal) {
    const mw = 104
    g.drawImage(medal, cx - mw / 2, y + 24, mw, mw * (300 / 260))
  } else {
    levelRing(cx, y + 80, 44, r.final.level ?? 1)
  }
  if (r.final.eligible && r.final.rank !== null) {
    text(`#${r.final.rank}`, cx, y + 210, {
      size: 58,
      weight: 600,
      mono: true,
      align: "center",
    })
    text(
      `Puesto final de ${r.final.total_ranked}${r.final.medal ? ` · ${r.final.medal.name}` : ""}`,
      cx,
      y + 240,
      { size: 14, color: c.muted, align: "center" }
    )
    if (r.prev?.rank) {
      const diff = r.prev.rank - r.final.rank
      if (diff)
        text(
          `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)} puestos vs T${r.season.number - 1}`,
          cx,
          y + 264,
          {
            size: 12.5,
            weight: 500,
            color: diff > 0 ? c.win : c.loss,
            align: "center",
          }
        )
    }
  } else {
    text("No clasificó", cx, y + 200, {
      size: 26,
      weight: 600,
      align: "center",
    })
    text("No llegó al mínimo de mixes", cx, y + 228, {
      size: 14,
      color: c.muted,
      align: "center",
    })
  }
  text("Nivel final", cx - 14, y + 302, {
    size: 14,
    color: c.muted,
    align: "right",
  })
  levelRing(cx + 12, y + 297, 12, r.final.level ?? 1)

  const ex = PAD + leftW + GAP
  card(ex, y, rightW, rowH)
  kicker("Evolución de ELO", ex + 20, y + 32)
  text(signed(d.delta), ex + rightW - 20, y + 34, {
    size: 19,
    weight: 600,
    mono: true,
    align: "right",
    color: d.delta >= 0 ? c.win : c.loss,
  })
  // Curva
  const pts = r.elo.points.map((p) => p.elo_after)
  const all = [r.elo.start, ...pts]
  const min = Math.min(...all) - 20
  const max = Math.max(...all) + 20
  const gx = ex + 20
  const gw = rightW - 40
  const gy = y + 58
  const gh = 160
  const px = (i: number) => gx + (i / (all.length - 1)) * gw
  const py = (v: number) => gy + gh - ((v - min) / (max - min)) * gh
  // El relleno es el color de la línea (pasado a RGB) con un degradado de opacidad.
  const [pr, pg, pb] = rgbOf(c.primary)
  const area = g.createLinearGradient(0, gy, 0, gy + gh)
  area.addColorStop(0, `rgba(${pr},${pg},${pb},.32)`)
  area.addColorStop(1, `rgba(${pr},${pg},${pb},0)`)
  g.beginPath()
  g.moveTo(px(0), gy + gh)
  all.forEach((v, i) => g.lineTo(px(i), py(v)))
  g.lineTo(px(all.length - 1), gy + gh)
  g.closePath()
  g.fillStyle = area
  g.fill()
  g.beginPath()
  all.forEach((v, i) => (i ? g.lineTo(px(i), py(v)) : g.moveTo(px(i), py(v))))
  g.strokeStyle = c.primary
  g.lineWidth = 2.5
  g.lineJoin = "round"
  g.stroke()
  const floor = [0, 501, 751, 901, 1051, 1201, 1351, 1531, 1751, 2001][
    (r.final.level ?? 1) - 1
  ]
  if (floor !== undefined && floor > min && floor < max) {
    g.setLineDash([4, 4])
    g.beginPath()
    g.moveTo(gx, py(floor))
    g.lineTo(gx + gw, py(floor))
    g.strokeStyle = c.muted
    g.globalAlpha = 0.6
    g.lineWidth = 1
    g.stroke()
    g.setLineDash([])
    g.globalAlpha = 1
    text(`Nivel ${r.final.level ?? 1} · ${floor}`, gx + gw, py(floor) - 6, {
      size: 11,
      mono: true,
      color: c.muted,
      align: "right",
    })
  }
  const kw = (rightW - 40 - GAP * 2) / 3
  kv(ex + 20, y + rowH - 84, kw, "Empezó", fmt(r.elo.start))
  kv(ex + 20 + kw + GAP, y + rowH - 84, kw, "Pico", fmt(r.elo.peak))
  kv(ex + 20 + (kw + GAP) * 2, y + rowH - 84, kw, "Terminó", fmt(r.elo.end))
  y += rowH + 30

  // ---------- números ----------
  kicker("Números", PAD, y)
  y += 14
  const n = r.numbers
  const tiles: [string, string, string?][] = [
    ["Mixes", String(r.mixes.matches)],
    ["Rondas", fmt(r.mixes.rounds)],
    ["Horas", `~${fmt(r.mixes.hours, 1)}`],
    ["Victorias", `${d.wr}%`, d.wr >= 50 ? c.win : c.loss],
    ["Mejor racha", String(r.record.best_streak)],
    ["Kills", fmt(n.kills)],
    ["Muertes", fmt(n.deaths)],
    ["Asistencias", String(n.assists)],
    ["K/D", fmt(d.kd, 2)],
    ["% HS", `${n.hs_pct}%`],
    ["ADR", fmt(n.adr, 1)],
    ["Rating", fmt(n.rating ?? 0, 2)],
    ["3K", String(n.k3)],
    ["Aperturas", String(n.first_kills)],
    ["4K", String(n.k4)],
  ]
  const keys: StatKey[] = [
    "matches",
    "rounds",
    "hours",
    "win_pct",
    "best_streak",
    "kills",
    "deaths",
    "assists",
    "kd",
    "hs_pct",
    "adr",
    "rating",
    "k3",
    "first_kills",
    "k4",
  ]
  const tw = (W - PAD * 2 - GAP * 4) / 5
  const th = 86
  tiles.forEach(([label, value, color], i) => {
    const x = PAD + (i % 5) * (tw + GAP)
    const ty = y + Math.floor(i / 5) * (th + GAP)
    rrect(x, ty, tw, th, 14, c.card, c.line)
    text(label, x + 16, ty + 26, { size: 13, color: c.muted })
    text(value, x + 16, ty + 58, { size: 23, weight: 600, mono: true, color })
    const avg = r.compare[keys[i]]?.avg
    if (avg !== undefined)
      text(
        `prom. ${fmt(avg, avg % 1 ? (keys[i] === "kd" || keys[i] === "rating" ? 2 : 1) : 0)}`,
        x + tw - 14,
        ty + 26,
        {
          size: 11,
          color: c.muted,
          align: "right",
        }
      )
  })
  y += (th + GAP) * 3 + 20

  // ---------- mapas, arma y mejor partida ----------
  const cw = (W - PAD * 2 - GAP * 2) / 3
  const ch = 300
  card(PAD, y, cw, ch)
  kicker("Mapas", PAD + 20, y + 32)
  text("mixes · victorias", PAD + cw - 20, y + 32, {
    size: 12,
    color: c.muted,
    align: "right",
  })
  const maps = [...r.maps].sort((a, b) => b.matches - a.matches).slice(0, 7)
  const maxPlays = maps[0]?.matches ?? 1
  maps.forEach((m, i) => {
    const my = y + 64 + i * 32
    text(mapLabel(m.name), PAD + 20, my + 5, { size: 14, weight: 500, max: 90 })
    rrect(PAD + 118, my - 3, cw - 230, 6, 3, "rgba(255,255,255,.10)")
    rrect(
      PAD + 118,
      my - 3,
      (cw - 230) * (m.matches / maxPlays),
      6,
      3,
      c.primary
    )
    const pct = Math.round((m.wins / m.matches) * 100)
    text(`${pct}%`, PAD + cw - 20, my + 5, {
      size: 12.5,
      mono: true,
      align: "right",
      color: pct >= 50 ? c.win : c.loss,
    })
    text(`${m.matches} ·`, PAD + cw - 58, my + 5, {
      size: 12.5,
      mono: true,
      align: "right",
    })
  })

  const wx = PAD + cw + GAP
  card(wx, y, cw, ch)
  kicker("Arma favorita", wx + 20, y + 32)
  if (r.weapon) {
    text(WEAPONS[r.weapon.name] ?? r.weapon.name, wx + 20, y + 84, {
      size: 38,
      weight: 700,
    })
    text(`El ${r.weapon.share_pct}% de tus kills`, wx + 20, y + 112, {
      size: 14,
      color: c.muted,
    })
    rrect(wx + 20, y + 128, cw - 40, 8, 4, "rgba(255,255,255,.10)")
    rrect(
      wx + 20,
      y + 128,
      (cw - 40) * (r.weapon.share_pct / 100),
      8,
      4,
      c.primary
    )
    const hw = (cw - 40 - GAP) / 2
    kv(wx + 20, y + ch - 84, hw, "Kills", fmt(r.weapon.kills))
    kv(wx + 20 + hw + GAP, y + ch - 84, hw, "% HS", `${r.weapon.hs_pct}%`)
  } else {
    text("Sin registro de kills esta temporada", wx + 20, y + 70, {
      size: 14,
      color: c.muted,
    })
  }

  const bx = wx + cw + GAP
  const m = r.best_match
  card(bx, y, cw, ch)
  kicker("Mejor partida", bx + 20, y + 32)
  if (m) {
    text(dateLabel(m.date), bx + 20, y + 62, { size: 13, color: c.muted })
    text(mapLabel(m.map), bx + 20, y + 94, { size: 28, weight: 600 })
    text(
      `${m.score[0]}–${m.score[1]} ${m.won ? "ganado" : "perdido"}`,
      bx + 20,
      y + 122,
      {
        size: 16,
        weight: 600,
        mono: true,
        color: m.won ? c.win : c.loss,
      }
    )
    const qw = (cw - 40 - GAP * 2) / 3
    kv(bx + 20, y + ch - 84, qw, "K/D", `${m.kills}/${m.deaths}`)
    kv(bx + 20 + qw + GAP, y + ch - 84, qw, "ADR", fmt(m.adr, 0))
    kv(
      bx + 20 + (qw + GAP) * 2,
      y + ch - 84,
      qw,
      "Rating",
      fmt(m.rating ?? 0, 2)
    )
  }
  y += ch + GAP

  // ---------- compañeros y rivales ----------
  const hw2 = (W - PAD * 2 - GAP) / 2
  const ph = 190
  const person = (
    x: number,
    py0: number,
    tag: string,
    nick: string,
    note: string,
    level: number
  ) => {
    g.beginPath()
    g.arc(x + 20, py0 + 20, 20, 0, Math.PI * 2)
    g.fillStyle = "#262626"
    g.fill()
    text(nick.charAt(0).toUpperCase(), x + 20, py0 + 26, {
      size: 15,
      weight: 600,
      align: "center",
    })
    text(tag, x + 52, py0 + 8, { size: 11.5, weight: 500, color: c.primary })
    text(nick, x + 52, py0 + 27, { size: 16, weight: 600, max: hw2 - 140 })
    text(note, x + 52, py0 + 45, { size: 12.5, color: c.muted })
    levelRing(x + hw2 - 60, py0 + 20, 11, level)
  }
  card(PAD, y, hw2, ph)
  kicker("Compañeros", PAD + 20, y + 32)
  if (r.mates) {
    person(
      PAD + 20,
      y + 56,
      "Más fiel",
      r.mates.most_played.nick,
      `${r.mates.most_played.together} mixes juntos`,
      r.mates.most_played.level
    )
    person(
      PAD + 20,
      y + 118,
      "Dupla ganadora",
      r.mates.most_wins.nick,
      `${r.mates.most_wins.won} de ${r.mates.most_wins.together} ganados`,
      r.mates.most_wins.level
    )
  }

  const rx = PAD + hw2 + GAP
  card(rx, y, hw2, ph)
  kicker("Rivales", rx + 20, y + 32)
  if (r.rivals?.victim && r.rivals.nemesis) {
    person(
      rx + 20,
      y + 56,
      "Víctima",
      r.rivals.victim.nick,
      `Lo bajaste ${r.rivals.victim.you_killed} veces`,
      r.rivals.victim.level
    )
    person(
      rx + 20,
      y + 118,
      "Némesis",
      r.rivals.nemesis.nick,
      `Te bajó ${r.rivals.nemesis.killed_you} veces`,
      r.rivals.nemesis.level
    )
  } else {
    text("Sin registro de kills esta temporada", rx + 20, y + 70, {
      size: 14,
      color: c.muted,
    })
  }
  y += ph + 30

  text(`cmleague.lat · Recap de la ${r.season.name}`, W / 2, y, {
    size: 13,
    color: c.muted,
    align: "center",
  })

  // Recorta el alto sobrante.
  const used = (y + 28) * SCALE
  if (used < canvas.height) {
    const out = document.createElement("canvas")
    out.width = canvas.width
    out.height = used
    out.getContext("2d")!.drawImage(canvas, 0, 0)
    return out
  }
  return canvas
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const jpegBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((ok, fail) =>
    canvas.toBlob(
      (b) => (b ? ok(b) : fail(new Error("toBlob"))),
      "image/jpeg",
      0.92
    )
  )

export async function saveJpeg(canvas: HTMLCanvasElement, name: string) {
  download(await jpegBlob(canvas), `${name}.jpg`)
}

/** PDF de una página con la imagen: ancho A4 (595 pt) y el alto que dé la proporción. */
export async function savePdf(canvas: HTMLCanvasElement, name: string) {
  const jpg = new Uint8Array(await (await jpegBlob(canvas)).arrayBuffer())
  const pw = 595
  const ph = Math.round((canvas.height / canvas.width) * pw)
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let len = 0
  const push = (p: string | Uint8Array) => {
    const b = typeof p === "string" ? enc.encode(p) : p
    parts.push(b)
    len += b.length
  }
  const obj = (n: number, body: string | (string | Uint8Array)[]) => {
    offsets[n] = len
    push(`${n} 0 obj\n`)
    for (const p of Array.isArray(body) ? body : [body]) push(p)
    push("\nendobj\n")
  }
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>")
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
  )
  obj(4, [
    `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`,
    jpg,
    "\nendstream",
  ])
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  const xref = len
  push(`xref\n0 6\n0000000000 65535 f \n`)
  for (let i = 1; i <= 5; i++)
    push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`)
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`)
  download(
    new Blob(parts as BlobPart[], { type: "application/pdf" }),
    `${name}.pdf`
  )
}
