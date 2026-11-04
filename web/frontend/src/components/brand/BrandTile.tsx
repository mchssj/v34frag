import { SiDiscord, SiFaceit, SiSteam } from "@icons-pack/react-simple-icons"
import { cn } from "cn"

const ICONS = { discord: SiDiscord, steam: SiSteam, faceit: SiFaceit }
export type Brand = keyof typeof ICONS

/** Ícono de marca monocromo (Simple Icons) sobre un cuadro `muted`. */
export function BrandTile({
  brand,
  className,
}: {
  brand: Brand
  className?: string
}) {
  const Icon = ICONS[brand]
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-foreground",
        className
      )}
    >
      <Icon size={18} />
    </span>
  )
}
