import { cn } from "cn"
import { useMemo } from "react"

import { TeamCrest } from "@/components/brand/TeamCrest"
import type {
  SwissBucket,
  SwissGrid,
  SwissResult,
  TeamRef,
} from "../../lib/bracket"
import type { EventMatch } from "../../types"
import { Connectors, type Connector } from "./Connectors"
import { useBracket } from "./context"
import { MatchPopover } from "./MatchPopover"

const node = (record: string) => `rec-${record}`

/** Flecha verde al récord al que pasa el que gana y roja al del que pierde. */
function swissLinks(grid: SwissGrid): Connector[] {
  const out: Connector[] = []
  for (const r of grid.rounds)
    for (const b of r.buckets) {
      out.push({
        from: node(b.record),
        to: node(`${b.wins + 1}:${b.losses}`),
        tone: "win",
        fromAt: 0.3,
      })
      out.push({
        from: node(b.record),
        to: node(`${b.wins}:${b.losses + 1}`),
        tone: "lose",
        fromAt: 0.7,
      })
    }
  return out
}

/**
 * Fase suiza como grilla por récord: columnas por ronda, un recuadro por récord y, a la derecha,
 * las franjas de clasificados (arriba) y eliminados (abajo). Las partidas muestran solo los
 * escudos; el resto está en el detalle.
 */
export function SwissPhase({ grid }: { grid: SwissGrid }) {
  const links = useMemo(() => swissLinks(grid), [grid])
  const cols = grid.wins * 2
  return (
    <div
      className="relative grid w-max grid-rows-[auto_auto_1fr_auto] gap-x-[46px] gap-y-4"
      style={{ gridTemplateColumns: `repeat(${cols}, 150px)` }}
    >
      <Connectors links={links} />
      {grid.rounds.map((r, i) => (
        <span
          key={`h${r.round}`}
          className="row-start-1 text-xs font-medium text-muted-foreground"
          style={{ gridColumn: i + 1 }}
        >
          Ronda {r.round}
        </span>
      ))}
      <Band kind="q" results={grid.qualified} wins={grid.wins} />
      {grid.rounds.map((r, i) => (
        <div
          key={r.round}
          className={cn(
            "flex flex-col justify-center gap-[18px]",
            // Las primeras rondas ocupan todo el alto; las demás, el medio entre las franjas.
            i < grid.wins ? "row-span-3 row-start-2" : "row-start-3"
          )}
          style={{ gridColumn: i + 1 }}
        >
          {r.buckets.map((b) => (
            <Bucket key={b.record} bucket={b} />
          ))}
        </div>
      ))}
      <Band kind="x" results={grid.eliminated} wins={grid.wins} />
    </div>
  )
}

function Bucket({ bucket }: { bucket: SwissBucket }) {
  return (
    <div
      data-node={node(bucket.record)}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border p-2",
        bucket.wins > bucket.losses
          ? "border-win/25 bg-win/8"
          : bucket.losses > bucket.wins
            ? "border-destructive/20 bg-destructive/7"
            : "bg-muted"
      )}
    >
      <div className="flex items-center gap-1.5 px-0.5 pb-0.5">
        <b className="font-mono text-sm">{bucket.record}</b>
        {bucket.bo && (
          <span className="ml-auto rounded-[4px] border bg-card px-1 font-mono text-[10px] font-semibold text-muted-foreground">
            BO{bucket.bo}
          </span>
        )}
      </div>
      {bucket.matches.map((m, i) =>
        m ? <SwissMatch key={m.id} match={m} /> : <Pending key={`p${i}`} />
      )}
    </div>
  )
}

function SwissMatch({ match }: { match: EventMatch }) {
  const { hover } = useBracket()
  const ids = [match.side1.team?.id, match.side2.team?.id]
  const onPath = !!hover && ids.includes(hover)
  const names = [match.side1, match.side2].map(
    (s) => s.team?.name ?? "Por definir"
  )
  return (
    <MatchPopover match={match}>
      <button
        type="button"
        aria-label={`${names[0]} contra ${names[1]}`}
        className={cn(
          "relative flex h-11 items-center justify-center gap-3.5 rounded-lg bg-card px-2 transition-opacity outline-none hover:ring-1 hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:ring-2 data-[state=open]:ring-primary",
          match.status === "live" && "ring-[1.5px] ring-destructive",
          hover && !onPath && "opacity-45"
        )}
      >
        <Tile match={match} side={1} />
        <span className="text-[11px] text-muted-foreground">vs</span>
        <Tile match={match} side={2} />
        {match.status === "live" && (
          <span className="absolute -top-2 right-1.5 grid h-4 place-items-center rounded bg-destructive px-[5px] text-[9px] font-bold text-white">
            VIVO
          </span>
        )}
      </button>
    </MatchPopover>
  )
}

function Tile({ match, side }: { match: EventMatch; side: 1 | 2 }) {
  const { hover, onHover } = useBracket()
  const team = (side === 1 ? match.side1 : match.side2).team
  const done = match.status === "finished" && match.winner_side
  const won = done && match.winner_side === side
  const lost = done && match.winner_side !== side
  return (
    <span
      onMouseEnter={() => team && onHover(team.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "grid size-8 place-items-center rounded-[9px] bg-muted",
        won && "bg-win/30 shadow-[inset_0_0_0_1.5px_var(--win)]",
        lost && "bg-destructive/14",
        hover && team?.id === hover && "shadow-[inset_0_0_0_2px_var(--primary)]"
      )}
    >
      {team && (
        <TeamCrest
          team={team}
          size="xs"
          className={cn(lost && "opacity-40 grayscale")}
        />
      )}
    </span>
  )
}

function Pending() {
  return (
    <div className="flex h-11 items-center justify-center gap-3.5 rounded-lg border border-dashed border-foreground/20">
      <span className="size-8 rounded-[9px] border border-dashed border-foreground/20" />
      <span className="text-[11px] text-muted-foreground">vs</span>
      <span className="size-8 rounded-[9px] border border-dashed border-foreground/20" />
      <span className="sr-only">Partida por armar</span>
    </div>
  )
}

function Band({
  kind,
  results,
  wins,
}: {
  kind: "q" | "x"
  results: SwissResult[]
  wins: number
}) {
  return (
    <div
      role="group"
      aria-label={kind === "q" ? "Clasificados" : "Eliminados"}
      className={cn(
        "grid grid-cols-subgrid rounded-[14px] border py-3",
        kind === "q"
          ? "row-start-2 border-win/55 bg-win/22"
          : "row-start-4 border-destructive/50 bg-destructive/18"
      )}
      style={{ gridColumn: `${wins + 1} / -1` }}
    >
      {results.map((r) => (
        <div
          key={r.record}
          data-node={node(r.record)}
          className="flex flex-col items-center gap-2"
          style={{ gridColumn: r.wins + r.losses + 1 - wins }}
        >
          <b
            className={cn(
              "font-mono text-sm",
              kind === "q" ? "text-win" : "text-destructive"
            )}
          >
            {r.record}
          </b>
          <div className="flex max-w-[130px] flex-wrap justify-center gap-2">
            {r.teams.map((t) => (
              <ResultCrest key={t.id} team={t} />
            ))}
            {Array.from(
              { length: Math.max(0, r.slots - r.teams.length) },
              (_, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="size-[34px] rounded-[9px] border-[1.5px] border-dashed border-foreground/25"
                />
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function ResultCrest({ team }: { team: TeamRef }) {
  const { hover, onHover } = useBracket()
  return (
    <span
      title={team.name}
      onMouseEnter={() => onHover(team.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "rounded-[9px] shadow-[0_0_0_2px_var(--card)]",
        hover === team.id && "shadow-[0_0_0_2px_var(--primary)]"
      )}
    >
      <TeamCrest
        team={team}
        size="xs"
        className="size-[34px] rounded-[9px] text-[10px]"
      />
      <span className="sr-only">{team.name}</span>
    </span>
  )
}
