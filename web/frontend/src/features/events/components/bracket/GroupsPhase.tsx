import { cn } from "cn"
import { format, parseISO } from "date-fns"
import { useState } from "react"

import { Segmented } from "@/components/brand/Segmented"
import { Card } from "@/components/ui/card"
import { crossOf, scoreFrom, wonBy, type GroupView } from "../../lib/bracket"
import { qualifies } from "../../lib/model"
import type { EventMatch } from "../../types"
import { TagBox } from "../ui"
import { MatchCard } from "./MatchCard"
import { MatchPopover } from "./MatchPopover"

type View = "rounds" | "cross"

const VIEWS = [
  { value: "rounds", label: "Fechas" },
  { value: "cross", label: "Cruces" },
] as const

/** Fase de grupos (todos contra todos): una tarjeta por grupo con su tabla y sus partidas. */
export function GroupsPhase({
  groups,
  advance,
  bo,
}: {
  groups: GroupView[]
  advance: number
  bo: number | null
}) {
  return (
    <div className="flex w-max flex-col gap-5">
      {groups.map((g) => (
        <GroupCard key={g.grp} group={g} advance={advance} bo={bo} />
      ))}
    </div>
  )
}

function GroupCard({
  group,
  advance,
  bo,
}: {
  group: GroupView
  advance: number
  bo: number | null
}) {
  const [view, setView] = useState<View>("rounds")
  const info = [
    `${group.teams.length} equipos`,
    `clasifican ${advance}`,
    bo && `BO${bo}`,
  ].filter(Boolean)

  return (
    <Card variant="outline" asChild className="bg-card">
      <section aria-label={group.title}>
        <header className="flex items-center gap-3 border-b px-4 py-2.5">
          <h3 className="text-[15px] font-semibold">{group.title}</h3>
          <span className="text-xs text-muted-foreground">
            {info.join(" · ")}
          </span>
          <Segmented
            label={`Vista del ${group.title}`}
            value={view}
            options={VIEWS}
            onChange={setView}
            size="sm"
            className="ml-auto"
          />
        </header>
        <div className="flex items-start gap-8 p-4">
          <MiniTable group={group} advance={advance} />
          {view === "rounds" ? (
            <div className="flex gap-6">
              {group.rounds.map((r) => (
                <div key={r.round} className="flex w-[220px] flex-col gap-3">
                  <div className="flex justify-between text-xs font-medium text-muted-foreground">
                    <span>Fecha {r.round}</span>
                    <span className="font-mono">BO{r.matches[0].best_of}</span>
                  </div>
                  {r.matches.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <CrossTable group={group} />
          )}
        </div>
      </section>
    </Card>
  )
}

function MiniTable({ group, advance }: { group: GroupView; advance: number }) {
  const rows = group.rows.length
    ? group.rows.map((r) => ({
        team: r.team,
        place: r.place,
        played: r.played,
        record: `${r.won}-${r.lost}`,
        rounds:
          r.rounds_for == null
            ? "—"
            : `${r.rounds_for}:${r.rounds_against ?? 0}`,
        points: r.points ?? 0,
        qualified: qualifies(r, advance),
      }))
    : group.teams.map((team, i) => ({
        team,
        place: i + 1,
        played: 0,
        record: "0-0",
        rounds: "—",
        points: 0,
        qualified: false,
      }))
  return (
    <table className="min-w-[300px] border-collapse text-[12.5px] tabular-nums">
      <thead>
        <tr className="text-[11px] text-muted-foreground">
          <th className="pb-1.5 text-left font-medium">#</th>
          <th className="px-2 pb-1.5 text-left font-medium">Equipo</th>
          <th
            className="px-2 pb-1.5 text-right font-medium"
            title="Partidas jugadas"
          >
            PJ
          </th>
          <th
            className="px-2 pb-1.5 text-right font-medium"
            title="Ganadas y perdidas"
          >
            G-P
          </th>
          <th className="px-2 pb-1.5 text-right font-medium">Rondas</th>
          <th className="pb-1.5 pl-2 text-right font-medium" title="Puntos">
            Pts
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.team.id} className="h-[34px] border-t">
            <td
              className={cn(
                "relative pl-2 font-mono text-muted-foreground",
                r.qualified &&
                  "before:absolute before:inset-y-[7px] before:left-0 before:w-[3px] before:rounded-sm before:bg-win"
              )}
            >
              {r.place}
            </td>
            <td className="px-2">
              <span className="flex items-center gap-2">
                <TagBox team={r.team} className="size-[22px] text-[8px]" />
                <span className="max-w-[140px] truncate">{r.team.name}</span>
              </span>
            </td>
            <td className="px-2 text-right">{r.played}</td>
            <td className="px-2 text-right font-mono">{r.record}</td>
            <td className="px-2 text-right font-mono text-muted-foreground">
              {r.rounds}
            </td>
            <td className="pl-2 text-right font-mono font-semibold">
              {r.points}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CrossTable({ group }: { group: GroupView }) {
  const teams = group.teams
  return (
    <table className="border-separate border-spacing-1 text-xs">
      <thead>
        <tr>
          <th />
          {teams.map((t) => (
            <th
              key={t.id}
              className="px-1 font-medium text-muted-foreground"
              title={t.name}
            >
              {t.tag ?? t.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {teams.map((row) => (
          <tr key={row.id}>
            <th className="pr-2 text-left font-medium">
              <span className="flex items-center gap-2">
                <TagBox team={row} className="size-[22px] text-[8px]" />
                <span className="max-w-[110px] truncate">
                  {row.tag ?? row.name}
                </span>
              </span>
            </th>
            {teams.map((col) => (
              <td key={col.id}>
                {row.id === col.id ? (
                  <span
                    aria-hidden
                    className="block h-[34px] w-16 rounded-md bg-[repeating-linear-gradient(135deg,var(--muted)_0_5px,transparent_5px_10px)]"
                  />
                ) : (
                  <div className="flex gap-1">
                    {crossOf(group, row.id, col.id).map((m) => (
                      <CrossCell
                        key={m.id}
                        match={m}
                        row={row.id}
                        names={[row.name, col.name]}
                      />
                    ))}
                  </div>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CrossCell({
  match,
  row,
  names,
}: {
  match: EventMatch
  row: string
  names: [string, string]
}) {
  const won = wonBy(match, row)
  const played = match.status === "finished" || match.status === "live"
  const text = played
    ? scoreFrom(match, row)
    : match.starts_at
      ? format(parseISO(match.starts_at), "HH:mm")
      : "–"
  return (
    <MatchPopover match={match}>
      <button
        type="button"
        aria-label={`${names[0]} contra ${names[1]}: ${text}`}
        className={cn(
          "h-[34px] w-16 rounded-md border font-mono text-xs font-semibold tabular-nums outline-none hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50",
          won === true && "border-transparent bg-win/15 text-win",
          won === false &&
            "border-transparent bg-destructive/12 text-destructive",
          match.status === "live" && "border-destructive text-destructive",
          !played && "border-dashed font-medium text-muted-foreground"
        )}
      >
        {text}
      </button>
    </MatchPopover>
  )
}
