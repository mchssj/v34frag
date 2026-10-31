import { useQuery } from "@tanstack/react-query"

import { cn } from "cn"

import { useEffect, useRef, useState } from "react"

import { useMine } from "@/features/ranking/components/parts"

import {
  mapStatsOptions,
  playerMatchesOptions,
  seasonsOptions,
  teamsOptions,
} from "../api/queries"
import type { PlayerDetail } from "../types"
import { TABS, type PlayerSearch, type Tab } from "../lib/search"

import { Summary } from "./tabs/SummaryTab"
import { Maps } from "./tabs/MapsTab"
import { Matches } from "./tabs/MatchesTab"
import { Teams } from "./tabs/TeamsTab"
import { Seasons } from "./tabs/SeasonsTab"
import { Bio } from "./tabs/BioTab"

const LABELS: Record<Tab, string> = {
  resumen: "Resumen",
  mapas: "Mapas",
  partidas: "Partidas",
  equipos: "Equipos",
  temporadas: "Temporadas",
  bio: "Bio y torneos",
}

type Props = {
  nick: string
  player: PlayerDetail
  search: PlayerSearch
  onTab: (tab: Tab) => void
  onChange: (patch: Partial<PlayerSearch>) => void
}

/** Cuántos hay en cada pestaña de lista (sin filtros); mientras carga, nada. */
function useTabCounts(nick: string): Partial<Record<Tab, number>> {
  const maps = useQuery(mapStatsOptions(nick)).data
  const matches = useQuery(playerMatchesOptions(nick, {})).data
  const teams = useQuery(teamsOptions(nick)).data
  const seasons = useQuery(seasonsOptions(nick)).data
  return {
    mapas: maps?.length,
    partidas: matches?.total,
    equipos: teams?.length,
    temporadas: seasons?.length,
  }
}

/**
 * Fila de pestañas en el teléfono: si se corta a la derecha va el degradado, y la activa se
 * desplaza a la vista (solo en horizontal: la página no se mueve).
 */
function useTabRow(tab: Tab) {
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  useEffect(() => {
    const row = ref.current
    const el = row?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!row || !el) return
    const out =
      el.offsetLeft < row.scrollLeft ||
      el.offsetLeft + el.offsetWidth > row.scrollLeft + row.clientWidth
    if (out) row.scrollTo({ left: el.offsetLeft - 16 })
  }, [tab])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () =>
      setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    check()
    el.addEventListener("scroll", check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", check)
      ro.disconnect()
    }
  }, [])
  return { ref, more }
}

export function PlayerTabs({ nick, player, search, onTab, onChange }: Props) {
  const tab = search.tab ?? "resumen"
  const counts = useTabCounts(nick)
  const owner = useMine().playerId === player.id
  const { ref: rowRef, more } = useTabRow(tab)
  return (
    <>
      {/* Fija bajo la topbar (52px) al bajar, con fondo translúcido. */}
      <div className="sticky top-[52px] z-[5] -mt-px bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div
          ref={rowRef}
          role="tablist"
          aria-label="Secciones del perfil"
          className="flex [scrollbar-width:none] gap-1 overflow-x-auto border-b"
        >
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`tab-${t}`}
              aria-selected={tab === t}
              aria-controls="player-tab"
              onClick={() => onTab(t)}
              className={cn(
                "group/tab flex h-[38px] shrink-0 items-center gap-1.5 px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                tab === t &&
                  "text-foreground shadow-[inset_0_-2px_0_var(--foreground)]"
              )}
            >
              {LABELS[t]}
              {counts[t] !== undefined && (
                <span className="rounded-full bg-muted px-1.5 font-mono text-[11px] leading-4 font-semibold text-muted-foreground tabular-nums group-aria-selected/tab:bg-foreground group-aria-selected/tab:text-background">
                  {counts[t]}
                </span>
              )}
            </button>
          ))}
        </div>
        {more && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-r from-transparent to-background"
          />
        )}
      </div>
      {/* Alto de una pantalla: con una pestaña corta (o cargando) el navegador no recorta el
          scroll y las pestañas quedan donde estaban. */}
      <div
        role="tabpanel"
        id="player-tab"
        aria-labelledby={`tab-${tab}`}
        className="min-h-svh"
      >
        {tab === "resumen" && (
          <Summary
            nick={nick}
            player={player}
            onAll={() => onTab("partidas")}
          />
        )}
        {tab === "mapas" && <Maps nick={nick} />}
        {tab === "partidas" && (
          <Matches nick={nick} search={search} onChange={onChange} />
        )}
        {tab === "equipos" && (
          <Teams nick={nick} legacy={player.team_history_text} owner={owner} />
        )}
        {tab === "temporadas" && <Seasons nick={nick} />}
        {tab === "bio" && <Bio nick={nick} player={player} owner={owner} />}
      </div>
    </>
  )
}
