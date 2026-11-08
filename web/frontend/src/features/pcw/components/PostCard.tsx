import { cn } from "cn"
import {
  CalendarPlusIcon,
  ChevronDownIcon,
  ClockIcon,
  LinkIcon,
  ShieldCheckIcon,
  SwordsIcon,
} from "lucide-react"

import { useState } from "react"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { TeamCrest } from "@/components/brand/TeamCrest"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { mapLabel } from "@/features/matchmaking/labels"
import { levelOf } from "@/features/matchmaking/room/roomData"
import { MapBackdrop } from "@/features/mixes/components/MapBackdrop"
import { LEVEL_FLOORS } from "@/features/player/lib/labels"
import {
  agoLabel,
  avgElo,
  balance,
  headToHead,
  reliabilityPct,
  sideName,
  whenLabel,
} from "../lib/pcw"
import type { PcwPost, PcwResult } from "../types"
import { TeamName } from "./TeamName"
import { copyLink, downloadIcs } from "./share"

const BALANCE_TONE = {
  even: "win",
  up: "warn",
  down: "primary",
} as const

/** Tarjeta de un anuncio del tablón (o el mío, con `mine`). */
export function PostCard({
  post,
  now,
  myElo,
  myTeamId,
  results,
  pool,
  mapImage,
  onAccept,
  onRemove,
  onWithdraw,
  onChoose,
  mine = false,
}: {
  post: PcwPost
  now: Date
  myElo: number
  myTeamId: string
  results: PcwResult[]
  /** Los mapas del veto (el pool del anuncio o el por defecto). */
  pool: string[]
  mapImage: (name: string) => string | null
  onAccept?: () => void
  onRemove?: () => void
  /** Retirar la oferta que mandé. */
  onWithdraw?: () => void
  /** En mi anuncio: elegir una oferta. */
  onChoose?: (offerId: string) => void
  mine?: boolean
}) {
  const s = post.side
  const elo = avgElo(s.roster)
  const bal = balance(myElo, elo)
  const h2h = s.team ? headToHead(results, myTeamId, s.team.id) : null
  const rel = post.reliability
  const challenged = post.invited?.id === myTeamId
  const title = `PCW BO${post.best_of} vs ${sideName(s)}`
  // Lo de un vistazo queda arriba; roster, mapas, historial y confiabilidad, en el detalle.
  const [open, setOpen] = useState(false)
  const detailId = `post-detail-${post.id}`

  return (
    <Card
      variant="outline"
      asChild
      className={cn(
        "overflow-hidden",
        challenged && "border-primary/60 ring-1 ring-primary/30"
      )}
    >
      <article aria-label={title}>
        <MapBackdrop image={mapImage(pool[0])} className="px-4 py-3">
          <div className="flex items-start gap-3">
            {s.team ? (
              <TeamCrest team={s.team} size="sm" />
            ) : (
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-foreground font-mono text-xs font-bold text-background">
                MIX
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="truncate text-[17px] font-bold">
                  <TeamName team={s.team} name={sideName(s)} />
                </h3>
                {s.team?.tag && (
                  <span className="font-mono text-xs text-muted-foreground">
                    [{s.team.tag}]
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="strong" size="sm" shape="soft">
                  BO{post.best_of}
                </Badge>
                <Badge variant="soft" size="sm" shape="soft">
                  <ClockIcon />
                  {whenLabel(post.starts_at, now)}
                </Badge>
                {s.team ? (
                  <Badge variant="neutral" size="sm" shape="soft">
                    Equipo
                  </Badge>
                ) : (
                  <Badge variant="neutral" size="sm" shape="soft">
                    Mix de amigos
                  </Badge>
                )}
                {challenged && (
                  <Badge variant="solid" size="sm" shape="soft">
                    <SwordsIcon />
                    Te desafían
                  </Badge>
                )}
              </div>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {agoLabel(post.created_at, now)}
            </span>
          </div>
        </MapBackdrop>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-1.5 text-sm">
              <LevelBadge level={levelOf(elo, LEVEL_FLOORS)} size={22} />
              <span className="font-mono font-semibold">{elo}</span>
              <span className="text-muted-foreground">ELO medio</span>
            </span>
            {!mine && (
              <Badge variant={BALANCE_TONE[bal.tone]} size="md" shape="pill">
                {bal.label}
              </Badge>
            )}
            {rel && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs text-muted-foreground",
                  reliabilityPct(rel) < 80 && "text-destructive"
                )}
                title="De sus PCW, las que jugaron"
              >
                <ShieldCheckIcon aria-hidden className="size-3.5" />
                {reliabilityPct(rel)} % jugadas
              </span>
            )}
          </div>

          {post.note && (
            <p className="line-clamp-2 text-sm text-pretty">{post.note}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {mine ? (
              <Button variant="destructive" size="sm" onClick={onRemove}>
                Borrar el anuncio
              </Button>
            ) : post.my_offer ? (
              <>
                <Badge variant="primary" size="md" shape="pill">
                  Oferta enviada · esperando que elijan
                </Badge>
                <Button variant="ghost" size="sm" onClick={onWithdraw}>
                  Retirar
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={onAccept}>
                Mandar oferta
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={open}
              aria-controls={detailId}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? "Menos" : "Detalle"}
              <ChevronDownIcon
                aria-hidden
                className={cn("transition-transform", open && "rotate-180")}
              />
            </Button>
          </div>

          {mine && (
            <OffersList
              post={post}
              myElo={myElo}
              now={now}
              onChoose={onChoose}
            />
          )}

          {open && (
            <div id={detailId} className="flex flex-col gap-3 border-t pt-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex -space-x-2">
                  {s.roster.slice(0, 7).map((pl) => (
                    <Tooltip key={pl.id}>
                      <TooltipTrigger asChild>
                        <span
                          tabIndex={0}
                          className="rounded-full ring-2 ring-card"
                        >
                          <PlayerAvatar
                            alias={pl.alias}
                            photo={pl.photo}
                            className="size-8"
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {pl.alias}
                        {pl.guest ? " (invitado)" : ` · ${pl.elo}`}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
                {h2h && (
                  <span className="text-xs text-muted-foreground">
                    Contra ustedes:{" "}
                    <b className="text-foreground">{h2h.label}</b>
                  </span>
                )}
              </div>

              <ul
                aria-label="Mapas del veto"
                className="flex flex-wrap gap-1.5"
              >
                {pool.map((m) => {
                  const img = mapImage(m)
                  return (
                    <li
                      key={m}
                      className="relative isolate flex h-7 items-center overflow-hidden rounded-md border px-2 text-[11px] font-semibold"
                    >
                      {img && (
                        <img
                          src={img}
                          alt=""
                          aria-hidden
                          className="absolute inset-0 -z-10 size-full object-cover opacity-35"
                        />
                      )}
                      {mapLabel(m)}
                    </li>
                  )
                })}
                {!post.map_pool && (
                  <li className="self-center text-[11px] text-muted-foreground">
                    (pool por defecto)
                  </li>
                )}
              </ul>

              {rel && (
                <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {rel.played} jugadas · {rel.cancelled} canceladas ·{" "}
                    {rel.abandoned} abandonadas
                  </span>
                  {rel.streak >= 5 && (
                    <Badge variant="win" size="xs" shape="pill">
                      {rel.streak} seguidas sin cancelar
                    </Badge>
                  )}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => copyLink(post.id, "post")}
                >
                  <LinkIcon />
                  Copiar link
                </Button>
                {post.starts_at && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() =>
                      downloadIcs({
                        id: post.id,
                        title,
                        startsAt: post.starts_at!,
                        bestOf: post.best_of,
                        kind: "post",
                      })
                    }
                  >
                    <CalendarPlusIcon />
                    Al calendario
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </article>
    </Card>
  )
}

/** En mi anuncio: las ofertas que llegaron, para elegir una (como en pracc). */
function OffersList({
  post,
  myElo,
  now,
  onChoose,
}: {
  post: PcwPost
  myElo: number
  now: Date
  onChoose?: (offerId: string) => void
}) {
  const offers = post.offers ?? []
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <span className="text-xs font-semibold">
        Ofertas{offers.length > 0 && ` · ${offers.length}`}
      </span>
      {offers.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Todavía no llegaron ofertas. Te avisamos cuando llegue una; elegís la
          que más te sirva.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {offers.map((o) => {
            const elo = avgElo(o.side.roster)
            const bal = balance(myElo, elo)
            return (
              <li
                key={o.id}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                {o.side.team && <TeamCrest team={o.side.team} size="xs" />}
                <span className="min-w-0 flex-1">
                  <TeamName
                    team={o.side.team}
                    name={sideName(o.side)}
                    className="block truncate font-semibold"
                  />
                  <span className="block text-xs text-muted-foreground">
                    ELO medio {elo}
                    {o.reliability &&
                      ` · ${reliabilityPct(o.reliability)} % jugadas`}
                    {o.proposed_at &&
                      ` · propone ${whenLabel(o.proposed_at, now)}`}
                  </span>
                </span>
                <Badge variant={BALANCE_TONE[bal.tone]} size="sm" shape="pill">
                  {bal.label}
                </Badge>
                <Button size="xs" onClick={() => onChoose?.(o.id)}>
                  Elegir
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
