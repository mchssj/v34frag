import { cn } from "cn"
import {
  AR,
  BO,
  BR,
  CL,
  CO,
  CR,
  CU,
  DO,
  EC,
  ES,
  GT,
  HN,
  MX,
  NI,
  PA,
  PE,
  PR,
  PY,
  SV,
  US,
  UY,
  VE,
} from "country-flag-icons/react/3x2"
import { GlobeIcon } from "lucide-react"

import type { COUNTRIES } from "@/features/profile/schemas"

type CountryName = (typeof COUNTRIES)[number]

// Banderas en SVG (country-flag-icons): Windows no dibuja los emojis de banderas.
const FLAGS: Record<Exclude<CountryName, "Otro">, typeof AR> = {
  Argentina: AR,
  Bolivia: BO,
  Brasil: BR,
  Chile: CL,
  Colombia: CO,
  "Costa Rica": CR,
  Cuba: CU,
  Ecuador: EC,
  "El Salvador": SV,
  España: ES,
  "Estados Unidos": US,
  Guatemala: GT,
  Honduras: HN,
  México: MX,
  Nicaragua: NI,
  Panamá: PA,
  Paraguay: PY,
  Perú: PE,
  "Puerto Rico": PR,
  "República Dominicana": DO,
  Uruguay: UY,
  Venezuela: VE,
}

/**
 * Bandera de un país de la lista del perfil ("Otro" muestra un globo). Sin `label` es
 * decorativa (el nombre ya está al lado); con `label` se anuncia como imagen.
 */
export function CountryFlag({
  country,
  label,
  className,
}: {
  country: CountryName
  label?: string
  className?: string
}) {
  const a11y = label
    ? { role: "img", "aria-label": label }
    : { "aria-hidden": true as const }
  if (country === "Otro")
    return (
      <GlobeIcon
        {...a11y}
        className={cn("size-3.5 shrink-0 text-muted-foreground", className)}
      />
    )
  const Flag = FLAGS[country]
  return (
    <Flag
      {...a11y}
      // size-auto: Select y DropdownMenu fuerzan size-4 en los svg sin "size-" en la clase.
      className={cn(
        "size-auto h-3 w-[18px] shrink-0 rounded-[2px] ring-1 ring-foreground/10",
        className
      )}
    />
  )
}
