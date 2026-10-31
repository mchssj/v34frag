import {
  AwardIcon,
  BanIcon,
  CalendarRangeIcon,
  ChartColumnIcon,
  ClapperboardIcon,
  CrosshairIcon,
  GavelIcon,
  HouseIcon,
  ListOrderedIcon,
  MapIcon,
  ServerIcon,
  ShieldAlertIcon,
  ShieldIcon,
  SwordsIcon,
  TrophyIcon,
  UserCogIcon,
  type LucideIcon,
} from "lucide-react"

import { adminSectionOf, type AdminSection } from "@/auth/permissions"
import type { FileRouteTypes } from "@/routeTree.gen"

export type AppPath = FileRouteTypes["to"]

/** Contadores de los badges del sidebar (salen de la API; en 0 no se muestran). */
export type BadgeKey =
  "live" | "pcw" | "adminTeams" | "adminBans" | "adminClips"

export type NavItem = {
  key: string
  label: string
  to: AppPath
  icon: LucideIcon
  badge?: BadgeKey
  /** Ítem de Administración: visible solo si el rol puede entrar a esa sección. */
  admin?: AdminSection
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Jugar",
    items: [
      { key: "home", label: "Para ti", to: "/home", icon: HouseIcon },
      {
        key: "matches",
        label: "Partidas",
        to: "/matches",
        icon: SwordsIcon,
        badge: "live",
      },
      { key: "events", label: "Torneos", to: "/events", icon: TrophyIcon },
      {
        key: "pcw",
        label: "PCW",
        to: "/pcw",
        icon: CrosshairIcon,
        badge: "pcw",
      },
      { key: "myteam", label: "Mi equipo", to: "/myteam", icon: ShieldIcon },
    ],
  },
  {
    label: "Comunidad",
    items: [
      {
        key: "ranking",
        label: "Ranking",
        to: "/ranking",
        icon: ListOrderedIcon,
      },
      {
        key: "hall-of-fame",
        label: "Palmarés",
        to: "/hall-of-fame",
        icon: AwardIcon,
      },
    ],
  },
  {
    label: "Administración",
    items: [
      {
        key: "admin-events",
        label: "Torneos",
        to: "/admin/events",
        icon: GavelIcon,
        admin: "events",
      },
      {
        key: "admin-players",
        label: "Jugadores",
        to: "/admin/players",
        icon: UserCogIcon,
        admin: "players",
      },
      {
        key: "admin-teams",
        label: "Equipos",
        to: "/admin/teams",
        icon: ShieldIcon,
        admin: "teams",
        badge: "adminTeams",
      },
      {
        key: "admin-servers",
        label: "Servidores y ELO",
        to: "/admin/servers",
        icon: ServerIcon,
        admin: "servers",
      },
      {
        key: "admin-seasons",
        label: "Temporadas",
        to: "/admin/seasons",
        icon: CalendarRangeIcon,
        admin: "seasons",
      },
      {
        key: "admin-clips",
        label: "Clips",
        to: "/admin/clips",
        icon: ClapperboardIcon,
        admin: "clips",
        badge: "adminClips",
      },
      {
        key: "admin-ranking",
        label: "Ranking de equipos",
        to: "/admin/ranking",
        icon: ChartColumnIcon,
        admin: "ranking",
      },
      {
        key: "admin-maps",
        label: "Mapas",
        to: "/admin/maps",
        icon: MapIcon,
        admin: "maps",
      },
      {
        key: "admin-users",
        label: "Usuarios",
        to: "/admin/users",
        icon: ShieldAlertIcon,
        admin: "users",
      },
      {
        key: "admin-bans",
        label: "Baneos",
        to: "/admin/bans",
        icon: BanIcon,
        admin: "bans",
        badge: "adminBans",
      },
      {
        key: "admin-anticheat",
        label: "Anticheat",
        to: "/admin/anticheat",
        icon: ShieldAlertIcon,
        admin: "anticheat",
      },
    ],
  },
]

const ITEMS = NAV_GROUPS.flatMap((g) => g.items)

/** Títulos de las secciones de Administración en los breadcrumbs. */
const ADMIN_TITLES: Record<AdminSection, string> = {
  events: "Torneos y resultados",
  players: "Jugadores",
  teams: "Equipos",
  servers: "Servidores y ELO",
  seasons: "Temporadas",
  clips: "Clips",
  ranking: "Ranking de equipos",
  maps: "Mapas",
  users: "Usuarios",
  bans: "Baneos",
  anticheat: "Anticheat",
}

/** Secciones de Mi perfil en los breadcrumbs (la principal, Perfil, queda como "Mi perfil"). */
const PROFILE_TITLES: Record<string, string> = {
  privacy: "Privacidad",
  link: "Vinculación",
  preferences: "Preferencias",
  account: "Cuenta",
}

/** Datos de la vista que necesitan los breadcrumbs (vienen de la API; mientras cargan, faltan). */
export type CrumbData = {
  team?: string
  event?: string
  match?: {
    kind: "mix" | "pcw" | "official"
    map: string | null
    a: string
    b: string
  }
}

const seg = (pathname: string, i: number) =>
  decodeURIComponent(pathname.split("/")[i] ?? "")

/**
 * Ítem del sidebar que corresponde a la ruta. Las fichas de jugador y equipo marcan Ranking; una
 * partida (de cualquier tipo) y la sala de un mix marcan Partidas. La ficha propia (`myNick`)
 * marca el menú de la cuenta, que lleva ahí.
 */
export function activeNavKey(
  pathname: string,
  myNick?: string | null
): string | null {
  const first = seg(pathname, 1)
  if (
    first === "player" &&
    myNick &&
    seg(pathname, 2).toLowerCase() === myNick.toLowerCase()
  )
    return "profile"
  if (first === "admin") {
    const section = adminSectionOf(pathname)
    return section ? `admin-${section}` : null
  }
  // Mixes, PCW y torneos están en Partidas, también la sala de un mix en vivo.
  if (first === "match" || first === "mixes") return "matches"
  if (["player", "players", "teams"].includes(first)) return "ranking"
  if (first === "profile") return "profile"
  return ITEMS.find((i) => i.to === `/${first}`)?.key ?? null
}

export type Crumb = { label: string; to?: AppPath }

/** Breadcrumbs de la topbar: los previos son links; el último es la página actual. */
export function breadcrumbsFor(
  pathname: string,
  data: CrumbData = {}
): Crumb[] {
  const first = seg(pathname, 1)
  const second = seg(pathname, 2)
  const ranking: Crumb = { label: "Ranking", to: "/ranking" }

  switch (first) {
    case "admin": {
      const section = adminSectionOf(pathname)
      return [
        { label: "Administración" },
        { label: section ? ADMIN_TITLES[section] : "Administración" },
      ]
    }
    case "player":
      return [ranking, { label: second }]
    case "players":
      return [
        ranking,
        { label: second === "compare" ? "Comparar" : "Jugadores" },
      ]
    case "teams":
      return [ranking, { label: data.team ?? "Equipo" }]
    case "ranking":
      return second === "teams"
        ? [ranking, { label: "Equipos" }]
        : [{ label: "Ranking" }]
    case "events":
      return second
        ? [
            { label: "Torneos", to: "/events" },
            { label: data.event ?? "Torneo" },
          ]
        : [{ label: "Torneos" }]
    case "matches":
      return [{ label: "Partidas" }]
    case "mixes":
      return [{ label: "Partidas", to: "/matches" }, { label: "Mix en vivo" }]
    case "match": {
      const m = data.match
      if (m?.kind === "mix")
        return [
          { label: "Partidas", to: "/matches" },
          { label: m.map ? `Mix · ${m.map}` : "Mix" },
        ]
      return [
        { label: "Partidas", to: "/matches" },
        { label: m ? `${m.a} vs ${m.b}` : "Partida" },
      ]
    }
    case "profile": {
      const section = PROFILE_TITLES[second]
      return section
        ? [{ label: "Mi perfil", to: "/profile" }, { label: section }]
        : [{ label: "Mi perfil" }]
    }
    default: {
      const item = ITEMS.find((i) => i.to === `/${first}`)
      return [{ label: item?.label ?? "CM League" }]
    }
  }
}
