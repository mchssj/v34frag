import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import { ChevronRightIcon } from "lucide-react"
import { type KeyboardEvent } from "react"
import { WatchTvButton } from "@/features/mixes/components/parts"
import { liveMixesOptions } from "@/features/mixes/api/queries"
import type { MixItem } from "@/features/mixes/types"
import { KindBadge } from "@/components/brand/KindBadge"

// ---------- En vivo ----------

/** Los mixes en juego: una fila completa por mix, con las columnas de la tabla. */
export function LiveBlock() {
  const live = useQuery(liveMixesOptions).data
  const navigate = useNavigate()
  if (!live?.length) return null
  return (
    <section
      aria-label="En vivo"
      className="flex flex-col gap-2 border-b bg-destructive/[0.04] p-3"
    >
      <span className="flex items-center gap-2 text-xs font-semibold text-destructive">
        <span
          aria-hidden
          className="size-1.5 animate-live rounded-full bg-current"
        />
        En vivo · {live.length}
      </span>
      <div className="flex flex-col gap-1.5 overflow-x-auto">
        {live.map((x) => (
          <LiveRow
            key={x.live_uid ?? x.match_id}
            x={x}
            onOpen={() =>
              x.live_uid &&
              void navigate({
                to: "/mixes/live/$uid",
                params: { uid: x.live_uid },
              })
            }
          />
        ))}
      </div>
    </section>
  )
}

function LiveRow({ x, onOpen }: { x: MixItem; onOpen: () => void }) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") onOpen()
  }
  const round = x.current_round ?? x.rounds_played + 1
  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`En vivo: ${x.side1.name ?? "Bando 1"} contra ${x.side2.name ?? "Bando 2"}${x.map ? ` en ${x.map}` : ""}`}
      onClick={onOpen}
      onKeyDown={onKey}
      className={cn(
        "grid h-12 min-w-[860px] cursor-pointer grid-cols-[52px_130px_minmax(110px,1fr)_68px_minmax(110px,1fr)_minmax(180px,auto)_auto_16px] items-center gap-3 rounded-[10px] border bg-card px-3 text-[13px] whitespace-nowrap outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
        x.stale && "opacity-60"
      )}
    >
      <KindBadge kind="mix" />
      <span className="truncate font-mono font-medium">{x.map ?? "—"}</span>
      <span className="truncate text-right">{x.side1.name ?? "Bando 1"}</span>
      <span className="text-center font-mono text-[15px] font-semibold text-destructive tabular-nums">
        {x.side1.score ?? 0} : {x.side2.score ?? 0}
      </span>
      <span className="truncate">{x.side2.name ?? "Bando 2"}</span>
      <span className="truncate text-xs text-muted-foreground">
        Ronda {round}
        {x.max_rounds ? ` de ${x.max_rounds}` : ""} ·{" "}
        {x.server?.name ?? "Servidor"}
        {x.stale && " · Sin novedades del servidor"}
      </span>
      {x.tv ? (
        <WatchTvButton tv={x.tv} />
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
      <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground" />
    </div>
  )
}
