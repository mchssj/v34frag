import type { Standing } from "./preview"

// Temporada de ejemplo para /demo/recalculo: 60 jugadores con una semilla fija y vos ("tu.nick").

export const SEASON = {
  name: "Temporada 3",
  // 06:00 de Argentina del día de fin, como el cron del VPS.
  ends_at: "2026-11-05T09:00:00Z",
}
export const ME = "me"

/** Cambio promedio de tus mixes de la temporada (para proyectar). */
export const AVG = { win: 27, loss: -25 }

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NICKS = [
  "kako1",
  "faloxx",
  "gunk",
  "miez1",
  "xino",
  "daook",
  "dary.6",
  "faook8",
  "ruoncs",
  "rory5",
  "kary99",
  "nixx",
  "zooncs",
  "mita_9",
  "peo0",
  "dank",
  "nino",
  "kinkx4",
  "mataok8",
  "ruzz",
  "kita991",
  "gukox",
  "lolito990",
  "xiry19",
  "datax",
  "mary_",
  "ruez.",
  "julo_",
  "tetax",
  "fanko",
  "zony",
  "pezz",
  "kirdx",
  "loon",
  "mirz",
  "faryx",
  "tenk",
  "guzz",
  "lory",
  "nikox",
  "maon",
  "dazz",
  "kito",
  "ruta",
  "pexi",
  "zoko",
  "fani",
  "jury",
  "teon",
  "miko",
  "lalo",
  "gury",
  "nony",
  "kazz",
  "ronk",
  "dito",
  "pety",
  "xion",
  "maty",
]

function make(): Standing[] {
  const r = seeded(3)
  const out: Standing[] = NICKS.map((nick, i) => ({
    id: `p${i}`,
    nick,
    // El top bien arriba de 2001 (los que se reinician) y el resto bajando.
    elo: Math.round(2380 - i * 16 - r() * 14),
    matches: i % 9 === 4 ? 8 + Math.floor(r() * 10) : 20 + Math.floor(r() * 45),
    last_at: `2026-10-${String(10 + Math.floor(r() * 19)).padStart(2, "0")}`,
  }))
  out.push({
    id: ME,
    nick: "tu.nick",
    elo: 2041,
    matches: 17,
    last_at: "2026-10-28",
  })
  return out
}

export const STANDINGS = make()
