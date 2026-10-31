import { cn } from "cn"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type ChipOption<V> = { value: V; label: string; count?: number }

const ALL = "__all"

const SIZES = {
  // Filtros de las listas (Partidas, Ranking, perfil).
  sm: { group: "gap-1", item: "h-7 px-2.5 text-xs" },
  // Filtros de Administración: el activo, en negrita.
  md: {
    group: "gap-2",
    item: "h-8 gap-1.5 px-3 text-[13px] font-normal data-[state=on]:font-semibold",
  },
}

/**
 * Filtros en píldoras sobre el ToggleGroup de shadcn: el activo va en `foreground` sólido.
 * Siempre queda uno elegido; "Todas" puede ser `undefined` o `null`.
 */
export function FilterChips<V extends string | undefined | null>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
  itemClassName,
}: {
  options: readonly ChipOption<V>[]
  value: V
  onChange: (v: V) => void
  label: string
  size?: keyof typeof SIZES
  className?: string
  itemClassName?: string
}) {
  // ToggleGroup trabaja con strings: "Todas" (undefined o null) usa un valor propio.
  const key = (v: V) => v ?? ALL
  return (
    <ToggleGroup
      type="single"
      aria-label={label}
      value={key(value)}
      onValueChange={(k) => {
        const o = options.find((x) => key(x.value) === k)
        if (o) onChange(o.value)
      }}
      className={cn("flex-wrap", SIZES[size].group, className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.label}
          value={key(o.value)}
          variant="pill"
          className={cn(SIZES[size].item, itemClassName)}
        >
          {o.label}
          {o.count !== undefined && (
            <span className="font-mono opacity-70">{o.count}</span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
