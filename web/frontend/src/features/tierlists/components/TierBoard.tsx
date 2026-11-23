import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import type { ReactNode } from "react"

import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { TeamCrest } from "@/components/brand/TeamCrest"
import type { Tierlist } from "../api/queries"
import { tierColor } from "../lib/board"

type Item = Tierlist["bank"][number]

/** La imagen y el nombre de un ítem: foto o avatar del jugador, escudo del equipo o la inicial del externo. */
export function ItemFace({
  item,
  className,
}: {
  item: Item
  className?: string
}) {
  return (
    <span className={cn("flex w-16 flex-col items-center gap-1", className)}>
      {item.kind === "player" ? (
        <PlayerAvatar
          alias={item.name}
          photo={item.image_url}
          playerId={item.id}
          className="size-14 rounded-lg after:rounded-lg"
          imageClassName="rounded-lg object-cover"
          fallbackClassName="rounded-lg"
        />
      ) : (
        <TeamCrest
          team={{ name: item.name, tag: item.tag, logo_url: item.image_url }}
          size="md"
        />
      )}
      <span className="w-full truncate text-center text-[11px] leading-tight font-medium">
        {item.name}
      </span>
    </span>
  )
}

function ItemLink({ item }: { item: Item }) {
  if (item.kind === "player")
    return (
      <Link
        to="/player/$nick"
        params={{ nick: item.name }}
        title={item.name}
        className="rounded-lg hover:bg-muted"
      >
        <ItemFace item={item} />
      </Link>
    )
  if (item.kind === "team" && item.id)
    return (
      <Link
        to="/teams/$id"
        params={{ id: item.id }}
        title={item.name}
        className="rounded-lg hover:bg-muted"
      >
        <ItemFace item={item} />
      </Link>
    )
  return (
    <span title={`${item.name} (no está en CMLeague)`}>
      <ItemFace item={item} />
    </span>
  )
}

/** Una fila: la etiqueta de color y lo que va adentro. */
export function TierRow({
  index,
  label,
  children,
  className,
  ...rest
}: {
  index: number
  label: ReactNode
  children: ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex min-h-[92px] border-b last:border-b-0", className)}
      {...rest}
    >
      <div
        className="flex w-20 shrink-0 items-center justify-center p-1.5 text-center text-sm font-bold break-words text-neutral-900 sm:w-24"
        style={{ backgroundColor: tierColor(index) }}
      >
        {label}
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap content-start gap-2 bg-muted/30 p-2">
        {children}
      </div>
    </div>
  )
}

/** La tierlist para mirar: los tiers con sus ítems (el banco no se muestra). */
export function TierBoard({ tierlist }: { tierlist: Pick<Tierlist, "tiers"> }) {
  return (
    <div
      className="overflow-hidden rounded-xl border"
      role="list"
      aria-label="Tiers"
    >
      {tierlist.tiers.map((t, i) => (
        <TierRow key={t.id} index={i} label={t.label} role="listitem">
          {t.items.map((it, j) => (
            <ItemLink key={`${it.kind}:${it.id ?? it.name}:${j}`} item={it} />
          ))}
        </TierRow>
      ))}
    </div>
  )
}
