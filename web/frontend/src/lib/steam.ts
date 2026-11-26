const STEAM64 = /^7656\d{13}$/
const BASE = 76561197960265728n

/** SteamID64 → `STEAM_0:Y:Z`, como lo muestra el juego. Lo que no es un SteamID64 vuelve igual. */
export function steam2(id: string): string {
  if (!STEAM64.test(id)) return id
  const n = BigInt(id) - BASE
  return n < 0n ? id : `STEAM_0:${n % 2n}:${n / 2n}`
}

const STEAM2 = /^STEAM_[01]:([01]):(\d{1,10})$/i

const PROFILE = /steamcommunity\.com\/profiles\/(7656\d{13})\b/i

/** Lo que se pega (SteamID64, `STEAM_X:Y:Z` o el link `/profiles/` del perfil) → SteamID64, o `null` si no es ninguno. */
export function steam64(raw: string): string | null {
  const input = raw.trim()
  if (STEAM64.test(input)) return input
  const link = PROFILE.exec(input)
  if (link) return link[1]
  const m = STEAM2.exec(input)
  return m ? String(BASE + BigInt(m[2]) * 2n + BigInt(m[1])) : null
}
