import { queryOptions } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import type { components } from "@/api/schema"

// Pines y trofeos de torneo, premios individuales y vitrinas (replanteo 123).

export type TeamPin = components["schemas"]["TeamPin"]
export type Award = components["schemas"]["Award"]
export type EventPins = components["schemas"]["EventPins"]
export type PinsConfig = components["schemas"]["PinsConfig"]
export type PinsConfigInput = components["schemas"]["PinsConfigInput"]
export type PlayerShowcase = components["schemas"]["PlayerShowcase"]
export type ShowcaseItem = PlayerShowcase["featured"][number]
export type AwardCandidate = components["schemas"]["AwardCandidate"]
export type EventClip = components["schemas"]["EventClip"]

const MINUTE = 60_000

export const pinKeys = {
  event: (id: string) => ["pins", "event", id] as const,
  candidates: (id: string, award: string) =>
    ["pins", "event", id, "candidates", award] as const,
  showcase: (nick: string) => ["pins", "player", nick.toLowerCase()] as const,
  team: (id: string) => ["pins", "team", id] as const,
}

export function eventPinsOptions(id: string) {
  return queryOptions({
    queryKey: pinKeys.event(id),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/events/{id}/pins", {
          params: { path: { id } },
          signal,
        })
      ),
    staleTime: MINUTE,
  })
}

export function awardCandidatesOptions(id: string, award: Award["award"]) {
  return queryOptions({
    queryKey: pinKeys.candidates(id, award),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/events/{id}/awards/{award}/candidates", {
            params: { path: { id, award } },
            signal,
          })
        )
      ).items,
  })
}

export function eventClipsOptions(id: string) {
  return queryOptions({
    queryKey: ["pins", "event", id, "clips"] as const,
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/events/{id}/clips", {
            params: { path: { id } },
            signal,
          })
        )
      ).items,
  })
}

export function showcaseOptions(nick: string) {
  return queryOptions({
    queryKey: pinKeys.showcase(nick),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/players/{id}/showcase", {
          params: { path: { id: nick } },
          signal,
        })
      ),
    staleTime: 5 * MINUTE,
  })
}

export function teamPinsOptions(id: string) {
  return queryOptions({
    queryKey: pinKeys.team(id),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET("/api/v1/teams/{id}/pins", {
            params: { path: { id } },
            signal,
          })
        )
      ).items,
    staleTime: 5 * MINUTE,
  })
}

export const pickAward = (
  id: string,
  award: Award["award"],
  body: { player_id?: string; clip_id?: string }
) =>
  unwrap(
    api.PUT("/api/v1/events/{id}/awards/{award}", {
      params: { path: { id, award } },
      body,
    })
  )

export const clearAward = (id: string, award: Award["award"]) =>
  unwrap(
    api.DELETE("/api/v1/events/{id}/awards/{award}", {
      params: { path: { id, award } },
    })
  )

export const saveShowcase = (body: {
  mode: "auto" | "manual"
  items: { kind: "pin" | "award"; id: string }[]
}) => unwrap(api.PUT("/api/v1/me/showcase", { body }))
