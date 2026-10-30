// Catálogo de misiones (docs/bitacora/2026-10-29-misiones-semanales en kyan/pruebas).
//
// Hay dos listas:
//   - MISSIONS: las semanales, de juego y comunidad. Rotan al azar cada lunes.
//   - FIRST_STEPS: "Primeros pasos", las de la web (votar un clip, subir un clip, entrar 3 días…). Se hacen
//     una sola vez desde que te registrás: no rotan, no se reinician y pagan una vez.
//
// Para cambiar las misiones se edita este archivo y nada más:
//   - Una fila por misión. `active: false` la apaga sin borrarla.
//   - REWARDS: lo que paga cada dificultad (puntos de la tienda o monedas VIP). WEEK_BONUS: el bonus semanal.
//   - SLOTS: cuántas semanales salen de cada dificultad.
//   - COOLDOWN_WEEKS: semanas que tiene que esperar una semanal para volver a salir.
//   - READY_SOURCES: qué fuentes de datos ya existen.
// En la versión real esto vive en la tabla `missions` y se edita desde Admin → Misiones.

export type Area = "juego" | "web" | "comunidad"
export type Difficulty = "facil" | "media" | "dificil"

/**
 * De dónde sale cada métrica, con el mismo cruce que docs/MEDALLAS_DATOS_REPORTER.md (las medallas y las
 * misiones usan los mismos datos del servidor):
 *   - `plugin`: ya lo manda el csstv_reporter 1.8.0 (schema 1).
 *   - `plugin_v2`: hay que pedirlo en la próxima versión del plugin (schema 2): kills por arma, clutchs,
 *     contadores por ronda y bombas explotadas.
 *   - `web`: un evento de la web que se registra junto con las misiones.
 *   - `sistema`: necesita un sistema que todavía no existe (referidos, grupos del matchmaking).
 * Una misión cuya métrica no está lista queda en el catálogo pero no se muestra (`isReady`).
 */
export type MetricSource = "plugin" | "plugin_v2" | "web" | "sistema"

export const METRICS = {
  // Juego, con lo que ya manda el plugin (match_player_stats y el registro de la partida).
  mixes_played: { label: "Mixes jugados", source: "plugin" },
  mixes_won: { label: "Mixes ganados", source: "plugin" },
  kills: { label: "Kills (kills)", source: "plugin" },
  headshots: { label: "Headshots (headshots)", source: "plugin" },
  assists: { label: "Asistencias (assists)", source: "plugin" },
  damage: { label: "Daño total (damage)", source: "plugin" },
  first_kills: { label: "Entradas (first_kills)", source: "plugin" },
  triple_kills: {
    label: "Rondas de 3 kills o más (k3 + k4 + k5)",
    source: "plugin",
  },
  aces: { label: "Aces (k5)", source: "plugin" },
  plants: { label: "Bombas plantadas (plants)", source: "plugin" },
  defuses: { label: "Bombas desactivadas (defuses)", source: "plugin" },
  good_rating_mixes: {
    label: "Mixes con rating de 1,20 o más (csstv_rating)",
    source: "plugin",
  },
  map_mixes: { label: "Mixes en un mapa (map)", source: "plugin" },
  maps_distinct: { label: "Mapas distintos jugados (map)", source: "plugin" },
  win_streak: { label: "Racha de victorias (winner)", source: "plugin" },
  full_mixes: {
    label: "Mixes jugados enteros, 90 % de las rondas (rounds)",
    source: "plugin",
  },
  pcw_played: { label: "PCW jugados (tipo de partida)", source: "plugin" },
  // Juego, cuando se reversione el plugin (schema 2, ver MEDALLAS_DATOS_REPORTER.md).
  weapon_kills: {
    label: "Kills con un arma (weapon_kills)",
    source: "plugin_v2",
  },
  clutches: { label: "Clutchs ganados (clutches)", source: "plugin_v2" },
  rounds_survived: {
    label: "Rondas sobrevividas (rounds_survived)",
    source: "plugin_v2",
  },
  pistol_won: {
    label: "Rondas de pistola ganadas (pistol_won)",
    source: "plugin_v2",
  },
  eco_won: { label: "Rondas eco ganadas (eco_won)", source: "plugin_v2" },
  bombs_exploded: {
    label: "Bombas explotadas (bombs_exploded)",
    source: "plugin_v2",
  },
  // Web: eventos que se registran con las misiones. Son las de Primeros pasos.
  login_days: { label: "Días distintos que entraste a la web", source: "web" },
  clips_uploaded: { label: "Clips subidos", source: "web" },
  clips_voted: { label: "Clips votados", source: "web" },
  demos_watched: { label: "Demos abiertas o descargadas", source: "web" },
  compares: { label: "Comparaciones de jugadores", source: "web" },
  searches: { label: "Búsquedas con filtros", source: "web" },
  shop_purchases: { label: "Compras en la tienda", source: "web" },
  cosmetics_equipped: { label: "Cosméticos equipados", source: "web" },
  stats_exported: { label: "Tarjetas de stats exportadas", source: "web" },
  event_signups: { label: "Inscripciones a eventos", source: "web" },
  // Sistemas que todavía no existen.
  party_mixes: {
    label: "Mixes con alguien de tu grupo (grupos del matchmaking)",
    source: "sistema",
  },
  invited_new: {
    label: "Amigos invitados que jugaron su primer mix (referidos)",
    source: "sistema",
  },
} as const satisfies Record<string, { label: string; source: MetricSource }>
export type Metric = keyof typeof METRICS

export interface Mission {
  id: string
  /** Texto que ve el jugador. `{n}` es el objetivo, `{map}` el mapa y `{weapon}` el arma. */
  title: string
  area: Area
  metric: Metric
  target: number
  difficulty: Difficulty
  vip: boolean
  /** true: Primeros pasos (una sola vez por cuenta). false: semanal. */
  once: boolean
  /** Para `map_mixes`. */
  map?: string
  /** Para `weapon_kills`: el nombre del arma en `player_death` (awp, deagle, knife…). */
  weapon?: string
  active: boolean
}

export const REWARDS: Record<"normal" | "vip", Record<Difficulty, number>> = {
  normal: { facil: 30, media: 60, dificil: 120 }, // puntos de la tienda
  vip: { facil: 20, media: 40, dificil: 80 }, // monedas VIP
}
/** Bonus por completar todas las semanales para todos (puntos). */
export const WEEK_BONUS = 150

export const SLOTS: Record<"normal" | "vip", Record<Difficulty, number>> = {
  normal: { facil: 2, media: 3, dificil: 1 },
  vip: { facil: 1, media: 1, dificil: 1 },
}
export const COOLDOWN_WEEKS = 2

type Extra = Partial<Pick<Mission, "vip" | "map" | "weapon" | "active">>
const make =
  (once: boolean) =>
  (
    id: string,
    title: string,
    area: Area,
    metric: Metric,
    target: number,
    difficulty: Difficulty,
    extra: Extra = {}
  ): Mission => ({
    id,
    title,
    area,
    metric,
    target,
    difficulty,
    vip: false,
    once,
    active: true,
    ...extra,
  })
const w = make(false)
const o = make(true)
const VIP = { vip: true }

/** Semanales: de juego y comunidad. */
export const MISSIONS: Mission[] = [
  // ---------- Para todos · fáciles ----------
  w("f-jugar-3", "Jugá {n} mixes", "juego", "mixes_played", 3, "facil"),
  w("f-ganar-1", "Ganá {n} mix", "juego", "mixes_won", 1, "facil"),
  w("f-kills-40", "Hacé {n} kills", "juego", "kills", 40, "facil"),
  w("f-asist-10", "Dá {n} asistencias", "juego", "assists", 10, "facil"),
  w(
    "f-entero-2",
    "Jugá {n} mixes enteros, sin irte antes",
    "juego",
    "full_mixes",
    2,
    "facil"
  ),
  w("f-plantar-3", "Plantá {n} bombas", "juego", "plants", 3, "facil"),
  w("f-hs-15", "Hacé {n} headshots", "juego", "headshots", 15, "facil"),
  w("f-dmg-1500", "Hacé {n} de daño", "juego", "damage", 1500, "facil"),
  w("f-entradas-3", "Ganá {n} entradas", "juego", "first_kills", 3, "facil"),
  w("f-nuke-1", "Jugá {n} mix en {map}", "juego", "map_mixes", 1, "facil", {
    map: "de_nuke",
  }),
  w(
    "f-mapas-2",
    "Jugá en {n} mapas distintos",
    "juego",
    "maps_distinct",
    2,
    "facil"
  ),
  w(
    "f-grupo-1",
    "Jugá {n} mix con alguien de tu grupo",
    "comunidad",
    "party_mixes",
    1,
    "facil"
  ),
  w(
    "f-sobrevivir-15",
    "Sobreviví {n} rondas",
    "juego",
    "rounds_survived",
    15,
    "facil"
  ),

  // ---------- Para todos · medias ----------
  w("m-ganar-3", "Ganá {n} mixes", "juego", "mixes_won", 3, "media"),
  w("m-jugar-6", "Jugá {n} mixes", "juego", "mixes_played", 6, "media"),
  w("m-hs-40", "Hacé {n} headshots", "juego", "headshots", 40, "media"),
  w("m-dmg-4000", "Hacé {n} de daño", "juego", "damage", 4000, "media"),
  w("m-entradas-8", "Ganá {n} entradas", "juego", "first_kills", 8, "media"),
  w(
    "m-triple-3",
    "Hacé {n} rondas de 3 kills o más",
    "juego",
    "triple_kills",
    3,
    "media"
  ),
  w("m-dust2-3", "Jugá {n} mixes en {map}", "juego", "map_mixes", 3, "media", {
    map: "de_dust2",
  }),
  w(
    "m-inferno-3",
    "Jugá {n} mixes en {map}",
    "juego",
    "map_mixes",
    3,
    "media",
    { map: "de_inferno" }
  ),
  w(
    "m-mapas-4",
    "Jugá en {n} mapas distintos",
    "juego",
    "maps_distinct",
    4,
    "media"
  ),
  w("m-defuse-2", "Desactivá {n} bombas", "juego", "defuses", 2, "media"),
  w(
    "m-grupo-3",
    "Jugá {n} mixes con alguien de tu grupo",
    "comunidad",
    "party_mixes",
    3,
    "media"
  ),
  w(
    "m-pistola-3",
    "Ganá {n} rondas de pistola",
    "juego",
    "pistol_won",
    3,
    "media"
  ),
  w(
    "m-awp-10",
    "Hacé {n} kills con {weapon}",
    "juego",
    "weapon_kills",
    10,
    "media",
    { weapon: "awp" }
  ),
  w(
    "m-deagle-8",
    "Hacé {n} kills con {weapon}",
    "juego",
    "weapon_kills",
    8,
    "media",
    { weapon: "deagle" }
  ),

  // ---------- Para todos · difíciles ----------
  w("d-ganar-6", "Ganá {n} mixes", "juego", "mixes_won", 6, "dificil"),
  w(
    "d-racha-3",
    "Ganá {n} mixes seguidos",
    "juego",
    "win_streak",
    3,
    "dificil"
  ),
  w(
    "d-rating-3",
    "Terminá {n} mixes con rating de 1,20 o más",
    "juego",
    "good_rating_mixes",
    3,
    "dificil"
  ),
  w("d-kills-150", "Hacé {n} kills", "juego", "kills", 150, "dificil"),
  w(
    "d-entradas-20",
    "Ganá {n} entradas",
    "juego",
    "first_kills",
    20,
    "dificil"
  ),
  w("d-pcw-1", "Jugá un PCW", "comunidad", "pcw_played", 1, "dificil"),
  w(
    "d-invitar-1",
    "Invitá a un amigo que juegue su primer mix",
    "comunidad",
    "invited_new",
    1,
    "dificil"
  ),
  w("d-clutch-2", "Ganá {n} clutchs", "juego", "clutches", 2, "dificil"),
  w("d-eco-1", "Ganá una ronda eco", "juego", "eco_won", 1, "dificil"),

  // ---------- VIP · fáciles ----------
  w("vf-jugar-4", "Jugá {n} mixes", "juego", "mixes_played", 4, "facil", VIP),
  w("vf-hs-20", "Hacé {n} headshots", "juego", "headshots", 20, "facil", VIP),
  w("vf-kills-60", "Hacé {n} kills", "juego", "kills", 60, "facil", VIP),
  w("vf-asist-15", "Dá {n} asistencias", "juego", "assists", 15, "facil", VIP),
  w("vf-train-2", "Jugá {n} mixes en {map}", "juego", "map_mixes", 2, "facil", {
    ...VIP,
    map: "de_train",
  }),
  w(
    "vf-entero-3",
    "Jugá {n} mixes enteros, sin irte antes",
    "juego",
    "full_mixes",
    3,
    "facil",
    VIP
  ),

  // ---------- VIP · medias ----------
  w("vm-ganar-4", "Ganá {n} mixes", "juego", "mixes_won", 4, "media", VIP),
  w(
    "vm-triple-5",
    "Hacé {n} rondas de 3 kills o más",
    "juego",
    "triple_kills",
    5,
    "media",
    VIP
  ),
  w(
    "vm-tuscan-3",
    "Jugá {n} mixes en {map}",
    "juego",
    "map_mixes",
    3,
    "media",
    { ...VIP, map: "de_tuscan" }
  ),
  w(
    "vm-entradas-12",
    "Ganá {n} entradas",
    "juego",
    "first_kills",
    12,
    "media",
    VIP
  ),
  w("vm-hs-60", "Hacé {n} headshots", "juego", "headshots", 60, "media", VIP),
  w(
    "vm-bombas-3",
    "Hacé explotar {n} bombas",
    "juego",
    "bombs_exploded",
    3,
    "media",
    VIP
  ),

  // ---------- VIP · difíciles ----------
  w("vd-ace-1", "Hacé un ace", "juego", "aces", 1, "dificil", VIP),
  w(
    "vd-racha-4",
    "Ganá {n} mixes seguidos",
    "juego",
    "win_streak",
    4,
    "dificil",
    VIP
  ),
  w(
    "vd-rating-5",
    "Terminá {n} mixes con rating de 1,20 o más",
    "juego",
    "good_rating_mixes",
    5,
    "dificil",
    VIP
  ),
  w(
    "vd-dmg-10000",
    "Hacé {n} de daño",
    "juego",
    "damage",
    10000,
    "dificil",
    VIP
  ),
  w("vd-pcw-2", "Jugá {n} PCW", "comunidad", "pcw_played", 2, "dificil", VIP),
  w("vd-clutch-3", "Ganá {n} clutchs", "juego", "clutches", 3, "dificil", VIP),
  w(
    "vd-cuchillo-1",
    "Hacé una kill con {weapon}",
    "juego",
    "weapon_kills",
    1,
    "dificil",
    { ...VIP, weapon: "knife" }
  ),
]

/** Primeros pasos: las de la web, una sola vez desde que te registrás. */
export const FIRST_STEPS: Mission[] = [
  o(
    "p-login-3",
    "Entrá a la web {n} días distintos",
    "web",
    "login_days",
    3,
    "facil"
  ),
  o("p-votar-1", "Votá un clip", "web", "clips_voted", 1, "facil"),
  o("p-votar-10", "Votá {n} clips", "web", "clips_voted", 10, "media"),
  o("p-clip-1", "Subí tu primer clip", "web", "clips_uploaded", 1, "media"),
  o("p-demo-1", "Mirá la demo de un mix", "web", "demos_watched", 1, "facil"),
  o(
    "p-comparar-1",
    "Comparate con otro jugador",
    "web",
    "compares",
    1,
    "facil"
  ),
  o(
    "p-buscar-1",
    "Buscá jugadores o partidas con filtros",
    "web",
    "searches",
    1,
    "facil"
  ),
  o(
    "p-equipar-1",
    "Equipá tu primer cosmético",
    "web",
    "cosmetics_equipped",
    1,
    "facil"
  ),
  o(
    "p-comprar-1",
    "Comprá algo en la tienda",
    "web",
    "shop_purchases",
    1,
    "media"
  ),
  o(
    "p-evento-1",
    "Anotate en tu primer evento",
    "comunidad",
    "event_signups",
    1,
    "media"
  ),
  o(
    "p-login-15",
    "Entrá a la web {n} días distintos",
    "web",
    "login_days",
    15,
    "dificil"
  ),
  // VIP
  o(
    "pv-exportar-1",
    "Exportá tu tarjeta de stats",
    "web",
    "stats_exported",
    1,
    "facil",
    VIP
  ),
  o("pv-clips-3", "Subí {n} clips", "web", "clips_uploaded", 3, "media", VIP),
  o(
    "pv-login-30",
    "Entrá a la web {n} días distintos",
    "web",
    "login_days",
    30,
    "dificil",
    VIP
  ),
]

/** Fuentes de datos que ya existen. Cuando salga el plugin con schema 2, se suma "plugin_v2" acá. */
export const READY_SOURCES: MetricSource[] = ["plugin", "web"]

/** La misión se puede mostrar: está activa y su métrica ya se puede medir. */
export const isReady = (x: Mission, ready: MetricSource[] = READY_SOURCES) =>
  x.active && ready.includes(METRICS[x.metric].source)

export const AREA_LABEL: Record<Area, string> = {
  juego: "Juego",
  web: "Web",
  comunidad: "Comunidad",
}
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  facil: "Fácil",
  media: "Media",
  dificil: "Difícil",
}

const WEAPON_LABEL: Record<string, string> = {
  awp: "AWP",
  deagle: "Deagle",
  knife: "cuchillo",
  scout: "Scout",
}

export const titleOf = (x: Mission) =>
  x.title
    .replace("{n}", x.target.toLocaleString("es-AR"))
    .replace("{map}", x.map ?? "")
    .replace("{weapon}", WEAPON_LABEL[x.weapon ?? ""] ?? x.weapon ?? "")

export const rewardOf = (x: Mission) =>
  REWARDS[x.vip ? "vip" : "normal"][x.difficulty]
