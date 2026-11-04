import { useQuery } from "@tanstack/react-query"
import { Link, type LinkProps } from "@tanstack/react-router"
import { cn } from "cn"

import { TeamCrest } from "@/components/brand/TeamCrest"
import { buttonVariants } from "@/components/ui/button"
import { WatchTvButton } from "@/features/mixes/components/parts"
import { liveMixesOptions } from "@/features/mixes/api/queries"
import { liveMatchesOptions } from "../api/queries"
import { Box, BoxLink } from "./Box"

type Side = {
  name: string
  score: number | null
  team?: { name: string; tag: string | null; logo_url?: string | null } | null
}

type LiveItem = {
  key: string
  where: string
  a: Side
  b: Side
  foot: string
  tv: Parameters<typeof WatchTvButton>[0]["tv"] | null
  open: LinkProps
  openLabel: string
}

/**
 * "En vivo ahora": torneos y PCW primero, después los mixes y las partidas del matchmaking (que
 * llegan como mixes). Se oculta si no hay nada en juego.
 */
export function LiveCard() {
  const matches = useQuery(liveMatchesOptions).data ?? []
  const mixes = useQuery(liveMixesOptions).data ?? []

  const items: LiveItem[] = [
    ...matches.map((m) => ({
      key: `m-${m.id}`,
      where: [m.event?.name ?? (m.kind === "pcw" ? "PCW" : ""), m.label]
        .filter(Boolean)
        .join(" · "),
      a: {
        name: m.side1.name ?? "Equipo 1",
        score: m.side1.score,
        team: m.side1.team,
      },
      b: {
        name: m.side2.name ?? "Equipo 2",
        score: m.side2.score,
        team: m.side2.team,
      },
      foot: [m.map, m.best_of > 1 ? `BO${m.best_of}` : null]
        .filter(Boolean)
        .join(" · "),
      tv: null,
      open: { to: "/match/$id", params: { id: m.id } } as LinkProps,
      openLabel: m.best_of > 1 ? "Ver serie" : "Ver sala",
    })),
    ...mixes.map((x) => ({
      key: `x-${x.live_uid ?? x.match_id}`,
      where: `Mix${x.current_round ? ` · Ronda ${x.current_round}` : ""}`,
      a: { name: x.side1.name ?? "Bando 1", score: x.side1.score },
      b: { name: x.side2.name ?? "Bando 2", score: x.side2.score },
      foot: [x.map, x.server?.name].filter(Boolean).join(" · "),
      tv: x.tv,
      open: (x.live_uid
        ? { to: "/mixes/live/$uid", params: { uid: x.live_uid } }
        : { to: "/match/$id", params: { id: x.match_id ?? "" } }) as LinkProps,
      openLabel: "Ver sala",
    })),
  ]
  if (!items.length) return null

  return (
    <Box
      label="En vivo ahora"
      title={
        <>
          <span
            aria-hidden
            className="size-1.5 animate-live rounded-full bg-destructive"
          />
          En vivo ahora
        </>
      }
      aside={<BoxLink to="/matches">Ver todas</BoxLink>}
    >
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-2.5 px-4 pb-4">
        {items.map((it) => {
          const lead =
            (it.a.score ?? 0) === (it.b.score ?? 0)
              ? 0
              : (it.a.score ?? 0) > (it.b.score ?? 0)
                ? 1
                : 2
          return (
            <li
              key={it.key}
              className="flex flex-col gap-2.5 rounded-xl border bg-background p-3"
            >
              <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-flex h-5 items-center gap-1 rounded-full bg-destructive px-1.5 font-mono text-[10px] font-semibold text-white">
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full bg-white"
                  />
                  EN VIVO
                </span>
                <span className="truncate">{it.where}</span>
              </div>
              <SideRow side={it.a} lead={lead === 1} lose={lead === 2} />
              <SideRow side={it.b} lead={lead === 2} lose={lead === 1} />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex-1 truncate font-mono">{it.foot}</span>
                {it.tv && <WatchTvButton tv={it.tv} label="TV" />}
                <Link
                  {...it.open}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-7 px-2.5 text-xs"
                  )}
                >
                  {it.openLabel}
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </Box>
  )
}

function SideRow({
  side,
  lead,
  lose,
}: {
  side: Side
  lead: boolean
  lose: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-[13.5px]",
        lose && "text-muted-foreground"
      )}
    >
      {side.team && <TeamCrest team={side.team} size="xs" />}
      <span className={cn("min-w-0 flex-1 truncate", lead && "font-semibold")}>
        {side.name}
      </span>
      <span className="font-mono text-base font-semibold tabular-nums">
        {side.score ?? 0}
      </span>
    </div>
  )
}
