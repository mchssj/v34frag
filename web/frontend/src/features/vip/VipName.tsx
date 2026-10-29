import { cn } from "cn"
import { BadgeCheckIcon } from "lucide-react"

import { PlayerAvatar } from "@/features/ranking/parts"
import { VipBadge } from "@/features/shop/cosmetics"

// Nombre y avatar con las marcas VIP (docs/bitacora/2026-10-29-ranking-vip en kyan/pruebas): el borde
// dorado en el avatar, la medalla VIP de CM League y el tilde de cuenta verificada. Se usan en el ranking,
// el comparador, los mixes y cualquier lista de jugadores.

export function VipAvatar({
  alias,
  photo,
  vip,
  className,
}: {
  alias: string
  photo: string | null
  vip: boolean
  className?: string
}) {
  return (
    <PlayerAvatar
      alias={alias}
      photo={photo}
      className={cn(
        vip && "ring-2 ring-amber-400 ring-offset-2 ring-offset-background",
        className
      )}
    />
  )
}

export function VipName({
  alias,
  vip,
  verified,
  className,
}: {
  alias: string
  vip: boolean
  verified: boolean
  className?: string
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <span
        className={cn(
          "truncate font-medium",
          vip && "text-amber-500 dark:text-amber-400"
        )}
      >
        {alias}
      </span>
      {verified && (
        <BadgeCheckIcon
          role="img"
          aria-label="Cuenta verificada"
          className="size-3.5 shrink-0 fill-sky-500 text-background"
        >
          <title>Cuenta verificada</title>
        </BadgeCheckIcon>
      )}
      {vip && <VipBadge className="h-[1.25em]" />}
    </span>
  )
}
