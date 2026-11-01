import { cn } from "cn"
import { useState, type ReactNode } from "react"

/**
 * Franja del marcador con la foto del mapa de fondo (maestra de mapas) y un velo negro para que
 * se lea. Con foto la franja es oscura en los dos temas; sin foto, o si no carga, queda lisa.
 */
export function MapBackdrop({
  image,
  className,
  children,
}: {
  image: string | null
  className?: string
  children: ReactNode
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const photo = image !== null && failed !== image

  return (
    <div
      data-photo={photo || undefined}
      className={cn(
        "relative isolate",
        photo &&
          "dark bg-neutral-900 py-9 text-white [--muted-foreground:rgb(255_255_255/.74)]",
        className
      )}
    >
      {photo && (
        <>
          <img
            src={image}
            alt=""
            aria-hidden
            decoding="async"
            onError={() => setFailed(image)}
            className="absolute inset-0 -z-20 size-full object-cover"
          />
          <span
            aria-hidden
            className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(0_0_0/.74),rgb(0_0_0/.42)_50%,rgb(0_0_0/.74)),linear-gradient(to_top,rgb(0_0_0/.55),transparent_65%)]"
          />
        </>
      )}
      {children}
    </div>
  )
}
