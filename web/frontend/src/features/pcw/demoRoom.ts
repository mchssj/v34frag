import type { MmSource } from "@/features/matchmaking/source"
import type { MmChatMessage, MmState } from "@/features/matchmaking/types"
import { DEMO_ME } from "./demo"

// La fuente de la sala de una PCW en /demo/pcw: el veto va a la demo y el chat queda en memoria.

/** Lo que la sala del matchmaking le pide a su fuente, resuelto con la demo de PCW. */
export function demoRoomSource(
  matchId: string,
  rival: string,
  onVeto: (id: string, map: string) => void
): MmSource {
  // Las acciones devuelven un estado vacío: la sala se dibuja con la PCW, no con la caché.
  const empty = {} as MmState
  let chat: MmChatMessage[] = [
    {
      id: "c0",
      nick: rival,
      team: null,
      message: "gl hf",
      created_at: new Date().toISOString(),
    },
  ]
  const known: Partial<MmSource> = {
    async veto(_id, map) {
      onVeto(matchId, map)
      return empty
    },
    async chat() {
      return [...chat]
    },
    async sendChat(_id, message, teamOnly) {
      chat = [
        ...chat,
        {
          id: `c${chat.length}`,
          nick: DEMO_ME.alias,
          team: teamOnly ? 1 : null,
          message: message.trim().slice(0, 300),
          created_at: new Date().toISOString(),
        },
      ]
    },
    async report() {
      return empty
    },
    async commend() {
      return empty
    },
    async block() {
      return empty
    },
    async addFriend() {
      return empty
    },
  }
  return new Proxy(known as MmSource, {
    get(target, prop) {
      if (prop in target) return target[prop as keyof MmSource]
      return () =>
        Promise.reject(new Error("No está disponible en la sala de una PCW"))
    },
  })
}
