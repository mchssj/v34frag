// Catálogo de misiones semanales (docs/bitacora/2026-10-29-misiones-semanales en kyan/pruebas).
//
// Para cambiar las misiones se edita este archivo y nada más:
//   - MISSIONS: una fila por misión. `active: false` la saca de la rotación sin borrarla.
//   - REWARDS: lo que paga cada dificultad (puntos de la tienda o monedas VIP).
//   - SLOTS: cuántas salen por semana de cada dificultad.
//   - AREA_MAX: tope por área dentro de la misma semana.
//   - COOLDOWN_WEEKS: semanas que tiene que esperar una misión para volver a salir.
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
 * Una misión cuya métrica no está lista queda en el catálogo pero no entra en la rotación (`isReady`).
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
  // Web: eventos que se registran con las misiones.
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
  /** Texto que ve el jugador. `{n}` se reemplaza por el objetivo y `{map}` por el mapa. */
  title: string
  area: Area
  metric: Metric
  target: number
  difficulty: Difficulty
  vip: boolean
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
/** Bonus por completar todas las misiones para todos de la semana (puntos). */
export const WEEK_BONUS = 150

export const SLOTS: Record<"normal" | "vip", Record<Difficulty, number>> = {
  normal: { facil: 2, media: 3, dificil: 1 },
  vip: { facil: 1, media: 1, dificil: 1 },
}
export const AREA_MAX: Record<Area, number> = { juego: 4, web: 3, comunidad: 2 }
export const COOLDOWN_WEEKS = 2

const m = (
  id: string,
  title: string,
  area: Area,
  metric: Metric,
  target: number,
  difficulty: Difficulty,
  extra: Partial<Pick<Mission, "vip" | "map" | "weapon" | "active">> = {}
): Mission => ({
  id,
  title,
  area,
  metric,
  target,
  difficulty,
  vip: false,
  active: true,
  ...extra,
})

export const MISSIONS: Mission[] = [
  // ---------- Para todos · fáciles ----------
  m("f-jugar-3", "Jugá {n} mixes", "juego", "mixes_played", 3, "facil"),
  m("f-ganar-1", "Ganá {n} mix", "juego", "mixes_won", 1, "facil"),
  m("f-kills-40", "Hacé {n} kills", "juego", "kills", 40, "facil"),
  m("f-asist-10", "Dá {n} asistencias", "juego", "assists", 10, "facil"),
  m(
    "f-entero-2",
    "Jugá {n} mixes enteros, sin irte antes",
    "juego",
    "full_mixes",
    2,
    "facil"
  ),
  m(
    "f-login-3",
    "Entrá a la web {n} días distintos",
    "web",
    "login_days",
    3,
    "facil"
  ),
  m("f-votar-5", "Votá {n} clips", "web", "clips_voted", 5, "facil"),
  m(
    "f-comparar-2",
    "Comparate con {n} jugadores",
    "web",
    "compares",
    2,
    "facil"
  ),
  m(
    "f-equipar-1",
    "Equipá un cosmético",
    "web",
    "cosmetics_equipped",
    1,
    "facil"
  ),
  m("f-demo-1", "Mirá una demo de un mix", "web", "demos_watched", 1, "facil"),
  m(
    "f-buscar-2",
    "Buscá jugadores o partidas con filtros {n} veces",
    "web",
    "searches",
    2,
    "facil"
  ),
  m(
    "f-grupo-1",
    "Jugá {n} mix con alguien de tu grupo",
    "comunidad",
    "party_mixes",
    1,
    "facil"
  ),
  m("f-plantar-3", "Plantá {n} bombas", "juego", "plants", 3, "facil"),
  m(
    "f-sobrevivir-15",
    "Sobreviví {n} rondas",
    "juego",
    "rounds_survived",
    15,
    "facil"
  ),

  // ---------- Para todos · medias ----------
  m("m-ganar-3", "Ganá {n} mixes", "juego", "mixes_won", 3, "media"),
  m("m-jugar-6", "Jugá {n} mixes", "juego", "mixes_played", 6, "media"),
  m("m-hs-40", "Hacé {n} headshots", "juego", "headshots", 40, "media"),
  m("m-dmg-4000", "Hacé {n} de daño", "juego", "damage", 4000, "media"),
  m("m-entradas-8", "Ganá {n} entradas", "juego", "first_kills", 8, "media"),
  m(
    "m-triple-3",
    "Hacé {n} rondas de 3 kills o más",
    "juego",
    "triple_kills",
    3,
    "media"
  ),
  m("m-dust2-3", "Jugá {n} mixes en {map}", "juego", "map_mixes", 3, "media", {
    map: "de_dust2",
  }),
  m(
    "m-inferno-3",
    "Jugá {n} mixes en {map}",
    "juego",
    "map_mixes",
    3,
    "media",
    { map: "de_inferno" }
  ),
  m(
    "m-mapas-4",
    "Jugá en {n} mapas distintos",
    "juego",
    "maps_distinct",
    4,
    "media"
  ),
  m("m-clip-1", "Subí {n} clip", "web", "clips_uploaded", 1, "media"),
  m("m-demo-2", "Mirá {n} demos", "web", "demos_watched", 2, "media"),
  m(
    "m-grupo-3",
    "Jugá {n} mixes con alguien de tu grupo",
    "comunidad",
    "party_mixes",
    3,
    "media"
  ),
  m(
    "m-evento-1",
    "Anotate en un evento",
    "comunidad",
    "event_signups",
    1,
    "media"
  ),
  m("m-defuse-2", "Desactivá {n} bombas", "juego", "defuses", 2, "media"),
  m(
    "m-pistola-3",
    "Ganá {n} rondas de pistola",
    "juego",
    "pistol_won",
    3,
    "media"
  ),
  m(
    "m-awp-10",
    "Hacé {n} kills con {weapon}",
    "juego",
    "weapon_kills",
    10,
    "media",
    { weapon: "awp" }
  ),
  m(
    "m-deagle-8",
    "Hacé {n} kills con {weapon}",
    "juego",
    "weapon_kills",
    8,
    "media",
    { weapon: "deagle" }
  ),

  // ---------- Para todos · difíciles ----------
  m("d-ganar-6", "Ganá {n} mixes", "juego", "mixes_won", 6, "dificil"),
  m(
    "d-racha-3",
    "Ganá {n} mixes seguidos",
    "juego",
    "win_streak",
    3,
    "dificil"
  ),
  m(
    "d-rating-3",
    "Terminá {n} mixes con rating de 1,20 o más",
    "juego",
    "good_rating_mixes",
    3,
    "dificil"
  ),
  m("d-kills-150", "Hacé {n} kills", "juego", "kills", 150, "dificil"),
  m(
    "d-entradas-20",
    "Ganá {n} entradas",
    "juego",
    "first_kills",
    20,
    "dificil"
  ),
  m("d-pcw-1", "Jugá un PCW", "comunidad", "pcw_played", 1, "dificil"),
  m(
    "d-invitar-1",
    "Invitá a un amigo que juegue su primer mix",
    "comunidad",
    "invited_new",
    1,
    "dificil"
  ),
  m("d-clutch-2", "Ganá {n} clutchs", "juego", "clutches", 2, "dificil"),
  m("d-eco-1", "Ganá una ronda eco", "juego", "eco_won", 1, "dificil"),

  // ---------- VIP · fáciles ----------
  m("vf-jugar-4", "Jugá {n} mixes", "juego", "mixes_played", 4, "facil", {
    vip: true,
  }),
  m("vf-hs-20", "Hacé {n} headshots", "juego", "headshots", 20, "facil", {
    vip: true,
  }),
  m(
    "vf-exportar-1",
    "Exportá tu tarjeta de stats",
    "web",
    "stats_exported",
    1,
    "facil",
    { vip: true }
  ),
  m(
    "vf-buscar-3",
    "Usá el buscador con filtros {n} veces",
    "web",
    "searches",
    3,
    "facil",
    { vip: true }
  ),
  m(
    "vf-login-5",
    "Entrá a la web {n} días distintos",
    "web",
    "login_days",
    5,
    "facil",
    { vip: true }
  ),

  // ---------- VIP · medias ----------
  m("vm-ganar-4", "Ganá {n} mixes", "juego", "mixes_won", 4, "media", {
    vip: true,
  }),
  m(
    "vm-triple-5",
    "Hacé {n} rondas de 3 kills o más",
    "juego",
    "triple_kills",
    5,
    "media",
    { vip: true }
  ),
  m(
    "vm-tuscan-3",
    "Jugá {n} mixes en {map}",
    "juego",
    "map_mixes",
    3,
    "media",
    { vip: true, map: "de_tuscan" }
  ),
  m(
    "vm-comprar-1",
    "Comprá algo en la tienda",
    "web",
    "shop_purchases",
    1,
    "media",
    { vip: true }
  ),
  m("vm-clips-2", "Subí {n} clips", "web", "clips_uploaded", 2, "media", {
    vip: true,
  }),
  m(
    "vm-bombas-3",
    "Hacé explotar {n} bombas",
    "juego",
    "bombs_exploded",
    3,
    "media",
    { vip: true }
  ),

  // ---------- VIP · difíciles ----------
  m("vd-ace-1", "Hacé un ace", "juego", "aces", 1, "dificil", { vip: true }),
  m(
    "vd-racha-4",
    "Ganá {n} mixes seguidos",
    "juego",
    "win_streak",
    4,
    "dificil",
    { vip: true }
  ),
  m(
    "vd-rating-5",
    "Terminá {n} mixes con rating de 1,20 o más",
    "juego",
    "good_rating_mixes",
    5,
    "dificil",
    { vip: true }
  ),
  m("vd-dmg-10000", "Hacé {n} de daño", "juego", "damage", 10000, "dificil", {
    vip: true,
  }),
  m("vd-pcw-2", "Jugá {n} PCW", "comunidad", "pcw_played", 2, "dificil", {
    vip: true,
  }),
  m("vd-clutch-3", "Ganá {n} clutchs", "juego", "clutches", 3, "dificil", {
    vip: true,
  }),
  m(
    "vd-cuchillo-1",
    "Hacé una kill con {weapon}",
    "juego",
    "weapon_kills",
    1,
    "dificil",
    { vip: true, weapon: "knife" }
  ),
]

/** Fuentes de datos que ya existen. Cuando salga el plugin con schema 2, se suma "plugin_v2" acá. */
export const READY_SOURCES: MetricSource[] = ["plugin", "web"]

/** La misión entra en la rotación: está activa y su métrica ya se puede medir. */
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
