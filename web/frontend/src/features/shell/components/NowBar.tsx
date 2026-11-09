import { Link, useRouterState } from "@tanstack/react-router"
import { ArrowRightIcon, PlugZapIcon } from "lucide-react"
import type { ReactNode } from "react"

import { KIND_LABEL } from "@/components/brand/KindBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cmleagueConnectUrl } from "@/features/matchmaking/labels"
import { WatchTvButton } from "@/features/mixes/components/parts"
import { sideName } from "@/features/public/lib/format"
import { useFeaturedLive, type FeaturedLive } from "../api/queries"

/**
 * Franja "ahora": lo destacado en vivo (una partida oficial o PCW y, si no hay, un mix). "TU
 * PRÓXIMA" (con countdown) llega cuando el backend exponga la próxima partida del usuario. Se
 * oculta dentro de la sala de lo que muestra.
 */
export function NowBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const live = useFeaturedLive()
  if (!live || pathname === roomPath(live)) return null
  return live.kind === "match" ? (
    <MatchNow live={live} />
  ) : (
    <MixNow mix={live.mix} />
  )
}

function roomPath(live: FeaturedLive) {
  return live.kind === "match"
    ? `/match/${live.match.id}`
    : `/mixes/live/${live.mix.live_uid}`
}

function MatchNow({
  live,
}: {
  live: Extract<FeaturedLive, { kind: "match" }>
}) {
  const m = live.match
  const subtitle = [
    m.event?.name ?? KIND_LABEL[m.kind],
    m.label,
    m.map,
    `BO${m.best_of}`,
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <Frame
      title={`${sideName(m.side1)} vs ${sideName(m.side2)}`}
      subtitle={subtitle}
    >
      {live.address && (
        <Button asChild variant="outline" size="sm" className="h-7">
          <a href={cmleagueConnectUrl(live.address)}>
            <PlugZapIcon aria-hidden />
            Conectar
          </a>
        </Button>
      )}
      <Button asChild size="sm" className="h-7">
        <Link to="/match/$id" params={{ id: m.id }}>
          Ver sala
          <ArrowRightIcon aria-hidden />
        </Link>
      </Button>
    </Frame>
  )
}

function MixNow({
  mix,
}: {
  mix: Extract<FeaturedLive, { kind: "mix" }>["mix"]
}) {
  const round = mix.current_round ?? mix.rounds_played + 1
  const subtitle = [
    KIND_LABEL.mix,
    mix.map,
    `Ronda ${round}${mix.max_rounds ? ` de ${mix.max_rounds}` : ""}`,
    mix.server?.name,
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <Frame
      title={`${mix.side1.name ?? "Bando 1"} ${mix.side1.score ?? 0} : ${mix.side2.score ?? 0} ${mix.side2.name ?? "Bando 2"}`}
      subtitle={subtitle}
    >
      {mix.tv && <WatchTvButton tv={mix.tv} />}
      <Button asChild size="sm" className="h-7">
        <Link to="/mixes/live/$uid" params={{ uid: mix.live_uid }}>
          Ver sala
          <ArrowRightIcon aria-hidden />
        </Link>
      </Button>
    </Frame>
  )
}

function Frame({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-[color-mix(in_oklch,var(--primary)_7%,var(--background))] py-2 pr-3 pl-4 text-[13px]">
      <Badge
        variant="live"
        size="md"
        className="gap-1.5 rounded-md text-[11px] font-semibold"
      >
        <span
          aria-hidden
          className="size-1.5 animate-live rounded-full bg-current"
        />
        EN VIVO
      </Badge>
      <span className="font-semibold">{title}</span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {subtitle}
      </span>
      <div className="flex gap-2">{children}</div>
    </div>
  )
}
