import { queryOptions, useQuery } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import type { AuthUser } from "@/auth/queries"
import { canAccessAdminSection } from "@/auth/permissions"
import { activeBanCountOptions } from "@/features/admin/bans/queries"
import { clipReviewCountOptions } from "@/features/admin/clips/queries"
import {
  myProfileOptions,
  playerDetailOptions,
} from "@/features/profile/queries"
import {
  liveCountOptions,
  liveMatchesOptions,
  sideName,
} from "@/features/public/queries"
import { eventDetailOptions } from "@/features/events/queries"
import { teamDetailOptions } from "@/features/teams/queries"
import type { BadgeKey, CrumbData } from "./nav"

const MINUTE = 60_000

export const shellKeys = {
  pcwOpen: ["shell", "pcw-open"] as const,
  adminTeams: ["shell", "admin-team-requests"] as const,
  match: (id: string) => ["match", id] as const,
}

const pcwOpenOptions = queryOptions({
  queryKey: shellKeys.pcwOpen,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/pcw/posts", { params: { query: { per: 1 } }, signal })
      )
    ).total,
  staleTime: MINUTE,
  refetchInterval: MINUTE,
})

const adminTeamRequestsOptions = queryOptions({
  queryKey: shellKeys.adminTeams,
  queryFn: async ({ signal }) =>
    (
      await unwrap(
        api.GET("/api/v1/admin/team-requests", {
          params: { query: { status: "pending", per: 1 } },
          signal,
        })
      )
    ).total,
  staleTime: MINUTE,
  refetchInterval: MINUTE,
})

/** Contadores de los badges. Un contador que falla o vale 0 no muestra badge. */
export function useBadgeCounts(
  user: AuthUser
): Partial<Record<BadgeKey, number>> {
  const live = useQuery(liveCountOptions).data
  const pcw = useQuery(pcwOpenOptions).data
  const adminTeams = useQuery({
    ...adminTeamRequestsOptions,
    enabled: canAccessAdminSection(user.role, "teams"),
  }).data
  const adminBans = useQuery({
    ...activeBanCountOptions,
    enabled: canAccessAdminSection(user.role, "bans"),
  }).data
  const adminClips = useQuery({
    ...clipReviewCountOptions,
    enabled: canAccessAdminSection(user.role, "clips"),
  }).data
  return { live, pcw, adminTeams, adminBans, adminClips }
}

/** Lo que muestra el pie del sidebar: equipo (capitán o miembro) y nivel del jugador vinculado. */
export function useShellIdentity() {
  const profile = useQuery(myProfileOptions).data
  const playerId = profile?.player?.id
  const level = useQuery({
    ...playerDetailOptions(playerId ?? ""),
    select: (p) => p.level,
    enabled: !!playerId,
  }).data
  const team = profile?.teams.find((t) => t.is_captain) ?? profile?.teams[0]
  return { team, level: level ?? null }
}

export function matchDetailOptions(id: string) {
  return queryOptions({
    queryKey: shellKeys.match(id),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/matches/{id}", { params: { path: { id } }, signal })
      ),
  })
}

/** Partida destacada en vivo para la NowBar, con su servidor (null si no hay ninguna). */
export function useFeaturedLive() {
  // Misma consulta que el badge "en vivo" del sidebar: no se pide dos veces.
  const featured = useQuery({
    ...liveMatchesOptions,
    select: (page) => page.items[0] ?? null,
  }).data
  const detail = useQuery({
    ...matchDetailOptions(featured?.id ?? ""),
    enabled: !!featured,
  }).data
  return featured
    ? { match: featured, address: detail?.server?.address ?? null }
    : null
}

/** Nombres de equipo, torneo o partida para los breadcrumbs y el ítem activo. */
export function useCrumbData(pathname: string): CrumbData {
  const [, first, id] = pathname.split("/")
  const team = useQuery({
    ...teamDetailOptions(id ?? ""),
    enabled: first === "teams" && !!id,
  }).data
  const event = useQuery({
    ...eventDetailOptions(id ?? ""),
    enabled: first === "events" && !!id,
  }).data
  const match = useQuery({
    ...matchDetailOptions(id ?? ""),
    enabled: first === "match" && !!id,
  }).data
  return {
    team: team?.name,
    event: event?.name,
    match: match && {
      kind: match.kind,
      map: match.map,
      a: match.side1.team?.tag ?? sideName(match.side1),
      b: match.side2.team?.tag ?? sideName(match.side2),
    },
  }
}
