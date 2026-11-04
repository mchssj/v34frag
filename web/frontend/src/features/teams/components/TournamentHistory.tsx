import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { Skeleton } from "@/components/ui/skeleton"
import { dateRange } from "@/features/events/lib/model"
import { RESULT_LABEL, resultText } from "../lib/model"
import { teamEventsOptions } from "../api/queries"
import { Panel } from "./ui"

// --- Torneos en los que participó ---------------------------------------

const TONE: Record<"win" | "live" | "mid", { dot: string; chip: string }> = {
  win: {
    dot: "bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_20%,transparent)]",
    chip: "bg-primary text-primary-foreground",
  },
  live: {
    dot: "bg-destructive shadow-[0_0_0_4px_var(--muted)]",
    chip: "bg-destructive text-white",
  },
  mid: {
    dot: "bg-muted-foreground shadow-[0_0_0_4px_var(--muted)]",
    chip: "bg-secondary text-secondary-foreground",
  },
}

/** Línea de tiempo de los torneos del equipo, con hasta dónde llegó en cada uno. */
export function TournamentHistory({ teamId }: { teamId: string }) {
  const events = useQuery(teamEventsOptions(teamId)).data

  return (
    <Panel title="Torneos en los que participó">
      {!events ? (
        <div className="flex gap-4 p-[18px]">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[86px] w-[170px]" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="px-[18px] py-6 text-sm text-pretty text-muted-foreground">
          Todavía no jugó ningún torneo.
        </p>
      ) : (
        <ol
          aria-label="Torneos en los que participó"
          className="flex overflow-x-auto overflow-y-hidden p-[18px]"
        >
          {events.map((e) => {
            const tone = TONE[RESULT_LABEL[e.result].tone]
            return (
              <li key={e.event.id} className="w-[170px] flex-none">
                <Link
                  to="/events/$id"
                  params={{ id: e.event.id }}
                  className="flex flex-col gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex w-full items-center" aria-hidden>
                    <span
                      className={cn(
                        "size-3.5 flex-none rounded-full",
                        tone.dot
                      )}
                    />
                    <span className="h-0.5 flex-1 bg-border" />
                  </span>
                  <span className="flex flex-col gap-0.5 pr-3.5">
                    <span className="text-[13px] leading-snug font-semibold hover:underline">
                      {e.event.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {dateRange(e.event.starts_on, e.event.ends_on)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-[22px] w-fit items-center rounded-[calc(var(--radius)-4px)] px-2 text-[11px] font-semibold",
                      tone.chip
                    )}
                  >
                    {resultText(e.result, e.place)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}
