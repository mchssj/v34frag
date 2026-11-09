import { useQuery } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"

import { mapsOptions } from "@/features/maps/api/queries"
import { mapImage as catalogImage } from "@/features/maps/lib/catalog"
import type { SideChoice } from "../components/SidePicker"
import { contextPlayers, toMatch, toPost, toResult, toSide } from "../lib/adapt"
import type { PcwModel, PublishInput } from "../model"
import { PcwLiveRoom } from "../pages/PcwLiveRoom"
import type { BestOf, PcwPlayer, PcwSide } from "../types"
import {
  myPcwMatchesOptions,
  myPcwPostOptions,
  pcwContextOptions,
  pcwFormatsOptions,
  pcwPostsOptions,
  pcwResultsOptions,
  pcwServersOptions,
  useCancelPcwMatch,
  useCancelPcwPost,
  useChooseOffer,
  usePcwReady,
  usePublishPcw,
  useSendOffer,
  useWithdrawOffer,
} from "./queries"

// El modelo de la página de PCW contra la API (bitácora 2026-11-08-pcw-real). Las ideas sin backend van apagadas.

const NO_IDEAS = {
  subs: false,
  alerts: false,
  invite: false,
  discord: false,
  demoBell: false,
}

/** El bando para la API: como equipo, solo el equipo (la API arma el plantel); como mix, el nombre y el roster. */
function sideBody(c: SideChoice, teamId: string | null) {
  if (c.asTeam && teamId) return { team_id: teamId, players: [], guests: [] }
  const players = c.roster.filter((p) => !p.guest).map((p) => p.id)
  const guests = c.roster.filter((p) => p.guest).map((p) => p.alias)
  return { name: c.name.trim() || undefined, players, guests }
}

export function usePcwApi(onVipRequired: () => void): PcwModel {
  const ctx = useQuery(pcwContextOptions)
  const posts = useQuery(pcwPostsOptions)
  const myPost = useQuery(myPcwPostOptions)
  const matches = useQuery(myPcwMatchesOptions)
  const results = useQuery(pcwResultsOptions)
  const formats = useQuery(pcwFormatsOptions)
  const servers = useQuery(pcwServersOptions)
  const maps = useQuery(mapsOptions)

  const publish = usePublishPcw()
  const cancelPost = useCancelPcwPost()
  const sendOffer = useSendOffer()
  const withdraw = useWithdrawOffer()
  const choose = useChooseOffer()
  const cancelMatch = useCancelPcwMatch()
  const ready = usePcwReady()

  const { me, team, plantel, friends } = contextPlayers(ctx.data)
  const postList = (posts.data ?? []).map(toPost)
  const apiMatches = matches.data ?? []
  const matchList = apiMatches.map(toMatch)
  const catalog = maps.data ?? []
  const defaultPool = catalog
    .filter((m) => m.active && m.veto_default)
    .map((m) => m.name)
  const banUntil = ctx.data?.team?.ban_until
  const myFormats = (formats.data?.formats ?? [1, 3, 5]) as BestOf[]
  const roster: PcwPlayer[] = team ? plantel : [me]
  const last: PublishInput = {
    best_of: myFormats.includes(3) ? 3 : (myFormats[0] ?? 1),
    starts_at: null,
    note: "",
    name: "",
    roster,
    asTeam: !!team,
    map_pool: null,
    discord: false,
    invited: null,
  }
  // Los dos bandos de cada práctica en el orden de la partida: la sala los pone como equipo 1 y 2.
  const sidesById = new Map<string, { 1: PcwSide; 2: PcwSide }>(
    apiMatches.map((m) => [
      m.id,
      {
        1: toSide(m.pcw_sides["1"], m.side1.name ?? "?"),
        2: toSide(m.pcw_sides["2"], m.side2.name ?? "?"),
      },
    ])
  )

  return {
    posts: postList,
    myPost: myPost.data ? toPost(myPost.data) : null,
    matches: matchList,
    results: (results.data ?? []).map(toResult),
    servers: (servers.data ?? []).map((s) => ({ name: s.name, free: true })),
    queue: 0,
    banned:
      team && banUntil
        ? `${team.name} tiene una sanción de PCW hasta el ${format(parseISO(banUntil), "dd/MM HH:mm")}: no pueden jugar PCW como equipo.`
        : null,
    formats: myFormats,
    last,
    me,
    myTeam: team,
    plantel,
    friends,
    teams: [],
    maps: catalog,
    defaultPool,
    mapImage: (name) => catalogImage(catalog, name),
    isVip: ctx.data?.vip ?? false,
    onVipRequired,
    features: NO_IDEAS,
    loading: posts.isPending || matches.isPending || ctx.isPending,

    publish: (i) =>
      publish.mutateAsync({
        best_of: i.best_of,
        starts_at: i.starts_at ?? undefined,
        note: i.note.trim() || undefined,
        map_pool: i.map_pool,
        ...sideBody(i, team?.id ?? null),
      }),
    removeMyPost: () =>
      myPost.data ? cancelPost.mutateAsync(myPost.data.id) : undefined,
    accept: (post, choice, at) =>
      sendOffer.mutateAsync({
        postId: post.id,
        body: {
          starts_at: at ?? undefined,
          ...sideBody(choice, team?.id ?? null),
        },
      }),
    withdrawOffer: (postId) => {
      const id = postList.find((p) => p.id === postId)?.my_offer?.id
      return id ? withdraw.mutateAsync(id) : undefined
    },
    chooseOffer: (offerId) => choose.mutateAsync(offerId),
    ready: (id) => {
      const m = matchList.find((x) => x.id === id)
      return ready.mutateAsync({ id, ready: m?.status !== "ready_us" })
    },
    // La contrapropuesta de hora en una práctica ya armada todavía no tiene backend.
    answerProposal: () => {},
    cancelMatch: (id) => cancelMatch.mutateAsync(id),
    renderRoom: (m, onBack, onRoom) => (
      <PcwLiveRoom
        key={m.id}
        matchId={m.id}
        sides={sidesById.get(m.id) ?? null}
        meId={me.id}
        mapImage={(name) => catalogImage(catalog, name)}
        onBack={onBack}
        onRoom={onRoom}
      />
    ),
  }
}
