import { COUNTRIES } from "@/features/profile/schemas"
import type {
  Country,
  LobbyStatus,
  MmPasswordEntry,
  MmPlayer,
  ReportReason,
} from "./types"

/** "0:07", "1:05", "12:30". */
export function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/** Segundos que faltan hasta `deadline` (0 si ya pasó o no hay). */
export function secondsLeft(deadline: string | null, now: number) {
  if (!deadline) return 0
  return Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000))
}

export const LOBBY_TITLE: Record<LobbyStatus, string> = {
  accepting: "Partida encontrada",
  veto: "Veto de mapas",
  waiting_server: "Buscando servidor",
  assigned: "Preparando el servidor",
  connecting: "Conectate al servidor",
  live: "Partida en curso",
  finished: "Partida terminada",
  cancelled: "Partida cancelada",
}

export const LOBBY_HINT: Record<LobbyStatus, string> = {
  accepting: "Aceptá antes de que termine el tiempo.",
  veto: "Los capitanes banean por turnos hasta que queda un mapa.",
  waiting_server: "Los 10 aceptaron. Estamos eligiendo un servidor libre.",
  assigned: "El servidor está cambiando de mapa y poniendo la contraseña.",
  connecting: "Entrá con la contraseña. La partida empieza con !ready.",
  live: "Suerte. El resultado se carga solo al terminar.",
  finished: "El ELO se actualiza en unos segundos.",
  cancelled: "",
}

/** Link de Steam que conecta con la contraseña puesta. */
export const steamConnectUrl = (address: string, password: string) =>
  `steam://connect/${address}/${encodeURIComponent(password)}`

export const connectCommand = (address: string, password: string) =>
  `connect ${address}; password ${password}`

export const maskPassword = (p: string) => "•".repeat(Math.max(6, p.length))

export const PASSWORD_KIND: Record<MmPasswordEntry["kind"], string> = {
  mix: "Del mix",
  idle: "Al azar",
}

export function passwordSetBy(e: MmPasswordEntry) {
  if (e.set_by === "plugin") return "Servidor"
  if (e.set_by === "system") return "Sistema"
  return e.set_by
}

export function teamElo(players: MmPlayer[], team: 1 | 2) {
  const list = players.filter((p) => p.team === team)
  return list.length
    ? Math.round(list.reduce((s, p) => s + p.elo, 0) / list.length)
    : 0
}

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

export const teamName = (team: 1 | 2) => (team === 1 ? "Equipo A" : "Equipo B")

export const REASON_TEXT: Record<ReportReason, string> = {
  afk: "AFK",
  toxic: "Tóxico",
  cheat: "Sospecha de trampa",
  abandon: "Abandono",
  other: "Otro",
}

/** "de_dust2" → "Dust2", "cs_office" → "Office". */
export function mapLabel(name: string, displayName?: string | null) {
  if (displayName?.trim()) return displayName.trim()
  const base = name.replace(/^[a-z]{2,4}_/, "").replace(/_/g, " ")
  return base.charAt(0).toUpperCase() + base.slice(1)
}

/** Límites de las imágenes del mapa (plan, decisión "Imagen y fondo de cada mapa"). */
export const MAP_ART_RULES = {
  image: { maxMb: 2, hint: "JPEG, PNG o WebP, hasta 2 MB, idealmente 4:3" },
  background: {
    maxMb: 4,
    hint: "JPEG, PNG o WebP, hasta 4 MB, idealmente 1920 × 1080",
  },
} as const

export const MAP_ART_TYPES = ["image/jpeg", "image/png", "image/webp"]

/** Si una región es un país con bandera (las regiones son texto libre). */
export const isCountry = (r: string | null): r is Country =>
  !!r && (COUNTRIES as readonly string[]).includes(r)
