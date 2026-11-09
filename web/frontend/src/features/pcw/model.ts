import type { ReactNode } from "react"

import type { MapEntry } from "@/features/maps/types"
import type { SideChoice } from "./components/SidePicker"
import type {
  BestOf,
  PcwAlert,
  PcwMatch,
  PcwNotice,
  PcwPlayer,
  PcwPost,
  PcwResult,
  PcwServer,
  PcwTeamRef,
  SubRequest,
} from "./types"

// Lo que la página de PCW necesita (bitácora 2026-11-08-pcw-real): lo arman la página real (`usePcwApi`, contra la
// API) y la demo (`/demo/pcw`, en memoria). La página no sabe de dónde vienen los datos.

/** Lo que se elige en "Publicar una PCW". */
export type PublishInput = {
  best_of: BestOf
  starts_at: string | null
  note: string
  name: string
  roster: PcwPlayer[]
  asTeam: boolean
  map_pool: string[] | null
  discord: boolean
  invited: PcwTeamRef | null
}

/** Las ideas que todavía no tienen backend: en la página real van apagadas; la demo las muestra. */
export type PcwFeatures = {
  /** Panel "Buscan suplentes" (idea l). */
  subs: boolean
  /** Panel "Avisame cuando aparezca" (idea j). */
  alerts: boolean
  /** "Desafío directo" al publicar (idea h). */
  invite: boolean
  /** "Avisar en el Discord" al publicar (idea g). */
  discord: boolean
  /** La campana propia de la demo (en la web real los avisos llegan a la campana de arriba). */
  demoBell: boolean
}

export type PcwModel = {
  posts: PcwPost[]
  myPost: PcwPost | null
  matches: PcwMatch[]
  results: PcwResult[]
  servers: PcwServer[]
  /** PCW antes en la fila de servidores. */
  queue: number
  /** Texto de la sanción de PCW de mi equipo, o null. */
  banned: string | null
  formats: BestOf[]
  /** Lo último que publiqué (para "Repetir la última"). */
  last: PublishInput
  me: PcwPlayer
  /** El equipo oficial con el que puedo jugar (soy su capitán o su dueño), o null. */
  myTeam: PcwTeamRef | null
  plantel: PcwPlayer[]
  friends: (PcwPlayer & { team: boolean })[]
  /** Equipos para el desafío directo (solo la demo). */
  teams: PcwTeamRef[]
  maps: MapEntry[]
  defaultPool: string[]
  mapImage: (name: string) => string | null
  /** Publicar es para VIP (replanteo 92); ofertar es para todos. */
  isVip: boolean
  /** Sin VIP, al tocar "Publicar una PCW". */
  onVipRequired: () => void
  features: PcwFeatures
  /** Cargando la primera vez. */
  loading?: boolean
  /** Las ideas de la demo. */
  notices?: PcwNotice[]
  subs?: SubRequest[]
  alerts?: PcwAlert[]

  // Acciones. Las de la API devuelven una promesa que falla con el error para mostrar.
  publish: (i: PublishInput) => Promise<unknown> | void
  removeMyPost: () => Promise<unknown> | void
  /** Mandar una oferta a un anuncio (antes "aceptar"). */
  accept: (
    post: PcwPost,
    choice: SideChoice,
    proposedAt: string | null
  ) => Promise<unknown> | void
  withdrawOffer: (postId: string) => Promise<unknown> | void
  chooseOffer: (offerId: string) => Promise<unknown> | void
  /** "Estamos listos" o, si ya lo marcamos, "Ya no estamos listos". */
  ready: (matchId: string) => Promise<unknown> | void
  answerProposal: (matchId: string, ok: boolean) => void
  cancelMatch: (matchId: string) => Promise<unknown> | void
  applySub?: (id: string) => void
  requestSub?: (need: number, bo: BestOf, startsAt: string | null) => void
  addAlert?: (a: Omit<PcwAlert, "id">) => void
  removeAlert?: (id: string) => void
  markNoticesRead?: () => void
  /** La sala de una PCW con los dos listos. */
  renderRoom: (
    m: PcwMatch,
    onBack: () => void,
    onRoom: (id: string | null) => void
  ) => ReactNode
}
