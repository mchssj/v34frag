/**
 * Lector del .trk que graba el reporter (csstv/track.inc, bitácora 2026-11-12-repeticion-2d-y-mapa-de-calor).
 * Los tiempos llegan en ticks desde el inicio de la demo; acá se pasan a segundos.
 */

export type Side = 2 | 3 // 2 = T, 3 = CT, como en el juego

export interface TrackPlayer {
  slot: number
  side: Side
  steam: string
  name: string
}

export interface TrackPos {
  slot: number
  x: number
  y: number
  z: number
  yaw: number
  hp: number
  /** Arma en mano (sin "weapon_"); vacía en los .trk anteriores. */
  weapon: string
  bomb: boolean
}

export interface TrackFrame {
  t: number
  ps: TrackPos[]
}

export interface TrackKill {
  t: number
  killer: TrackPlayer | null
  victim: TrackPlayer
  weapon: string
  hs: boolean
  /** Dónde estaba el que mató (null si fue el mundo o un suicidio). */
  from: { x: number; y: number } | null
  at: { x: number; y: number }
}

export interface TrackBomb {
  t: number
  kind: "plant" | "defuse" | "explode"
  x: number
  y: number
  /** Segundos del C4 al plantarla (mp_c4timer). */
  timer?: number
}

/** Un CT desactivando: desde que empieza hasta que la deja, la desactiva o termina la ronda. */
export interface TrackDefuse {
  t: number
  player: TrackPlayer
  kit: boolean
  until: number | null
}

/** Un golpe (player_hurt). */
export interface TrackHit {
  t: number
  attacker: TrackPlayer | null
  victim: TrackPlayer
  dmg: number
  hp: number
  weapon: string
  /** 1 = cabeza, 2 = pecho, 3 = estómago, 4-5 = brazos, 6-7 = piernas. */
  hitgroup: number
}

export type NadeKind = "he" | "flash" | "smoke"

/** Una granada en el aire: los puntos desde que sale hasta que explota (cada 0,1 s). */
export interface TrackNadeFlight {
  kind: NadeKind
  thrower: TrackPlayer | null
  points: { t: number; x: number; y: number }[]
}

/** Dónde explotó una granada. Una flash suma a quiénes cegó y cuánto. */
export interface TrackNadeBurst {
  t: number
  kind: NadeKind
  thrower: TrackPlayer | null
  x: number
  y: number
  blinded: { player: TrackPlayer; secs: number }[]
  /** Humo: hasta cuándo siguió en el mapa según el servidor (null si el .trk no lo trae). */
  until: number | null
  /** Humo: segundos desde que salió en que empieza a irse y en que ya no está (m_FadeStartTime y m_FadeEndTime). */
  fade: [number, number] | null
}

export interface TrackRound {
  n: number
  start: number
  freezeEnd: number | null
  end: number | null
  winner: Side | null
  reason: number | null
  /** Jugadores por slot, como quedaron en esta ronda. */
  players: Record<number, TrackPlayer>
  frames: TrackFrame[]
  kills: TrackKill[]
  bomb: TrackBomb[]
  flights: TrackNadeFlight[]
  bursts: TrackNadeBurst[]
  defuses: TrackDefuse[]
  hits: TrackHit[]
  /** Plata de cada slot al terminar el tiempo de compra. */
  money: Record<number, number>
  /** Duración de la ronda en segundos (mp_roundtime); null si el .trk no la trae. */
  roundTime: number | null
}

/**
 * Lo que dura cada efecto en la repetición, en segundos. El humo dura lo que el servidor dice (`until`, de las
 * líneas S); si no está, lo del juego: lleno 17 s y se va hasta los 22 (SetFadeTime(17, 22) del SDK).
 */
export const NADE_SECONDS: Record<NadeKind, number> = {
  he: 0.7,
  flash: 0.6,
  smoke: 22,
}
export const SMOKE_FADE = 5

/** Fin del efecto de una granada. El humo, como lo ve el jugador: hasta m_FadeEndTime si el .trk lo trae. */
export const burstEnd = (b: TrackNadeBurst) =>
  b.kind !== "smoke"
    ? b.t + NADE_SECONDS[b.kind]
    : b.fade
      ? b.t + b.fade[1]
      : b.until !== null
        ? b.until + 0.5
        : b.t + NADE_SECONDS.smoke

/** Cuánto se ve el humo en t: 1 hasta que empieza a irse y baja a 0 cuando se fue. */
export function smokeOpacity(b: TrackNadeBurst, t: number) {
  const end = burstEnd(b)
  const fadeFrom = b.fade ? b.t + b.fade[0] : end - SMOKE_FADE
  if (t <= fadeFrom) return 1
  return Math.max(0, (end - t) / (end - fadeFrom || 1))
}

const NADE_KINDS = new Set<string>(["he", "flash", "smoke"])

export interface Track {
  map: string
  tickrate: number
  rounds: TrackRound[]
}

/** Arma la partida a partir del texto. Las líneas que no entiende se saltean (versiones nuevas del plugin). */
export function parseTrack(text: string): Track {
  let map = ""
  let tickrate = 66
  const sec = (tick: string) => Number(tick) / tickrate
  const players: Record<number, TrackPlayer> = {}
  // Con !rr se repite el número de ronda: vale la última.
  const rounds = new Map<number, TrackRound>()
  let cur: TrackRound | null = null
  // Granadas en el aire de la ronda actual, por entidad (el número se reusa: un hueco largo empieza otra).
  let open = new Map<string, TrackNadeFlight>()
  // Cegados por ronda: se unen con su flash al final, porque player_blind llega antes que flashbang_detonate.
  // Humos que el servidor ve en el mapa (líneas S): dicen cuánto duró cada uno.
  const smokes = new Map<TrackRound, { t: number; pts: number[][] }[]>()
  const blinds = new Map<
    TrackRound,
    { t: number; player: TrackPlayer; secs: number }[]
  >()

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd()
    if (!line) continue
    const f = line.split(" ")
    switch (f[0]) {
      case "V":
        map = f[2] ?? ""
        tickrate = Number(f[3]) || 66
        break
      case "J": {
        const p: TrackPlayer = {
          slot: Number(f[1]),
          side: Number(f[2]) as Side,
          steam: f[3] ?? "",
          name: f.slice(4).join(" "),
        }
        players[p.slot] = p
        if (cur) cur.players[p.slot] = p
        break
      }
      case "R": {
        cur = {
          n: Number(f[1]),
          start: sec(f[2]),
          freezeEnd: null,
          end: null,
          winner: null,
          reason: null,
          players: { ...players },
          frames: [],
          kills: [],
          bomb: [],
          flights: [],
          bursts: [],
          defuses: [],
          hits: [],
          money: {},
          roundTime: null,
        }
        open = new Map()
        rounds.set(cur.n, cur)
        break
      }
      case "Z":
        if (cur) {
          cur.freezeEnd = sec(f[1])
          cur.roundTime = Number(f[2]) || null
        }
        break
      case "$":
        if (!cur) break
        for (const part of (f[2] ?? "").split(";")) {
          const [slot, money] = part.split(",").map(Number)
          if (slot > 0) cur.money[slot] = money
        }
        break
      case "S": {
        if (!cur) break
        const pts = (f[2] ?? "").split(";").map((x) => x.split(",").map(Number))
        const list = smokes.get(cur) ?? []
        list.push({ t: sec(f[1]), pts })
        smokes.set(cur, list)
        break
      }
      case "D": {
        const player = cur?.players[Number(f[2])]
        if (cur && player)
          cur.defuses.push({
            t: sec(f[1]),
            player,
            kit: f[3] === "1",
            until: null,
          })
        break
      }
      case "A": {
        const d = cur?.defuses.findLast(
          (x) => x.player.slot === Number(f[2]) && x.until === null
        )
        if (d) d.until = sec(f[1])
        break
      }
      case "H": {
        const victim = cur?.players[Number(f[3])]
        if (!cur || !victim) break
        const a = Number(f[2])
        cur.hits.push({
          t: sec(f[1]),
          attacker: a > 0 ? (cur.players[a] ?? null) : null,
          victim,
          dmg: Number(f[4]) || 0,
          hp: Number(f[5]) || 0,
          weapon: f[6] === "-" ? "" : (f[6] ?? ""),
          hitgroup: Number(f[7]) || 0,
        })
        break
      }
      case "F": {
        if (!cur) break
        const ps: TrackPos[] = []
        for (const part of (f[2] ?? "").split(";")) {
          const v = part.split(",")
          if (v.length < 6) continue
          ps.push({
            slot: Number(v[0]),
            x: Number(v[1]),
            y: Number(v[2]),
            z: Number(v[3]),
            yaw: Number(v[4]),
            hp: Number(v[5]),
            // Los .trk del primer formato no traen el arma: el séptimo campo es la "b" de la bomba.
            weapon: v[6] && v[6] !== "b" && v[6] !== "-" ? v[6] : "",
            bomb: v[6] === "b" || v[7] === "b",
          })
        }
        cur.frames.push({ t: sec(f[1]), ps })
        break
      }
      case "K": {
        if (!cur) break
        const victim = cur.players[Number(f[3])]
        if (!victim) break
        const killerSlot = Number(f[2])
        cur.kills.push({
          t: sec(f[1]),
          killer: killerSlot > 0 ? (cur.players[killerSlot] ?? null) : null,
          victim,
          weapon: f[4] === "-" ? "" : (f[4] ?? ""),
          hs: f[5] === "1",
          from: f[6] === "-" ? null : { x: Number(f[6]), y: Number(f[7]) },
          at: { x: Number(f[8]), y: Number(f[9]) },
        })
        break
      }
      case "B":
        if (
          cur &&
          (f[2] === "plant" || f[2] === "defuse" || f[2] === "explode")
        ) {
          const t = sec(f[1])
          cur.bomb.push({
            t,
            kind: f[2],
            x: Number(f[3]),
            y: Number(f[4]),
            timer: f[5] ? Number(f[5]) : undefined,
          })
          // La desactivación en curso termina con la bomba desactivada o explotada.
          if (f[2] !== "plant")
            for (const d of cur.defuses) if (d.until === null) d.until = t
        }
        break
      case "N": {
        if (!cur) break
        const t = sec(f[1])
        for (const part of (f[2] ?? "").split(";")) {
          const v = part.split(",")
          if (v.length < 5 || !NADE_KINDS.has(v[0])) continue
          const key = `${v[0]}:${v[1]}`
          const point = { t, x: Number(v[3]), y: Number(v[4]) }
          const fl = open.get(key)
          if (fl && t - (fl.points.at(-1)?.t ?? 0) < 0.35) fl.points.push(point)
          else {
            const slot = Number(v[2])
            const nf: TrackNadeFlight = {
              kind: v[0] as NadeKind,
              thrower: slot > 0 ? (cur.players[slot] ?? null) : null,
              points: [point],
            }
            open.set(key, nf)
            cur.flights.push(nf)
          }
        }
        break
      }
      case "G": {
        if (!cur || !NADE_KINDS.has(f[2])) break
        const slot = Number(f[3])
        cur.bursts.push({
          t: sec(f[1]),
          kind: f[2] as NadeKind,
          thrower: slot > 0 ? (cur.players[slot] ?? null) : null,
          x: Number(f[4]),
          y: Number(f[5]),
          blinded: [],
          until: null,
          fade: null,
        })
        break
      }
      case "L": {
        if (!cur) break
        const player = cur.players[Number(f[2])]
        if (!player) break
        const list = blinds.get(cur) ?? []
        list.push({ t: sec(f[1]), player, secs: Number(f[3]) || 0 })
        blinds.set(cur, list)
        break
      }
      case "E":
        if (cur) {
          for (const d of cur.defuses) if (d.until === null) d.until = sec(f[1])
          cur.end = sec(f[1])
          cur.winner = Number(f[2]) as Side
          cur.reason = Number(f[3])
        }
        break
    }
  }
  // Cada cegado va a la flash más cercana en el tiempo (el mismo tick o casi).
  for (const [round, list] of blinds)
    for (const b of list) {
      let best: TrackNadeBurst | null = null
      for (const x of round.bursts)
        if (
          x.kind === "flash" &&
          Math.abs(x.t - b.t) <= 0.2 &&
          (!best || Math.abs(x.t - b.t) < Math.abs(best.t - b.t))
        )
          best = x
      best?.blinded.push({ player: b.player, secs: b.secs })
    }
  // Cada humo dura hasta la última línea S con una nube cerca de donde explotó.
  for (const [round, list] of smokes)
    for (const b of round.bursts) {
      if (b.kind !== "smoke") continue
      for (const x of list)
        for (const [px, py, fs, fe] of x.pts)
          if (x.t >= b.t && Math.hypot(px - b.x, py - b.y) < 160) {
            b.until = x.t
            if (!b.fade && fe > 0) b.fade = [fs, fe]
          }
    }
  return {
    map,
    tickrate,
    // Solo las rondas que terminaron: la última de una partida cancelada queda afuera.
    rounds: [...rounds.values()]
      .filter((r) => r.end !== null)
      .sort((a, b) => a.n - b.n),
  }
}

/** Posiciones en el instante t, interpoladas entre los dos cuadros más cercanos. */
export function positionsAt(round: TrackRound, t: number): TrackPos[] {
  const fr = round.frames
  if (!fr.length) return []
  if (t <= fr[0].t) return fr[0].ps
  let lo = 0
  let hi = fr.length - 1
  if (t >= fr[hi].t) return fr[hi].ps
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (fr[mid].t <= t) lo = mid
    else hi = mid
  }
  const a = fr[lo]
  const b = fr[hi]
  const k = (t - a.t) / (b.t - a.t || 1)
  const next = new Map(b.ps.map((p) => [p.slot, p]))
  return a.ps.map((p) => {
    const q = next.get(p.slot)
    if (!q) return p
    let dy = q.yaw - p.yaw
    if (dy > 180) dy -= 360
    if (dy < -180) dy += 360
    return {
      ...p,
      x: p.x + (q.x - p.x) * k,
      y: p.y + (q.y - p.y) * k,
      z: p.z + (q.z - p.z) * k,
      yaw: p.yaw + dy * k,
      hp: k < 0.5 ? p.hp : q.hp,
    }
  })
}

/** Cegado en el instante t: segundos que le quedan a cada slot (solo los que están cegados). */
export function blindAt(
  round: TrackRound,
  t: number
): Map<number, { left: number; secs: number }> {
  const out = new Map<number, { left: number; secs: number }>()
  for (const b of round.bursts)
    for (const x of b.blinded) {
      const left = b.t + x.secs - t
      if (b.t <= t && left > 0 && left > (out.get(x.player.slot)?.left ?? 0))
        out.set(x.player.slot, { left, secs: x.secs })
    }
  return out
}

/** Bomba plantada en el instante t: dónde, cuánto le queda y si ya explotó o la desactivaron. */
export function bombAt(round: TrackRound, t: number) {
  const plant = round.bomb.find((b) => b.kind === "plant" && b.t <= t)
  if (!plant) return null
  const end = round.bomb.find(
    (b) => b.kind !== "plant" && b.t >= plant.t && b.t <= t
  )
  const timer = plant.timer ?? 35
  return {
    x: plant.x,
    y: plant.y,
    timer,
    left: Math.max(0, plant.t + timer - t),
    state: (end?.kind ?? "ticking") as "ticking" | "defuse" | "explode",
  }
}

/** Golpes recientes (se marcan un momento en el radar). */
export const hitsAt = (round: TrackRound, t: number, window = 0.8) =>
  round.hits.filter((h) => h.t <= t && t - h.t < window)

/** Primer y último instante para mostrar de la ronda (con unos segundos después del final). */
export function roundSpan(round: TrackRound): [number, number] {
  const last = round.frames.at(-1)?.t ?? round.end ?? round.start
  return [round.start, Math.max(last, round.end ?? round.start)]
}

/** Motivos de fin de ronda (round_end "reason" de CS:S: el enum del juego más uno). */
export const END_REASON: Record<number, string> = {
  1: "Explotó la bomba",
  7: "Desactivaron la bomba",
  8: "Eliminaron a los T",
  9: "Eliminaron a los CT",
  10: "Empate",
  11: "Rescataron a los rehenes",
  12: "Se acabó el tiempo",
  13: "No rescataron a los rehenes",
}
