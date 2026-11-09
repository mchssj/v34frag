import { cn } from "cn"
import {
  CalendarPlusIcon,
  ChevronDownIcon,
  LinkIcon,
  ShieldCheckIcon,
  SwordsIcon,
} from "lucide-react"
import { useState } from "react"

import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { TeamCrest } from "@/components/brand/TeamCrest"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { mapLabel } from "@/features/matchmaking/labels"
import {
  agoLabel,
  avgElo,
  balance,
  headToHead,
  reliabilityPct,
  sideName,
  whenLabel,
} from "../lib/pcw"
import { fixedMaps } from "../lib/series"
import type { PcwPost, PcwResult } from "../types"
import { TeamName } from "./TeamName"
import { copyLink, downloadIcs } from "./share"

const BALANCE_TONE = { even: "win", up: "warn", down: "primary" } as const

/** Columnas de la lista del tablón (escritorio); en celular la fila se acomoda en dos líneas. */
export const BOARD_COLS =
  "md:grid-cols-[minmax(0,1fr)_4.5rem_7rem_7rem_6.5rem_8.5rem]"

/** Encabezado de la lista del tablón (solo escritorio). */
export function BoardHeader() {
  return (
    <div
      aria-hidden
      className={cn(
        "hidden items-center gap-3 border-b px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid",
        BOARD_COLS
      )}
    >
      <span>Equipo</span>
      <span>Ranking</span>
      <span>Mapa</span>
      <span>Hora</span>
      <span>Parejo</span>
      <span className="pr-8 text-right">Oferta</span>
    </div>
  )
}

/**
 * Un anuncio del tablón como fila (Kyan, 2026-11-08: lista compacta en lugar de tarjetas). Tocar la fila abre el
 * detalle: roster, historial, mapas, nota, confiabilidad, link y calendario.
 */
export function PostRow({
  post,
  now,
  myElo,
  myTeamId,
  results,
  pool,
  mapImage,
  onAccept,
  onWithdraw,
}: {
  post: PcwPost
  now: Date
  myElo: number
  myTeamId: string
  results: PcwResult[]
  pool: string[]
  mapImage: (name: string) => string | null
  onAccept: () => void
  onWithdraw: () => void
}) {
  const [open, setOpen] = useState(false)
  const s = post.side
  const elo = avgElo(s.roster)
  const bal = balance(myElo, elo)
  const h2h = s.team ? headToHead(results, myTeamId, s.team.id) : null
  const rel = post.reliability
  const challenged = post.invited?.id === myTeamId
  const title = `PCW BO${post.best_of} vs ${sideName(s)}`
  const detailId = `post-row-${post.id}`
  // El anuncio eligió los mapas (tantos como el formato): se juegan directo.
  const fixed = fixedMaps(post.map_pool, post.best_of)

  return (
    <li
      className={cn(
        "flex flex-col",
        challenged && "bg-primary/5 shadow-[inset_3px_0_0_var(--primary)]"
      )}
    >
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2.5",
          BOARD_COLS
        )}
      >
        {/* Equipo: tocarlo abre el detalle (el nombre lleva al perfil). */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailId}
          aria-label={`${open ? "Cerrar" : "Ver"} el detalle de ${title}`}
          onClick={() => setOpen((o) => !o)}
          className="col-span-2 flex min-w-0 items-center gap-2.5 rounded-md text-left md:col-span-1"
        >
          {s.team ? (
            <TeamCrest team={s.team} size="row" />
          ) : (
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground font-mono text-[10px] font-bold text-background">
              MIX
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-center gap-1.5">
              <TeamName
                team={s.team}
                name={sideName(s)}
                className="truncate text-sm font-semibold"
              />
              {challenged && (
                <Badge variant="solid" size="xs" shape="soft">
                  <SwordsIcon />
                  Te desafían
                </Badge>
              )}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {s.team ? "Equipo" : "Mix de amigos"} ·{" "}
              {agoLabel(post.created_at, now)}
              {rel && (
                <span
                  className={cn(reliabilityPct(rel) < 80 && "text-destructive")}
                >
                  {" "}
                  · {reliabilityPct(rel)} % jugadas
                </span>
              )}
            </span>
          </span>
          <ChevronDownIcon
            aria-hidden
            className={cn(
              "ml-auto size-4 shrink-0 text-muted-foreground transition-transform md:hidden",
              open && "rotate-180"
            )}
          />
        </button>

        {/* El puesto del equipo en el ranking de equipos; un mix no tiene. */}
        <span
          className="font-mono text-sm font-semibold tabular-nums"
          title={s.team?.rank ? "Puesto en el ranking de equipos" : undefined}
        >
          {s.team?.rank ? (
            <>
              <span className="text-muted-foreground">#</span>
              {s.team.rank}
            </>
          ) : (
            <span className="font-sans text-xs font-normal text-muted-foreground">
              {s.team ? "Sin puesto" : "Mix"}
            </span>
          )}
        </span>
        <MapCell
          fixed={fixed}
          bo={post.best_of}
          className="max-md:order-last max-md:col-span-2"
        />
        <span className="text-sm max-md:text-right">
          {whenLabel(post.starts_at, now)}
        </span>
        <span>
          <Badge variant={BALANCE_TONE[bal.tone]} size="sm" shape="pill">
            {bal.label}
          </Badge>
        </span>
        <span className="flex items-center justify-end gap-1">
          {post.my_offer ? (
            <>
              <Badge variant="primary" size="sm" shape="pill">
                Enviada
              </Badge>
              <Button variant="ghost" size="xs" onClick={onWithdraw}>
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
            size="icon-sm"
            aria-label={`${open ? "Cerrar" : "Ver"} el detalle`}
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => setOpen((o) => !o)}
            className="max-md:hidden"
          >
            <ChevronDownIcon
              className={cn("transition-transform", open && "rotate-180")}
            />
          </Button>
        </span>
      </div>

      {open && (
        <div
          id={detailId}
          className="flex flex-col gap-3 border-t bg-muted/30 px-4 py-3 text-sm"
        >
          {post.note && <p className="text-pretty">{post.note}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <ul aria-label="Roster" className="flex flex-wrap gap-1.5">
              {s.roster.map((pl) => (
                <li
                  key={pl.id}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-card py-0.5 pr-2.5 pl-0.5 text-xs"
                >
                  <PlayerAvatar
                    alias={pl.alias}
                    photo={pl.photo}
                    className="size-5"
                  />
                  {pl.alias}
                  <span className="font-mono text-muted-foreground">
                    {pl.guest ? "invitado" : pl.elo}
                  </span>
                </li>
              ))}
            </ul>
            {h2h && (
              <span className="text-xs text-muted-foreground">
                Contra ustedes: <b className="text-foreground">{h2h.label}</b>
              </span>
            )}
          </div>
          <ul
            aria-label={fixed ? "Mapas elegidos" : "Mapas del veto"}
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
            <li className="self-center text-[11px] text-muted-foreground">
              {fixed
                ? "(se juegan estos, sin veto)"
                : !post.map_pool && "(pool por defecto)"}
            </li>
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            {rel && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheckIcon aria-hidden className="size-3.5" />
                {rel.played} jugadas · {rel.cancelled} canceladas ·{" "}
                {rel.abandoned} abandonadas
                {rel.streak >= 5 && ` · ${rel.streak} seguidas sin cancelar`}
              </span>
            )}
            <span className="flex-1" />
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
    </li>
  )
}

/**
 * La columna Mapa: si el anuncio eligió los mapas, su nombre ("Dust2"); si no, el formato con veto
 * ("BO3 · Ban").
 */
export function MapCell({
  fixed,
  bo,
  className,
}: {
  fixed: string[] | null
  bo: number
  className?: string
}) {
  if (!fixed)
    return (
      <span
        className={cn("font-mono text-sm font-semibold", className)}
        title="Los mapas se eligen con el veto"
      >
        BO{bo}{" "}
        <span className="font-sans font-normal text-muted-foreground">
          · Ban
        </span>
      </span>
    )
  return (
    <span className={cn("truncate text-sm font-semibold", className)}>
      {fixed.map(mapLabel).join(", ")}
    </span>
  )
}
