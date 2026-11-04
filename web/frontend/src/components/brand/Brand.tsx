import { cn } from "cn"

import lockupDark from "@/assets/brand/cmleague-lockup-color-fondo-oscuro.svg"
import lockupLight from "@/assets/brand/cmleague-lockup-color-fondo-claro.svg"
import markDark from "@/assets/brand/cmleague-mark-color-fondo-oscuro.svg"
import markLight from "@/assets/brand/cmleague-mark-color-fondo-claro.svg"
import wordmarkDark from "@/assets/brand/cmleague-wordmark-color-fondo-oscuro.svg"
import wordmarkLight from "@/assets/brand/cmleague-wordmark-color-fondo-claro.svg"

// Marca CM League con los SVG oficiales (CSSTV/CM-League-Logo), sin recolorear: la versión
// "fondo claro" en el tema claro y la "fondo oscuro" en el oscuro. Solo se fija el alto (el ancho
// sale de la proporción). Son decorativas: el nombre accesible lo pone el link o botón que las
// contiene. Mínimos del paquete: isotipo 16px, lockup 24px de alto.

function Themed({
  light,
  dark,
  className,
}: {
  light: string
  dark: string
  className?: string
}) {
  return (
    <>
      <img
        src={light}
        alt=""
        aria-hidden
        draggable={false}
        className={cn("w-auto shrink-0 dark:hidden", className)}
      />
      <img
        src={dark}
        alt=""
        aria-hidden
        draggable={false}
        className={cn("hidden w-auto shrink-0 dark:block", className)}
      />
    </>
  )
}

/** Isotipo: el cuadro con la mira. */
export function BrandMark({ className }: { className?: string }) {
  return <Themed light={markLight} dark={markDark} className={className} />
}

/** Wordmark: "CM League" sin el isotipo. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <Themed light={wordmarkLight} dark={wordmarkDark} className={className} />
  )
}

/** Lockup horizontal: isotipo + "CM League". */
export function BrandLockup({ className }: { className?: string }) {
  return <Themed light={lockupLight} dark={lockupDark} className={className} />
}
