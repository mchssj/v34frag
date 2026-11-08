import { queryOptions, useQuery } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import type { AuthUser } from "@/auth/queries"
import { canAccessAdminSection } from "@/auth/permissions"
import { activeBanCountOptions } from "@/features/admin/bans/api/queries"
import { clipReviewCountOptions } from "@/features/admin/clips/api/queries"
import {
  myProfileOptions,
  playerDetailOptions,
} from "@/features/profile/api/queries"
import {
  liveCountOptions,
  liveMatchesOptions,
} from "@/features/public/api/queries"
import { sideName } from "@/features/public/lib/format"
import { eventDetailOptions } from "@/features/events/api/queries"
import { manualIndexOptions } from "@/features/help/api/queries"
import { teamDetailOptions } from "@/features/teams/api/queries"
import { liveMixesOptions } from "@/features/mixes/api/queries"
import type { MixItem } from "@/features/mixes/types"
import type { MatchSummary } from "@/features/matches/types"
import type { BadgeKey, CrumbData } from "../lib/nav"
import { shellKeys } from "./keys"

export { shellKeys }

const MINUTE = 60_000

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

/** Contadores de los badges. Un contador que falla o vale 0 no muestra badge. */
export function useBadgeCounts(
  user: AuthUser
): Partial<Record<BadgeKey, number>> {
  // Partidas oficiales y PCW (/matches) más mixes y matchmaking (/mixes, la misma consulta
  // que el bloque "En vivo" de Partidas).
  const liveMatches = useQuery(liveCountOptions).data
  const liveMixes = useQuery({
    ...liveMixesOptions,
    select: (items) => items.length,
  }).data
  const live =
    liveMatches === undefined && liveMixes === undefined
      ? undefined
      : (liveMatches ?? 0) + (liveMixes ?? 0)
  const pcw = useQuery(pcwOpenOptions).data
  const adminBans = useQuery({
    ...activeBanCountOptions,
    enabled: canAccessAdminSection(user.role, "bans"),
  }).data
  const adminClips = useQuery({
    ...clipReviewCountOptions,
    enabled: canAccessAdminSection(user.role, "clips"),
  }).data
  return { live, pcw, adminBans, adminClips }
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

export type FeaturedLive =
  | { kind: "match"; match: MatchSummary; address: string | null }
  | { kind: "mix"; mix: MixItem & { live_uid: string } }

/** El mix que destaca la NowBar: el primero con novedades del servidor, o el primero. */
export function pickFeaturedMix(items: MixItem[]) {
  const withUid = items.filter(
    (x): x is MixItem & { live_uid: string } => !!x.live_uid
  )
  return withUid.find((x) => !x.stale) ?? withUid[0] ?? null
}

/**
 * Lo destacado en vivo para la NowBar: una partida oficial o PCW con su servidor y, si no hay
 * ninguna, un mix (null si no hay nada).
 */
export function useFeaturedLive(): FeaturedLive | null {
  // Mismas consultas que el badge "en vivo" del sidebar: no se piden dos veces.
  const featured = useQuery({
    ...liveMatchesOptions,
    select: (page) => page.items[0] ?? null,
  }).data
  const mix = useQuery({ ...liveMixesOptions, select: pickFeaturedMix }).data
  const detail = useQuery({
    ...matchDetailOptions(featured?.id ?? ""),
    enabled: !!featured,
  }).data
  if (featured)
    return {
      kind: "match",
      match: featured,
      address: detail?.server?.address ?? null,
    }
  return mix ? { kind: "mix", mix } : null
}

/** Nombres de equipo, torneo o partida para los breadcrumbs y el ítem activo. */
export function useCrumbData(pathname: string): CrumbData {
  const [, first, id, third] = pathname.split("/")
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
  const manual = useQuery({
    ...manualIndexOptions(),
    enabled: first === "help" && !!id,
  }).data
  const helpSection = manual?.secciones.find((s) => s.id === id)
  const helpPage = helpSection?.paginas.find(
    (p) => p.tarea === decodeURIComponent(third ?? "")
  )
  return {
    help: helpSection &&
      helpPage && { section: helpSection.titulo, title: helpPage.titulo },
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
