import { cn } from "cn"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

import { Badge, type BadgeVariant } from "@/components/ui/badge"
import { originOf, type Dest } from "../../lib/bracket"
import { sidesOf } from "../../lib/model"
import type { EventMatch } from "../../types"
import { TagBox } from "../ui"
import { useBracket } from "./context"
import { MatchPopover } from "./MatchPopover"

const DEST_TONE: Record<Dest["tone"], BadgeVariant> = {
  up: "win",
  down: "muted",
  out: "danger",
}

/** "VIVO", "Sáb 21:00" o nada. */
function corner(m: EventMatch) {
  if (m.status === "live") return { live: true, text: "VIVO" }
  if (m.status === "upcoming" && m.starts_at)
    return {
      live: false,
      text: format(parseISO(m.starts_at), "EEE HH:mm", { locale: es }),
    }
  return null
}

/**
 * Partida en una llave: franja verde del ganador y roja del perdedor, siembra, destino y, sin
 * equipo, de dónde sale cada lado. El clic abre el detalle resumido.
 */
export function MatchCard({ match }: { match: EventMatch }) {
  const { all, seeds, marks, hover, onHover } = useBracket()
  const sides = sidesOf(match)
  const empty = !sides[0].teamId && !sides[1].teamId
  const onPath = !!hover && sides.some((s) => s.teamId === hover)
  const live = match.status === "live"
  const dest = marks.get(match.id)
  const badge = corner(match)
  const names = sides.map((s, i) =>
    s.teamId
      ? s.name
      : (originOf(match, (i + 1) as 1 | 2, all) ?? "Por definir")
  )

  return (
    <MatchPopover match={match}>
      <button
        type="button"
        data-node={match.id}
        data-on-path={onPath || undefined}
        draggable={false}
        aria-label={`${names[0]} contra ${names[1]}`}
        className={cn(
          "relative flex w-full flex-col rounded-[calc(var(--radius)-2px)] border bg-background text-left shadow-[0_1px_2px_rgb(0_0_0/.06)] transition-[border-color,opacity] outline-none hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:border-primary",
          empty && "border-dashed bg-transparent shadow-none",
          onPath ? "border-primary" : live && "border-destructive",
          hover && !onPath && "opacity-45"
        )}
      >
        {sides.map((s, i) => {
          const d = dest?.[i]
          const seed = s.teamId ? seeds.get(s.teamId) : undefined
          return (
            <span
              key={i}
              onMouseEnter={() => s.teamId && onHover(s.teamId)}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "relative flex h-9 items-center gap-2 pr-2.5 pl-3 text-[13px]",
                // Sin overflow-hidden en la tarjeta (el chip VIVO sobresale): las filas llevan el radio.
                i === 0
                  ? "rounded-t-[calc(var(--radius)-3px)] border-b"
                  : "rounded-b-[calc(var(--radius)-3px)]",
                empty && "border-dashed",
                "before:absolute before:inset-y-1.5 before:-left-px before:w-[3px] before:rounded-r-[3px]",
                s.won && "before:bg-win",
                s.lost && "before:bg-destructive/60",
                hover && s.teamId === hover && "bg-primary/14"
              )}
            >
              <TagBox
                team={s.teamId ? s : null}
                className="size-[22px] text-[8px]"
              />
              <span
                className={cn(
                  "flex-1 truncate",
                  s.won && "font-semibold",
                  (!s.teamId || s.lost) && "text-muted-foreground"
                )}
              >
                {names[i]}
              </span>
              {seed && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  #{seed}
                </span>
              )}
              {d && (
                <Badge
                  variant={DEST_TONE[d.tone]}
                  size="xs"
                  shape="tag"
                  className="px-1 font-mono"
                >
                  {d.text}
                </Badge>
              )}
              <span
                className={cn(
                  "min-w-3 text-right font-mono text-[13px] font-semibold tabular-nums",
                  s.lost && "text-muted-foreground"
                )}
              >
                {s.score ?? ""}
              </span>
            </span>
          )
        })}
        {badge && (
          <Badge
            variant={badge.live ? "live" : "muted"}
            shape="tag"
            className={cn(
              "absolute -top-2 right-2 h-4 px-[5px] text-[9px] font-bold",
              !badge.live && "border font-mono font-semibold capitalize"
            )}
          >
            {badge.text}
          </Badge>
        )}
      </button>
    </MatchPopover>
  )
}
