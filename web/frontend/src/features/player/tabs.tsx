import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import type { KeyboardEvent, ReactNode } from "react"

import { errorMessage, isRetryable } from "@/api/errors"
import { ListPagination } from "@/components/brand/ListPagination"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { mapImage, mapsOptions } from "@/features/maps/queries"
import { KeyPlays } from "./KeyPlays"
import { TagBox } from "@/features/ranking/parts"
import {
  KIND_LABEL,
  adjustmentLabel,
  fmtDay,
  fmtLong,
  legacyTeams,
  matchTitle,
  resultOf,
  scoreOf,
  stintPeriod,
  stintRole,
} from "./labels"
import {
  adjustmentsOptions,
  mapStatsOptions,
  medalsOptions,
  playerMatchesOptions,
  recentMatchesOptions,
  seasonsOptions,
  teamsOptions,
  titlesOptions,
  type PlayerDetail,
  type PlayerMatch,
} from "./queries"
import {
  DEFAULT_PER,
  PER_OPTIONS,
  TABS,
  type PlayerSearch,
  type Tab,
} from "./search"

const LABELS: Record<Tab, string> = {
  resumen: "Resumen",
  mapas: "Mapas",
  partidas: "Partidas",
  equipos: "Equipos",
  temporadas: "Temporadas",
  bio: "Bio y palmarés",
}

type Props = {
  nick: string
  player: PlayerDetail
  search: PlayerSearch
  onTab: (tab: Tab) => void
  onChange: (patch: Partial<PlayerSearch>) => void
}

export function PlayerTabs({ nick, player, search, onTab, onChange }: Props) {
  const tab = search.tab ?? "resumen"
  return (
    <>
      <div
        role="tablist"
        aria-label="Secciones del perfil"
        className="flex gap-1 overflow-x-auto border-b"
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
              "h-[38px] px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground",
              tab === t &&
                "text-foreground shadow-[inset_0_-2px_0_var(--foreground)]"
            )}
          >
            {LABELS[t]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="player-tab" aria-labelledby={`tab-${tab}`}>
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
          <Teams nick={nick} legacy={player.team_history_text} />
        )}
        {tab === "temporadas" && <Seasons nick={nick} />}
        {tab === "bio" && <Bio nick={nick} player={player} />}
      </div>
    </>
  )
}

const card = "rounded-xl border bg-card"

/** Skeleton o error con reintento; si no, el contenido. */
function Loaded<T>({
  q,
  children,
}: {
  q: {
    isPending: boolean
    isError: boolean
    error: unknown
    data?: T
    refetch: () => unknown
  }
  children: (data: T) => ReactNode
}) {
  if (q.isPending) return <Skeleton className="h-32 rounded-xl" />
  if (q.isError)
    return (
      <div className={cn(card, "px-4 py-8 text-center")}>
        <p className="text-sm text-muted-foreground">{errorMessage(q.error)}</p>
        {isRetryable(q.error) && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void q.refetch()}
          >
            Reintentar
          </Button>
        )}
      </div>
    )
  return children(q.data as T)
}

function Delta({ v }: { v: number | null }) {
  if (v === null) return <span className="text-muted-foreground">—</span>
  return (
    <span className={v >= 0 ? "text-win" : "text-destructive"}>
      {v > 0 ? `+${v}` : v}
    </span>
  )
}

const RESULT_CHIP = {
  V: "bg-win/18 text-win",
  D: "bg-destructive/15 text-destructive",
  E: "bg-muted text-muted-foreground",
}

function useOpenMatch() {
  const navigate = useNavigate()
  return (m: PlayerMatch) =>
    void navigate({ to: "/match/$id", params: { id: m.match_id } })
}

// ---------- Resumen ----------

function Summary({
  nick,
  player,
  onAll,
}: {
  nick: string
  player: PlayerDetail
  onAll: () => void
}) {
  const recent = useQuery(recentMatchesOptions(nick))
  const medals = useQuery(medalsOptions(nick))
  const adjustments = useQuery(adjustmentsOptions(nick))
  const open = useOpenMatch()

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className={cn(card, "overflow-hidden")}>
        <div className="flex items-center border-b px-4 py-3.5 text-sm font-semibold">
          Partidas recientes
          <button
            type="button"
            onClick={onAll}
            className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Ver todas
          </button>
        </div>
        <Loaded q={recent}>
          {(items) =>
            items.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                Todavía no jugó partidas en el servidor.
              </p>
            ) : (
              items.map((m) => {
                const t = matchTitle(m)
                const r = resultOf(m.won)
                return (
                  <button
                    key={m.match_id}
                    type="button"
                    onClick={() => open(m)}
                    className="grid w-full grid-cols-[24px_minmax(0,1fr)_64px_56px_52px] items-center gap-3 border-b px-4 py-2.5 text-left text-[13px] last:border-b-0 hover:bg-muted max-sm:grid-cols-[24px_minmax(0,1fr)_44px_48px] max-sm:gap-2"
                  >
                    <span
                      className={cn(
                        "grid size-[22px] place-items-center rounded-[5px] font-mono text-[11px] font-semibold",
                        RESULT_CHIP[r]
                      )}
                    >
                      {r}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{t.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {t.sub}
                      </span>
                    </span>
                    <span className="font-mono text-muted-foreground tabular-nums max-sm:hidden">
                      {m.kills ?? 0}-{m.deaths ?? 0}
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      {m.rating?.toFixed(2) ?? "—"}
                    </span>
                    <span className="text-right font-mono text-xs font-semibold tabular-nums">
                      <Delta v={m.elo_delta} />
                    </span>
                  </button>
                )
              })
            )
          }
        </Loaded>
      </div>
      <div className="flex flex-col gap-4">
        <div className={cn(card, "flex flex-col gap-3 p-4")}>
          <span className="text-sm font-semibold">Logros</span>
          <Loaded q={medals}>
            {(items) =>
              items.length === 0 ? (
                <span className="text-[13px] text-muted-foreground">
                  Todavía sin medallas.
                </span>
              ) : (
                items.map((m) => (
                  <div
                    key={`${m.title}-${m.icon}`}
                    className="flex items-center gap-3"
                  >
                    <span
                      aria-hidden
                      className="grid size-9 place-items-center rounded-lg bg-primary/12 text-lg"
                    >
                      {m.icon ?? "🏅"}
                    </span>
                    <span className="flex-1 text-sm font-medium">
                      {m.title}
                    </span>
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      ×{m.count}
                    </span>
                  </div>
                ))
              )
            }
          </Loaded>
        </div>
        {/* Solo si el admin le hizo algún ajuste (contrato 5). */}
        {adjustments.data && adjustments.data.length > 0 && (
          <div className={cn(card, "flex flex-col gap-3 p-4")}>
            <span className="text-sm font-semibold">Ajustes de ELO</span>
            {adjustments.data.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 text-[13px]">
                <span
                  className={cn(
                    "min-w-14 font-mono text-xs font-semibold tabular-nums",
                    a.kind === "set"
                      ? "text-foreground"
                      : a.delta >= 0
                        ? "text-win"
                        : "text-destructive"
                  )}
                >
                  {adjustmentLabel(a)}
                </span>
                <span className="flex-1 text-pretty">{a.reason}</span>
                <span className="text-xs whitespace-nowrap text-muted-foreground">
                  {fmtDay(a.applied_at)}
                </span>
              </div>
            ))}
          </div>
        )}
        <KeyPlays stats={player.stats} />
      </div>
    </div>
  )
}

// ---------- Mapas ----------

function Maps({ nick }: { nick: string }) {
  const q = useQuery(mapStatsOptions(nick))
  const master = useQuery(mapsOptions).data
  return (
    <Loaded q={q}>
      {(items) =>
        items.length === 0 ? (
          <p
            className={cn(
              card,
              "px-4 py-8 text-center text-[13px] text-muted-foreground"
            )}
          >
            Todavía no jugó mapas en el servidor.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {items.map((m) => {
              const played = (m.wins ?? 0) + (m.losses ?? 0)
              const wr = played
                ? Math.round(((m.wins ?? 0) / played) * 100)
                : null
              const img = mapImage(master, m.map)
              return (
                <div key={m.map} className={cn(card, "overflow-hidden")}>
                  <div
                    className={cn(
                      "relative h-16 border-b bg-cover bg-center",
                      !img &&
                        "bg-[repeating-linear-gradient(135deg,var(--muted)_0_8px,transparent_8px_16px)]"
                    )}
                    style={
                      img
                        ? {
                            backgroundImage: `linear-gradient(to top, rgb(0 0 0 / .55), transparent), url(${img})`,
                          }
                        : undefined
                    }
                  >
                    <span
                      className={cn(
                        "absolute bottom-2 left-3 font-mono text-sm font-semibold",
                        img && "text-white"
                      )}
                    >
                      {m.map}
                    </span>
                    <span
                      className={cn(
                        "absolute top-2.5 right-3 text-xs",
                        img ? "text-white/80" : "text-muted-foreground"
                      )}
                    >
                      {m.maps ?? played} mapas
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 p-3 text-xs">
                    <Stat
                      label="% Vict."
                      value={wr === null ? "—" : `${wr}%`}
                    />
                    <Stat label="K/D" value={m.kd?.toFixed(2) ?? "—"} />
                    <Stat
                      label="ADR"
                      value={m.adr === null ? "—" : String(Math.round(m.adr))}
                    />
                  </div>
                  <div className="h-[3px] bg-muted">
                    <div
                      className={cn(
                        "h-full",
                        (wr ?? 0) >= 50 ? "bg-win" : "bg-muted-foreground"
                      )}
                      style={{ width: `${wr ?? 0}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
    </Loaded>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums">
        {value}
      </span>
    </span>
  )
}

// ---------- Partidas ----------

const KINDS = [
  { value: undefined, label: "Todas" },
  { value: "mix", label: "Mix" },
  { value: "pcw", label: "PCW" },
  { value: "official", label: "Torneo" },
] as const
const RESULTS = [
  { value: undefined, label: "Cualquier resultado" },
  { value: "won", label: "Victorias" },
  { value: "lost", label: "Derrotas" },
] as const

function Chips<V extends string | undefined>({
  label,
  options,
  value,
  onPick,
}: {
  label: string
  options: readonly { value: V; label: string }[]
  value: V
  onPick: (v: V) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onPick(o.value)}
          className={cn(
            "h-7 rounded-full border px-2.5 text-xs font-medium transition-colors",
            value === o.value
              ? "border-foreground bg-foreground text-background"
              : "hover:bg-muted"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Matches({
  nick,
  search,
  onChange,
}: {
  nick: string
  search: PlayerSearch
  onChange: (patch: Partial<PlayerSearch>) => void
}) {
  const q = useQuery(playerMatchesOptions(nick, search))
  const open = useOpenMatch()
  const head = "h-auto py-2.5 text-xs font-medium text-muted-foreground"
  const onKey = (m: PlayerMatch) => (e: KeyboardEvent) => {
    if (e.key === "Enter") open(m)
  }

  return (
    <div className={cn(card, "overflow-hidden")}>
      <div className="flex flex-wrap items-center gap-3 border-b p-3">
        <Chips
          label="Tipo"
          options={KINDS}
          value={search.kind}
          onPick={(kind) => onChange({ kind, page: undefined })}
        />
        <span aria-hidden className="h-5 w-px bg-border" />
        <Chips
          label="Resultado"
          options={RESULTS}
          value={search.result}
          onPick={(result) => onChange({ result, page: undefined })}
        />
      </div>
      <Table className="min-w-[700px] text-[13px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(head, "pl-4")}>Fecha</TableHead>
            <TableHead className={head}>Tipo</TableHead>
            <TableHead className={head}>Mapa</TableHead>
            <TableHead className={head}>Nombre en el juego</TableHead>
            <TableHead className={head}>Resultado</TableHead>
            <TableHead className={head}>K-D</TableHead>
            <TableHead className={head}>Rating</TableHead>
            <TableHead className={cn(head, "pr-4 text-right")}>ELO</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isPending ? (
            Array.from({ length: 6 }, (_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell colSpan={8} className="px-4 py-3">
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : q.isError || !q.data.items.length ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={8}
                className="px-4 py-10 text-center text-muted-foreground"
              >
                {q.isError
                  ? errorMessage(q.error)
                  : "No hay partidas con esos filtros."}
              </TableCell>
            </TableRow>
          ) : (
            q.data.items.map((m) => {
              const r = resultOf(m.won)
              return (
                <TableRow
                  key={m.match_id}
                  role="link"
                  tabIndex={0}
                  aria-label={matchTitle(m).title}
                  onClick={() => open(m)}
                  onKeyDown={onKey(m)}
                  className="cursor-pointer hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <TableCell className="pl-4">
                    {m.played_at ? fmtDay(m.played_at) : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex h-5 items-center rounded-[4px] bg-secondary px-1.5 text-[11px] font-medium">
                      {KIND_LABEL[m.kind]}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono">{m.map ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.game_nick ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-mono font-semibold tabular-nums",
                        r === "V"
                          ? "text-win"
                          : r === "D"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      )}
                    >
                      {r} {scoreOf(m) ?? ""}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {m.kills ?? 0}-{m.deaths ?? 0}
                  </TableCell>
                  <TableCell className="font-mono font-semibold tabular-nums">
                    {m.rating?.toFixed(2) ?? "—"}
                  </TableCell>
                  <TableCell className="pr-4 text-right font-mono text-xs font-semibold tabular-nums">
                    <Delta v={m.elo_delta} />
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      <ListPagination
        total={q.data?.total ?? 0}
        page={search.page ?? 1}
        per={search.per ?? DEFAULT_PER}
        perOptions={PER_OPTIONS}
        perLabel="Partidas por página"
        onPage={(p) => onChange({ page: p === 1 ? undefined : p })}
        onPer={(n) =>
          onChange({
            per: n === DEFAULT_PER ? undefined : (n as 50 | 100),
            page: undefined,
          })
        }
      />
    </div>
  )
}

// ---------- Equipos ----------

function Teams({ nick, legacy }: { nick: string; legacy: string | null }) {
  const q = useQuery(teamsOptions(nick))
  const old = legacyTeams(legacy)
  return (
    <div className={cn(card, "px-5 py-2")}>
      <Loaded q={q}>
        {(items) =>
          items.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              Todavía no estuvo en ningún equipo oficial.
            </p>
          ) : (
            items.map((s) => (
              <div
                key={`${s.team.id}-${s.joined_at ?? ""}`}
                className="flex flex-wrap items-center gap-3.5 border-b py-3"
              >
                <TagBox team={s.team} className="size-8 text-[10px]" />
                <span className="flex min-w-[140px] flex-1 flex-col">
                  <Link
                    to="/teams/$id"
                    params={{ id: s.team.id }}
                    className="text-sm font-medium hover:underline"
                  >
                    {s.team.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {stintRole(s.role, s.is_captain)}
                  </span>
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {stintPeriod(s.joined_at, s.left_at)}
                </span>
                {s.left_at === null && (
                  <span className="inline-flex h-5 items-center rounded-[calc(var(--radius)-4px)] bg-secondary px-1.5 text-[11px] font-medium">
                    Actual
                  </span>
                )}
              </div>
            ))
          )
        }
      </Loaded>
      <p className="py-3 text-xs text-muted-foreground">
        Se puede estar en varios equipos a la vez. El historial se arma con las
        altas y bajas de los rosters.
      </p>
      {old && (
        <div className="flex flex-col gap-1.5 border-t border-dashed py-3">
          <span className="text-xs text-muted-foreground">
            Antes de CM League
          </span>
          <span className="text-[13px] leading-relaxed">{old}</span>
        </div>
      )}
    </div>
  )
}

// ---------- Temporadas ----------

function Seasons({ nick }: { nick: string }) {
  const q = useQuery(seasonsOptions(nick))
  const head = "h-auto py-2.5 text-xs font-medium text-muted-foreground"
  return (
    <Loaded q={q}>
      {(items) =>
        items.length === 0 ? (
          <p
            className={cn(
              card,
              "px-4 py-8 text-center text-[13px] text-muted-foreground"
            )}
          >
            Todavía no terminó ninguna temporada.
          </p>
        ) : (
          <div className={cn(card, "overflow-hidden")}>
            <Table className="min-w-[640px] text-[13px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cn(head, "pl-4")}>Temporada</TableHead>
                  <TableHead className={cn(head, "text-center")}>
                    Puesto
                  </TableHead>
                  <TableHead className={cn(head, "text-right")}>ELO</TableHead>
                  <TableHead className={cn(head, "text-right")}>Pico</TableHead>
                  <TableHead className={cn(head, "text-center")}>
                    Mixes
                  </TableHead>
                  <TableHead className={cn(head, "text-center")}>V–D</TableHead>
                  <TableHead className={cn(head, "pr-4")}>Medalla</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => (
                  <TableRow key={s.season.id} className="hover:bg-transparent">
                    <TableCell className="pl-4 font-medium">
                      {s.season.name}
                    </TableCell>
                    <TableCell className="text-center font-mono font-semibold tabular-nums">
                      {s.rank ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {s.elo}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {s.peak_elo}
                    </TableCell>
                    <TableCell className="text-center font-mono tabular-nums">
                      {s.matches}
                    </TableCell>
                    <TableCell className="text-center font-mono tabular-nums">
                      {s.wins}–{s.losses}
                    </TableCell>
                    <TableCell className="pr-4">
                      {s.medal ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span aria-hidden className="text-sm leading-none">
                            {s.medal.icon}
                          </span>
                          {s.medal.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      }
    </Loaded>
  )
}

// ---------- Bio y palmarés ----------

function Bio({ nick, player }: { nick: string; player: PlayerDetail }) {
  const q = useQuery(titlesOptions(nick))
  return (
    <div className={cn(card, "flex max-w-[720px] flex-col gap-2.5 p-5")}>
      <span className="text-sm font-semibold">Biografía</span>
      <p className="text-sm leading-relaxed text-pretty whitespace-pre-line">
        {player.bio?.trim() || (
          <span className="text-muted-foreground">
            Todavía no escribió su biografía.
          </span>
        )}
      </p>
      <span className="mt-2 text-sm font-semibold">Palmarés</span>
      <Loaded q={q}>
        {(items) =>
          items.length === 0 ? (
            <span className="text-[13px] text-muted-foreground">
              Todavía sin títulos.
            </span>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((t) => (
                <li
                  key={`${t.event.id}-${t.result}`}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <span aria-hidden className="text-base">
                    {t.result === "champion" ? "🏆" : "🥈"}
                  </span>
                  <span className="flex flex-col">
                    <span>
                      {t.result === "champion" ? "Campeón" : "Subcampeón"} ·{" "}
                      {t.event.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      con {t.team.name}
                      {t.at && ` · ${fmtLong(t.at)}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      </Loaded>
      {player.achievements?.trim() && (
        <>
          <span className="mt-1.5 text-xs text-muted-foreground">
            Escrito por el jugador
          </span>
          <p className="text-[13px] leading-relaxed whitespace-pre-line">
            {player.achievements}
          </p>
        </>
      )}
    </div>
  )
}
