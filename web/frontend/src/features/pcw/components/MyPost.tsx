import { cn } from "cn"
import { ShieldCheckIcon, TrashIcon } from "lucide-react"

import { TeamCrest } from "@/components/brand/TeamCrest"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  agoLabel,
  avgElo,
  balance,
  reliabilityPct,
  sideName,
  whenLabel,
} from "../lib/pcw"
import { fixedMaps } from "../lib/series"
import type { PcwPost, PcwSide } from "../types"
import { BOARD_COLS, MapCell } from "./PostRow"
import { TeamName } from "./TeamName"

const BALANCE_TONE = { even: "win", up: "warn", down: "primary" } as const

/**
 * Mi anuncio con el formato de la lista del tablón (Kyan, 2026-11-08): la fila del anuncio y, debajo, las ofertas que
 * llegaron, cada una con su ranking, ELO medio, la hora que propone, si es pareja y "Elegir".
 */
export function MyPost({
  post,
  now,
  myElo,
  onRemove,
  onChoose,
}: {
  post: PcwPost
  now: Date
  myElo: number
  onRemove: () => void
  onChoose: (offerId: string) => void
}) {
  const offers = post.offers ?? []
  const fixed = fixedMaps(post.map_pool, post.best_of)

  return (
    <Card variant="outline" asChild className="overflow-hidden p-0">
      <section aria-labelledby="my-post-h">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <h2 id="my-post-h" className="text-sm font-semibold">
            Tu anuncio
          </h2>
          <Badge
            variant={offers.length ? "primary" : "muted"}
            size="sm"
            shape="pill"
          >
            {offers.length === 0
              ? "Esperando ofertas"
              : offers.length === 1
                ? "1 oferta"
                : `${offers.length} ofertas`}
          </Badge>
          <span className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <TrashIcon />
            Borrar
          </Button>
        </div>

        <div
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2.5",
            BOARD_COLS
          )}
        >
          <SideCell
            side={post.side}
            sub={`Publicado ${agoLabel(post.created_at, now)}`}
            className="col-span-2 md:col-span-1"
          />
          <Rank side={post.side} />
          <MapCell fixed={fixed} bo={post.best_of} />
          <span className="text-sm max-md:text-right">
            {whenLabel(post.starts_at, now)}
          </span>
          <span className="text-xs text-muted-foreground max-md:hidden">
            ELO {avgElo(post.side.roster)}
          </span>
          <span className="max-md:hidden" />
        </div>

        <div className="border-t bg-muted/30">
          <div
            aria-hidden
            className={cn(
              "hidden items-center gap-3 px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid",
              BOARD_COLS
            )}
          >
            <span>Ofertas</span>
            <span>Ranking</span>
            <span>ELO medio</span>
            <span>Hora</span>
            <span>Parejo</span>
            <span />
          </div>
          {offers.length === 0 ? (
            <p className="px-4 pt-1 pb-3 text-xs text-muted-foreground max-md:pt-3">
              Todavía no llegaron ofertas. Te avisamos cuando llegue una y
              elegís la que más te sirva.
            </p>
          ) : (
            <ul
              aria-label="Ofertas"
              className="flex flex-col divide-y border-t"
            >
              {offers.map((o) => {
                const elo = avgElo(o.side.roster)
                const bal = balance(myElo, elo)
                return (
                  <li
                    key={o.id}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2.5",
                      BOARD_COLS
                    )}
                  >
                    <SideCell
                      side={o.side}
                      sub={
                        o.reliability
                          ? `${reliabilityPct(o.reliability)} % jugadas`
                          : `Hace ${agoLabel(o.created_at, now, false)}`
                      }
                      warn={
                        !!o.reliability && reliabilityPct(o.reliability) < 80
                      }
                      className="col-span-2 md:col-span-1"
                    />
                    <Rank side={o.side} />
                    <span className="font-mono text-xs tabular-nums">
                      {elo}
                    </span>
                    <span className="text-sm">
                      {o.proposed_at ? (
                        <span className="text-primary">
                          Propone {whenLabel(o.proposed_at, now)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">La tuya</span>
                      )}
                    </span>
                    <span>
                      <Badge
                        variant={BALANCE_TONE[bal.tone]}
                        size="sm"
                        shape="pill"
                      >
                        {bal.label}
                      </Badge>
                    </span>
                    <span className="flex justify-end">
                      <Button size="sm" onClick={() => onChoose(o.id)}>
                        Elegir
                      </Button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </Card>
  )
}

function SideCell({
  side,
  sub,
  warn = false,
  className,
}: {
  side: PcwSide
  sub: string
  warn?: boolean
  className?: string
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      {side.team ? (
        <TeamCrest team={side.team} size="row" />
      ) : (
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground font-mono text-[10px] font-bold text-background">
          MIX
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <TeamName
          team={side.team}
          name={sideName(side)}
          className="truncate text-sm font-semibold"
        />
        <span
          className={cn(
            "inline-flex items-center gap-1 truncate text-xs text-muted-foreground",
            warn && "text-destructive"
          )}
        >
          {warn && <ShieldCheckIcon aria-hidden className="size-3" />}
          {sub}
        </span>
      </span>
    </span>
  )
}

function Rank({ side }: { side: PcwSide }) {
  return (
    <span className="font-mono text-sm font-semibold tabular-nums">
      {side.team?.rank ? (
        <>
          <span className="text-muted-foreground">#</span>
          {side.team.rank}
        </>
      ) : (
        <span className="font-sans text-xs font-normal text-muted-foreground">
          {side.team ? "Sin puesto" : "Mix"}
        </span>
      )}
    </span>
  )
}
