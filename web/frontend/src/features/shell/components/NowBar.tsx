import { Link, useRouterState } from "@tanstack/react-router"
import { ArrowRightIcon, PlugZapIcon } from "lucide-react"

import { KIND_LABEL } from "@/components/brand/KindBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { sideName } from "@/features/public/lib/format"
import { useFeaturedLive } from "../api/queries"

/**
 * Franja "ahora": la partida destacada en vivo. "TU PRÓXIMA" (con countdown) llega cuando el
 * backend exponga la próxima partida del usuario. Se oculta dentro de la sala de esa partida.
 */
export function NowBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const live = useFeaturedLive()
  if (!live || pathname === `/match/${live.match.id}`) return null

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
      <span className="font-semibold">
        {sideName(m.side1)} vs {sideName(m.side2)}
      </span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {subtitle}
      </span>
      <div className="flex gap-2">
        {live.address && (
          <Button asChild variant="outline" size="sm" className="h-7">
            <a href={`steam://connect/${live.address}`}>
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
      </div>
    </div>
  )
}
