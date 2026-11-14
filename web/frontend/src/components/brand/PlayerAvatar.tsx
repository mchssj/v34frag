import { cn } from "cn"
import { useLayoutEffect, useRef, useState } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { usePlayerAvatar } from "@/features/shop/avatars"
import { AvatarMedia } from "@/features/shop/cosmetics"

import { initialOf } from "./initial"

export { initialOf }

/** Desde este ancho, el avatar puesto se ve animado; más chico (las filas), quieto y se anima al pasar el mouse. */
export const ANIMATED_FROM = 48

const SIZES = {
  // Tamaño según quien lo usa (equipos, torneos): por `className`.
  default: { root: "", fallback: "text-secondary-foreground" },
  // Filas de listas (ranking, Comparar, fichas): 30px, sin aro y texto chico.
  row: {
    root: "size-[30px] after:hidden",
    fallback: "text-xs text-foreground",
  },
}

/**
 * Foto del jugador o, si no tiene o no carga, la inicial del alias en un círculo. Con `playerId`, si la ficha tiene
 * puesto un avatar (de la Tienda o propio), se ve el avatar en lugar de la foto (bitácora
 * 2026-11-14-avatar-en-toda-la-web): animado desde 48 px, quieto en las filas.
 */
export function PlayerAvatar({
  alias,
  photo,
  playerId,
  size = "default",
  className,
  imageClassName,
  fallbackClassName,
}: {
  alias: string
  photo?: string | null
  /** La ficha: con ella se busca el avatar puesto. */
  playerId?: string | null
  size?: keyof typeof SIZES
  className?: string
  /** Clases de la foto; con el mismo redondeo del contenedor, la foto rellena el cuadro. */
  imageClassName?: string
  fallbackClassName?: string
}) {
  const avatar = usePlayerAvatar(playerId)
  const ref = useRef<HTMLSpanElement>(null)
  const [big, setBig] = useState(false)
  useLayoutEffect(() => {
    if (avatar && size !== "row" && ref.current)
      setBig(ref.current.getBoundingClientRect().width >= ANIMATED_FROM)
  }, [avatar, size])
  return (
    <Avatar
      ref={ref}
      aria-hidden
      className={cn("shrink-0", SIZES[size].root, className)}
    >
      {avatar ? (
        <AvatarMedia
          avatar={avatar}
          animate={big}
          className={cn("size-full rounded-full", imageClassName)}
        />
      ) : (
        <>
          {photo && (
            <AvatarImage src={photo} alt="" className={imageClassName} />
          )}
          <AvatarFallback
            className={cn(
              "bg-secondary font-semibold",
              SIZES[size].fallback,
              fallbackClassName
            )}
          >
            {initialOf(alias)}
          </AvatarFallback>
        </>
      )}
    </Avatar>
  )
}
