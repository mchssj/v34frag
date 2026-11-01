import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { resultFor, type MatchResult } from "../lib/model"
import { teamMatchesOptions } from "../api/queries"
import { Panel } from "./ui"

// --- Forma reciente ------------------------------------------------------

export function RecentForm({ teamId }: { teamId: string }) {
  const matches = useQuery(teamMatchesOptions(teamId)).data
  const results: MatchResult[] = (matches ?? []).map((m) =>
    resultFor(m, teamId)
  )
  const pills = results.filter((r) => r.won !== null)

  return (
    <Panel
      title="Forma reciente"
      aside={
        pills.length > 0 && (
          <span className="flex gap-1" aria-label="Últimos resultados">
            {pills.map((r) => (
              <span
                key={r.id}
                className={cn(
                  "grid size-5 place-items-center rounded-[4px] font-mono text-[10px] font-bold",
                  r.won
                    ? "bg-win/15 text-win"
                    : "bg-destructive/15 text-destructive"
                )}
              >
                {r.won ? "V" : "D"}
              </span>
            ))}
          </span>
        )
      }
      className="flex-1"
    >
      {results.length === 0 ? (
        <p className="px-[18px] py-6 text-sm text-muted-foreground">
          Todavía no jugó partidas.
        </p>
      ) : (
        <ul>
          {results.map((r) => (
            <li key={r.id} className="border-b last:border-b-0">
              <Link
                to="/match/$id"
                params={{ id: r.id }}
                className="flex items-center gap-3 px-[18px] py-2.5 outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-7 w-[3px] shrink-0 rounded-full",
                    r.live
                      ? "bg-destructive"
                      : r.won === null
                        ? "bg-muted-foreground"
                        : r.won
                          ? "bg-win"
                          : "bg-destructive"
                  )}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">
                    vs {r.opponent}
                  </span>
                  {r.context && (
                    <span className="truncate text-xs text-muted-foreground">
                      {r.context}
                    </span>
                  )}
                </span>
                <span className="font-mono text-sm font-bold">{r.score}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
