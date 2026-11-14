import { useQuery } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"

import type { Cosmetic } from "./types"

// El avatar puesto de cada ficha, para dibujarlo en lugar de la foto en toda la web (bitácora
// 2026-11-14-avatar-en-toda-la-web). Las fotos de una misma pantalla se piden juntas: los ids que llegan en el mismo
// tick van en un solo GET /api/v1/cosmetics?players= (de a 100). La clave cuelga de ["shop"]: comprar, equipar, subir o
// borrar en la Tienda invalida ["shop"] y el avatar propio se actualiza solo.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Lo máximo que acepta la API por pedido. */
export const AVATAR_BATCH = 100

export const playerAvatarKey = (id: string) => ["shop", "avatar", id] as const

type Waiter = {
  resolve: (a: Cosmetic | null) => void
  reject: (e: unknown) => void
}
let waiting = new Map<string, Waiter[]>()
let scheduled = false

async function flush() {
  const batch = waiting
  waiting = new Map()
  scheduled = false
  const ids = [...batch.keys()]
  for (let i = 0; i < ids.length; i += AVATAR_BATCH) {
    const part = ids.slice(i, i + AVATAR_BATCH)
    try {
      const r = await unwrap(
        api.GET("/api/v1/cosmetics", {
          params: { query: { players: part.join(",") } },
        })
      )
      const found = new Map(r.items.map((x) => [x.player_id, x.avatar]))
      // Las fichas sin nada puesto no vienen: quedan sin avatar (la foto de siempre).
      for (const id of part)
        for (const w of batch.get(id) ?? []) w.resolve(found.get(id) ?? null)
    } catch (e) {
      for (const id of part) for (const w of batch.get(id) ?? []) w.reject(e)
    }
  }
}

/** El avatar puesto de una ficha (null si no tiene). Junta los pedidos del mismo tick. */
export function loadPlayerAvatar(id: string): Promise<Cosmetic | null> {
  return new Promise((resolve, reject) => {
    const list = waiting.get(id) ?? []
    list.push({ resolve, reject })
    waiting.set(id, list)
    if (!scheduled) {
      scheduled = true
      setTimeout(() => void flush(), 0)
    }
  })
}

/** El avatar puesto de una ficha, o null (sin avatar, sin id o mientras carga). */
export function usePlayerAvatar(playerId?: string | null): Cosmetic | null {
  const id = playerId && UUID.test(playerId) ? playerId : null
  const q = useQuery({
    queryKey: playerAvatarKey(id ?? ""),
    queryFn: () => loadPlayerAvatar(id!),
    enabled: !!id,
    staleTime: 60_000,
    // Es decoración: si falla, se ve la foto y no se reintenta.
    retry: false,
  })
  return id ? (q.data ?? null) : null
}
