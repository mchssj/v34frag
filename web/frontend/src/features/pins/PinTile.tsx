import { Link } from "@tanstack/react-router"
import { cn } from "cn"

import type { Award, ShowcaseItem, TeamPin } from "./api"
import { TournamentPin } from "./TournamentPin"
import { awardOf, tierOf, type PinAward, type PinStyle } from "./pinSvg"

// Un pin o un premio con su leyenda: escalón (o premio), torneo, equipo y la cifra.

/** La cifra con la que se ganó un premio, en palabras. */
export function awardValue(
  award: PinAward,
  value: number | null
): string | null {
  if (value === null) return null
  switch (award) {
    case "mvp":
      return `Rating ${value.toFixed(2)}`
    case "top_fragger":
      return `${value} kills`
    case "awp":
      return `${value} kills con AWP`
    case "clutch":
      return value === 1 ? "1 clutch" : `${value} clutches`
    case "hs":
      return `${value.toFixed(1)} % HS`
    case "adr":
      return `${value.toFixed(1)} ADR`
    case "entry":
      return `${value} primeras kills`
    default:
      return null
  }
}

export const itemName = (i: ShowcaseItem) =>
  i.kind === "pin" ? tierOf(i.pin.tier).name : awardOf(i.award.award).name

export const itemId = (i: ShowcaseItem) =>
  i.kind === "pin" ? i.pin.id : i.award.id

export function PinGraphic({
  item,
  size,
}: {
  item: ShowcaseItem
  size: number
}) {
  return item.kind === "pin" ? (
    <TournamentPin
      tier={item.pin.tier}
      metal={item.pin.metal}
      style={item.pin.style as PinStyle}
      event={item.pin.event.name}
      year={item.pin.year}
      size={size}
    />
  ) : (
    <TournamentPin
      award={item.award.award}
      style={item.award.style as PinStyle}
      event={item.award.event.name}
      year={item.award.year}
      size={size}
    />
  )
}

export function PinTile({
  item,
  size = 96,
  showTeam = true,
  className,
}: {
  item: ShowcaseItem
  size?: number
  showTeam?: boolean
  className?: string
}) {
  const event = item.kind === "pin" ? item.pin.event : item.award.event
  const team = item.kind === "pin" ? item.pin.team : item.award.team
  const detail =
    item.kind === "award"
      ? awardValue(item.award.award, item.award.value)
      : null
  return (
    <figure
      className={cn(
        "flex flex-col items-center gap-1.5 text-center",
        className
      )}
    >
      <PinGraphic item={item} size={size} />
      <figcaption className="flex max-w-full flex-col gap-0.5">
        <span className="text-[13px] font-semibold">{itemName(item)}</span>
        <Link
          to="/events/$id"
          params={{ id: event.id }}
          className="truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          {event.name}
        </Link>
        {(showTeam && team) || detail ? (
          <span className="truncate text-[11px] text-muted-foreground">
            {[showTeam && team ? team.name : null, detail]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : null}
      </figcaption>
    </figure>
  )
}

export const pinItem = (pin: TeamPin): ShowcaseItem => ({ kind: "pin", pin })
export const awardItem = (award: Award): ShowcaseItem => ({
  kind: "award",
  award,
})
