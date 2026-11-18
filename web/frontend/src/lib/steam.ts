const STEAM64 = /^7656\d{13}$/
const BASE = 76561197960265728n

/** SteamID64 → `STEAM_0:Y:Z`, como lo muestra el juego. Lo que no es un SteamID64 vuelve igual. */
export function steam2(id: string): string {
  if (!STEAM64.test(id)) return id
  const n = BigInt(id) - BASE
  return n < 0n ? id : `STEAM_0:${n % 2n}:${n / 2n}`
}

const STEAM2 = /^STEAM_[01]:([01]):(\d{1,10})$/i

/** Lo que se pega en un buscador (SteamID64 o `STEAM_X:Y:Z`) → SteamID64, o `null` si no es ninguno. */
export function steam64(input: string): string | null {
  if (STEAM64.test(input)) return input
  const m = STEAM2.exec(input)
  return m ? String(BASE + BigInt(m[2]) * 2n + BigInt(m[1])) : null
}
