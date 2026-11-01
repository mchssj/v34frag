import { cn } from "cn"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

/** Inicial de un alias o nombre, en mayúscula; "?" si está vacío. */
export const initialOf = (name: string) =>
  name.trim().charAt(0).toUpperCase() || "?"

const SIZES = {
  // Tamaño según quien lo usa (equipos, torneos): por `className`.
  default: { root: "", fallback: "text-secondary-foreground" },
  // Filas de listas (ranking, Comparar, fichas): 30px, sin aro y texto chico.
  row: {
    root: "size-[30px] after:hidden",
    fallback: "text-xs text-foreground",
  },
}

/** Foto del jugador o, si no tiene o no carga, la inicial del alias en un círculo. */
export function PlayerAvatar({
  alias,
  photo,
  size = "default",
  className,
  fallbackClassName,
}: {
  alias: string
  photo?: string | null
  size?: keyof typeof SIZES
  className?: string
  fallbackClassName?: string
}) {
  return (
    <Avatar aria-hidden className={cn("shrink-0", SIZES[size].root, className)}>
      {photo && <AvatarImage src={photo} alt="" />}
      <AvatarFallback
        className={cn(
          "bg-secondary font-semibold",
          SIZES[size].fallback,
          fallbackClassName
        )}
      >
        {initialOf(alias)}
      </AvatarFallback>
    </Avatar>
  )
}
