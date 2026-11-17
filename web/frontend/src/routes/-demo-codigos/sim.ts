// Reglas de los códigos canjeables del plan docs/bitacora/2026-11-17-codigos-canjeables, en memoria.
// Funciones puras sobre un estado: lo mismo que harían code_redeem y admin_code_create en la base.

export type Reward = "item" | "points" | "vip_coins" | "vip"
export type CodeState =
  "programado" | "activo" | "agotado" | "vencido" | "revocado"

export const DAY = 86_400_000
export const MIN = 60_000

export const REWARD_LABEL: Record<Reward, string> = {
  item: "Artículo",
  points: "Puntos",
  vip_coins: "Monedas VIP",
  vip: "VIP",
}

// Topes contra la fuerza bruta: por cuenta, solo los códigos que no existen.
export const SHORT_FAILS = 5
export const SHORT_WINDOW = 15 * MIN
export const DAY_FAILS = 20
export const MAX_BATCH = 100
export const MAX_USES = 10_000
export const MAX_DAYS = 365

export interface Code {
  id: string
  /** Normalizado: la clave con la que se busca. */
  key: string
  /** Como se muestra: CML-XXXX-XXXX-XXXX o el personalizado. */
  display: string
  custom: boolean
  batch: string
  reward: Reward
  itemId: string | null
  amount: number | null
  /** Días del artículo o del VIP; null = para siempre (solo artículos). */
  days: number | null
  maxUses: number
  uses: number
  forUser: string | null
  startsAt: number
  expiresAt: number | null
  label: string
  note: string
  createdAt: number
  revokedAt: number | null
  revokeReason: string | null
}

export interface Redemption {
  id: string
  codeId: string
  user: string
  at: number
  reward: Reward
  itemId: string | null
  amount: number | null
  /** Hasta cuándo le dura (artículo temporal o VIP). */
  until: number | null
  /** Para revertir: cómo estaba el artículo antes (undefined = no lo tenía). */
  prevItemExpires?: number | null
  vipPeriod?: string
  revertedAt: number | null
  revertReason: string | null
}

export interface Owned {
  user: string
  itemId: string
  /** null = para siempre. */
  expiresAt: number | null
  source: "purchase" | "grant" | "code"
}

export interface VipPeriod {
  id: string
  user: string
  start: number
  /** null = de por vida. */
  end: number | null
  source: "manual" | "code"
  revoked: boolean
}

export interface Account {
  id: string
  alias: string
  points: number
  coins: number
  banned?: boolean
}

export interface Attempt {
  user: string
  at: number
  /** Los primeros 4 caracteres de lo que escribió. */
  typed: string
}

export interface Sim {
  now: number
  accounts: Account[]
  codes: Code[]
  redemptions: Redemption[]
  attempts: Attempt[]
  owned: Owned[]
  vip: VipPeriod[]
}

// ---------- Formato ----------
// Crockford base32: sin I, L, O ni U, para dictarlo sin confusiones.
export const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

/** Lo que escribió el jugador → la clave: mayúsculas, sin espacios ni guiones, O→0 e I/L→1. */
export function normalize(raw: string): string {
  const up = raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
  // El prefijo CML no se toca (su L no es un 1).
  const pre = up.startsWith("CML") ? "CML" : ""
  return pre + up.slice(pre.length).replace(/O/g, "0").replace(/[IL]/g, "1")
}

export function displayOf(key: string): string {
  if (/^CML[0-9A-Z]{12}$/.test(key))
    return `CML-${key.slice(3, 7)}-${key.slice(7, 11)}-${key.slice(11)}`
  return key
}

/** Formato mientras escribe: si empieza con CML pone los guiones; un personalizado queda en mayúsculas. */
export function formatTyping(raw: string): string {
  const up = raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (!up.startsWith("CML") || up.length <= 3) return raw.toUpperCase()
  const body = up.slice(3, 15)
  return ["CML", ...(body.match(/.{1,4}/g) ?? [])].join("-")
}

export type Rand = (n: number) => number

export const cryptoRand: Rand = (n) => {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0]! % n
}

export function randomKey(rand: Rand): string {
  let s = "CML"
  for (let i = 0; i < 12; i++) s += ALPHABET[rand(ALPHABET.length)]
  return s
}

let seq = 0
const uid = (p: string) => `${p}${++seq}`

// ---------- Estado de un código ----------
export function codeState(c: Code, now: number): CodeState {
  if (c.revokedAt !== null) return "revocado"
  if (c.startsAt > now) return "programado"
  if (c.expiresAt !== null && c.expiresAt <= now) return "vencido"
  if (c.uses >= c.maxUses) return "agotado"
  return "activo"
}

// ---------- VIP ----------
export function vipOf(s: Sim, user: string, now = s.now) {
  const mine = s.vip.filter((p) => p.user === user && !p.revoked)
  const lifetime = mine.some((p) => p.end === null && p.start <= now)
  const ends = mine
    .filter((p) => p.end !== null && p.end > now)
    .map((p) => p.end!)
  const active =
    lifetime ||
    mine.some((p) => p.start <= now && (p.end === null || p.end > now))
  return { active, lifetime, until: ends.length ? Math.max(...ends) : null }
}

// ---------- Intentos ----------
/** Día de Bogotá (UTC-5): el inicio del día siguiente a `t`. */
export function nextBogotaDay(t: number): number {
  const off = 5 * 3600_000
  return Math.floor((t - off) / DAY) * DAY + off + DAY
}

/** Si la cuenta está bloqueada, hasta cuándo. */
export function blockedUntil(s: Sim, user: string): number | null {
  const mine = s.attempts
    .filter((a) => a.user === user)
    .sort((a, b) => b.at - a.at)
  const dayStart = nextBogotaDay(s.now) - DAY
  const today = mine.filter((a) => a.at >= dayStart)
  if (today.length >= DAY_FAILS) return nextBogotaDay(s.now)
  const recent = mine.filter((a) => a.at > s.now - SHORT_WINDOW)
  if (recent.length >= SHORT_FAILS) {
    // Se libera 15 minutos después del fallo que completó el tope.
    const until = recent[SHORT_FAILS - 1]!.at + SHORT_WINDOW
    if (until > s.now) return until
  }
  return null
}

export function failsLeft(s: Sim, user: string): number {
  const recent = s.attempts.filter(
    (a) => a.user === user && a.at > s.now - SHORT_WINDOW
  ).length
  return Math.max(0, SHORT_FAILS - recent)
}

// ---------- Crear ----------
export interface CreateInput {
  reward: Reward
  itemId?: string | null
  amount?: number | null
  days?: number | null
  maxUses: number
  count: number
  expiresInDays?: number | null
  forUser?: string | null
  custom?: string | null
  label: string
  note?: string
}

export type CreateResult =
  { ok: true; sim: Sim; codes: Code[] } | { ok: false; error: string }

export function createCodes(
  s: Sim,
  i: CreateInput,
  rand: Rand = cryptoRand
): CreateResult {
  const int = (n: unknown) => typeof n === "number" && Number.isInteger(n)
  if (i.reward === "item" && !i.itemId)
    return { ok: false, error: "Elegí el artículo." }
  if (
    (i.reward === "points" || i.reward === "vip_coins") &&
    (!int(i.amount) || i.amount! < 1 || i.amount! > 100_000)
  )
    return { ok: false, error: "La cantidad va de 1 a 100.000." }
  if (i.reward === "vip" && (!int(i.days) || i.days! < 1 || i.days! > MAX_DAYS))
    return { ok: false, error: `El VIP va de 1 a ${MAX_DAYS} días.` }
  if (
    i.reward === "item" &&
    i.days != null &&
    (!int(i.days) || i.days < 1 || i.days > MAX_DAYS)
  )
    return {
      ok: false,
      error: `La duración va de 1 a ${MAX_DAYS} días, o para siempre.`,
    }
  if (!int(i.maxUses) || i.maxUses < 1 || i.maxUses > MAX_USES)
    return {
      ok: false,
      error: `Los usos van de 1 a ${MAX_USES.toLocaleString("es")}.`,
    }
  if (!int(i.count) || i.count < 1 || i.count > MAX_BATCH)
    return {
      ok: false,
      error: `Se pueden generar de 1 a ${MAX_BATCH} códigos.`,
    }
  if (i.forUser && i.maxUses !== 1)
    return { ok: false, error: "Un código para una sola cuenta tiene 1 uso." }
  const label = i.label.trim()
  if (label.length < 1 || label.length > 80)
    return { ok: false, error: "Poné el nombre del sorteo (hasta 80)." }

  const keys: string[] = []
  const custom = i.custom?.trim() ? i.custom.trim().toUpperCase() : null
  if (custom) {
    if (i.count !== 1)
      return { ok: false, error: "Un código personalizado se genera de a uno." }
    if (!/^[A-Z0-9]{8,24}$/.test(custom))
      return {
        ok: false,
        error:
          "El personalizado lleva de 8 a 24 letras y números, sin espacios.",
      }
    const k = normalize(custom)
    if (s.codes.some((c) => c.key === k))
      return { ok: false, error: "Ese código ya existe." }
    keys.push(k)
  } else {
    while (keys.length < i.count) {
      const k = randomKey(rand)
      if (!keys.includes(k) && !s.codes.some((c) => c.key === k)) keys.push(k)
    }
  }

  const batch = uid("b")
  const codes: Code[] = keys.map((key) => ({
    id: uid("c"),
    key,
    display: custom ?? displayOf(key),
    custom: !!custom,
    batch,
    reward: i.reward,
    itemId: i.reward === "item" ? i.itemId! : null,
    amount:
      i.reward === "points" || i.reward === "vip_coins" ? i.amount! : null,
    days: i.reward === "item" || i.reward === "vip" ? (i.days ?? null) : null,
    maxUses: i.maxUses,
    uses: 0,
    forUser: i.forUser ?? null,
    startsAt: s.now,
    expiresAt: i.expiresInDays ? s.now + i.expiresInDays * DAY : null,
    label,
    note: i.note?.trim() ?? "",
    createdAt: s.now,
    revokedAt: null,
    revokeReason: null,
  }))
  return { ok: true, sim: { ...s, codes: [...codes, ...s.codes] }, codes }
}

// ---------- Canjear ----------
export type RedeemError =
  | "code_invalid"
  | "code_expired"
  | "code_used_up"
  | "code_already_redeemed"
  | "code_not_for_you"
  | "code_already_owned"
  | "code_vip_lifetime"
  | "code_rate_limited"
  | "account_banned"

export type RedeemResult =
  | { ok: true; sim: Sim; redemption: Redemption; code: Code }
  | { ok: false; sim: Sim; error: RedeemError; retryAt?: number }

export function redeem(s: Sim, user: string, raw: string): RedeemResult {
  const acc = s.accounts.find((a) => a.id === user)
  if (!acc || acc.banned) return { ok: false, sim: s, error: "account_banned" }
  const block = blockedUntil(s, user)
  if (block)
    return { ok: false, sim: s, error: "code_rate_limited", retryAt: block }

  const key = normalize(raw)
  const code = s.codes.find((c) => c.key === key)
  const st = code ? codeState(code, s.now) : null
  // No existe, revocado o programado: lo mismo, y cuenta como fallo.
  if (!code || st === "revocado" || st === "programado") {
    const sim = {
      ...s,
      attempts: [...s.attempts, { user, at: s.now, typed: key.slice(0, 4) }],
    }
    const retryAt = blockedUntil(sim, user)
    return retryAt
      ? { ok: false, sim, error: "code_rate_limited", retryAt }
      : { ok: false, sim, error: "code_invalid" }
  }
  if (code.forUser && code.forUser !== user)
    return { ok: false, sim: s, error: "code_not_for_you" }
  if (
    s.redemptions.some(
      (r) => r.codeId === code.id && r.user === user && r.revertedAt === null
    )
  )
    return { ok: false, sim: s, error: "code_already_redeemed" }
  if (st === "vencido") return { ok: false, sim: s, error: "code_expired" }
  if (st === "agotado") return { ok: false, sim: s, error: "code_used_up" }

  const red: Redemption = {
    id: uid("r"),
    codeId: code.id,
    user,
    at: s.now,
    reward: code.reward,
    itemId: code.itemId,
    amount: code.amount,
    until: null,
    revertedAt: null,
    revertReason: null,
  }
  let next: Sim

  if (code.reward === "item") {
    const have = s.owned.find(
      (o) => o.user === user && o.itemId === code.itemId
    )
    // Para siempre: no se gasta el código. Temporal (vigente o vencido): se suman los días o pasa a permanente.
    if (have && have.expiresAt === null)
      return { ok: false, sim: s, error: "code_already_owned" }
    const live =
      have && have.expiresAt !== null && have.expiresAt > s.now
        ? have.expiresAt
        : s.now
    const exp = code.days === null ? null : live + code.days * DAY
    red.prevItemExpires = have ? have.expiresAt : undefined
    red.until = exp
    const others = s.owned.filter(
      (o) => !(o.user === user && o.itemId === code.itemId)
    )
    next = {
      ...s,
      owned: [
        ...others,
        { user, itemId: code.itemId!, expiresAt: exp, source: "code" },
      ],
    }
  } else if (code.reward === "vip") {
    const v = vipOf(s, user)
    if (v.lifetime) return { ok: false, sim: s, error: "code_vip_lifetime" }
    const start = Math.max(s.now, v.until ?? s.now)
    const end = start + code.days! * DAY
    const period: VipPeriod = {
      id: uid("v"),
      user,
      start,
      end,
      source: "code",
      revoked: false,
    }
    red.until = end
    red.vipPeriod = period.id
    next = { ...s, vip: [...s.vip, period] }
  } else {
    const field = code.reward === "points" ? "points" : "coins"
    next = {
      ...s,
      accounts: s.accounts.map((a) =>
        a.id === user ? { ...a, [field]: a[field] + code.amount! } : a
      ),
    }
  }

  const used = { ...code, uses: code.uses + 1 }
  next = {
    ...next,
    codes: next.codes.map((c) => (c.id === code.id ? used : c)),
    redemptions: [red, ...next.redemptions],
  }
  return { ok: true, sim: next, redemption: red, code: used }
}

// ---------- Admin ----------
export function revokeCode(s: Sim, codeId: string, reason: string): Sim {
  return {
    ...s,
    codes: s.codes.map((c) =>
      c.id === codeId && c.revokedAt === null
        ? { ...c, revokedAt: s.now, revokeReason: reason }
        : c
    ),
  }
}

/** Deshace un canje: quita el artículo (o lo deja como estaba), revoca el VIP o descuenta los puntos. */
export function revertRedemption(s: Sim, redId: string, reason: string): Sim {
  const r = s.redemptions.find((x) => x.id === redId)
  if (!r || r.revertedAt !== null) return s
  let next: Sim
  if (r.reward === "item") {
    const others = s.owned.filter(
      (o) => !(o.user === r.user && o.itemId === r.itemId)
    )
    const back =
      r.prevItemExpires === undefined
        ? []
        : [
            {
              user: r.user,
              itemId: r.itemId!,
              expiresAt: r.prevItemExpires,
              source: "code" as const,
            },
          ]
    next = { ...s, owned: [...others, ...back] }
  } else if (r.reward === "vip") {
    next = {
      ...s,
      vip: s.vip.map((p) =>
        p.id === r.vipPeriod ? { ...p, revoked: true } : p
      ),
    }
  } else {
    const field = r.reward === "points" ? "points" : "coins"
    next = {
      ...s,
      accounts: s.accounts.map((a) =>
        a.id === r.user ? { ...a, [field]: a[field] - r.amount! } : a
      ),
    }
  }
  return {
    ...next,
    codes: next.codes.map((c) =>
      c.id === r.codeId ? { ...c, uses: Math.max(0, c.uses - 1) } : c
    ),
    redemptions: next.redemptions.map((x) =>
      x.id === redId ? { ...x, revertedAt: s.now, revertReason: reason } : x
    ),
  }
}

// ---------- Datos de ejemplo ----------
export const ME = "u-pepon"

export function seed(now: number, rand: Rand = cryptoRand): Sim {
  let s: Sim = {
    now: now - 10 * DAY,
    accounts: [
      { id: ME, alias: "v34|Pepon", points: 1240, coins: 0 },
      { id: "u-nacho", alias: "Nacho.", points: 380, coins: 120 },
      { id: "u-luchi", alias: "luchi", points: 2950, coins: 0 },
      {
        id: "u-tramposo",
        alias: "xX_h4ck_Xx",
        points: 0,
        coins: 0,
        banned: true,
      },
    ],
    codes: [],
    redemptions: [],
    attempts: [],
    owned: [
      { user: ME, itemId: "marco-fuego", expiresAt: null, source: "purchase" },
      { user: ME, itemId: "sticker-gg", expiresAt: null, source: "purchase" },
    ],
    vip: [
      {
        id: "v0",
        user: "u-nacho",
        start: now - 40 * DAY,
        end: now + 20 * DAY,
        source: "manual",
        revoked: false,
      },
    ],
  }
  const make = (i: CreateInput) => {
    const r = createCodes(s, i, rand)
    if (!r.ok) throw new Error(r.error)
    s = r.sim
    return r.codes
  }
  // Hace 10 días: el código del stream, ya vencido.
  const [stream] = make({
    reward: "points",
    amount: 300,
    maxUses: 30,
    count: 1,
    expiresInDays: 3,
    custom: "STREAM1011",
    label: "Stream del 7/11",
  })
  s = redeem(s, "u-nacho", stream!.key).sim
  s = redeem(s, "u-luchi", stream!.key).sim
  // Hace 4 días: un lote de marcos de 30 días para el torneo relámpago.
  s = { ...s, now: now - 4 * DAY }
  const lote = make({
    reward: "item",
    itemId: "marco-neon",
    days: 30,
    maxUses: 1,
    count: 4,
    expiresInDays: 14,
    label: "Torneo relámpago",
  })
  s = redeem(s, "u-luchi", lote[0]!.key).sim
  // Uno que se revocó por error.
  const [mal] = make({
    reward: "vip_coins",
    amount: 5000,
    maxUses: 10,
    count: 1,
    label: "Prueba (error)",
  })
  s = revokeCode(s, mal!.id, "Cantidad mal puesta")
  // Ayer: intentos de adivinar.
  s = { ...s, now: now - DAY }
  for (const t of ["CML0", "CMLA", "AAAA", "CML9"])
    s = {
      ...s,
      attempts: [
        ...s.attempts,
        { user: "u-luchi", at: s.now + s.attempts.length * MIN, typed: t },
      ],
    }
  // Hoy: el ganador del sorteo de Discord y el código abierto de la comunidad.
  s = { ...s, now }
  make({
    reward: "vip",
    days: 7,
    maxUses: 1,
    count: 1,
    forUser: ME,
    expiresInDays: 7,
    label: "Sorteo Discord 17/11",
  })
  make({
    reward: "points",
    amount: 500,
    maxUses: 50,
    count: 1,
    expiresInDays: 7,
    custom: "CMLEAGUE500",
    label: "500 puntos para los primeros 50",
  })
  make({
    reward: "item",
    itemId: "fondo-neon",
    days: null,
    maxUses: 1,
    count: 1,
    expiresInDays: 30,
    label: "Sorteo de Instagram",
  })
  return s
}
