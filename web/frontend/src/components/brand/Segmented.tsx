import { cn } from "cn"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type SegmentOption<T> = {
  value: T
  label: ReactNode
  icon?: LucideIcon
  /** Nombre accesible si `label` no es texto. */
  ariaLabel?: string
}

const SIZES = {
  // Rango del gráfico de ELO.
  sm: {
    group: "h-7 rounded-lg p-0.5",
    item: "h-6 px-2 text-xs data-[state=on]:shadow-[0_1px_2px_rgb(0_0_0/.1)]",
  },
  // Filtros de Torneos.
  md: {
    group: "h-8 rounded-[calc(var(--radius)-2px)] p-[3px]",
    item: "h-[26px] px-2.5 text-[13px]",
  },
  // Preferencias de Mi perfil y Mis equipos: con borde.
  lg: {
    group: "rounded-lg border p-[3px]",
    item: "h-[30px] gap-[7px] px-3 text-[13px] data-[state=on]:shadow-sm",
  },
}

/**
 * Control segmentado sobre el ToggleGroup de shadcn: opciones sobre `bg-muted`, la elegida en
 * tarjeta. Siempre queda una elegida. Acepta valores numéricos (se comparan como texto).
 */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  size = "md",
  disabled,
  className,
  itemClassName,
}: {
  label: string
  value: T
  options: readonly SegmentOption<T>[]
  onChange: (value: T) => void
  size?: keyof typeof SIZES
  disabled?: boolean
  className?: string
  itemClassName?: string
}) {
  return (
    <ToggleGroup
      type="single"
      aria-label={label}
      // Deshabilitado no marca ninguna (como las preferencias que no aplican).
      value={disabled ? "" : String(value)}
      onValueChange={(k) => {
        const o = options.find((x) => String(x.value) === k)
        if (o) onChange(o.value)
      }}
      disabled={disabled}
      className={cn(
        "max-w-full gap-0.5 overflow-x-auto bg-muted",
        SIZES[size].group,
        disabled && "opacity-50",
        className
      )}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={String(o.value)}
          value={String(o.value)}
          variant="segment"
          aria-label={o.ariaLabel}
          className={cn(
            "font-medium whitespace-nowrap",
            SIZES[size].item,
            itemClassName
          )}
        >
          {o.icon && <o.icon className="size-3.5" aria-hidden />}
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
