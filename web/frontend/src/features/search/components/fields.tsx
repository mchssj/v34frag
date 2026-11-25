import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { ChevronsUpDownIcon, XIcon } from "lucide-react"
import { useId, useState, type ReactNode } from "react"

import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { playerSearchOptions } from "@/features/ranking/api/queries"
import { useDebouncedValue } from "@/lib/useDebouncedValue"

// Campos de los filtros avanzados (bitácora 2026-11-24-exportar-stats-y-buscador-vip, prototipo de Kyan). Los usan el
// ranking y Partidas. Todos escriben en la URL.

const ANY = "__any"

export function FilterField({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        {value && <span className="font-mono tabular-nums">{value}</span>}
      </span>
      {children}
    </div>
  )
}

/** Muestra el valor mientras se arrastra y lo pasa a la URL al soltar. */
export function SliderField({
  label,
  min,
  max,
  step,
  value,
  format,
  onCommit,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number[]
  format: (v: number[]) => string
  onCommit: (v: number[]) => void
}) {
  const [local, setLocal] = useState(value)
  // Si la URL cambia por otro lado (una píldora, limpiar, una búsqueda guardada), se toma el valor nuevo.
  const key = value.join()
  const [urlKey, setUrlKey] = useState(key)
  if (key !== urlKey) {
    setUrlKey(key)
    setLocal(value)
  }
  return (
    <FilterField label={label} value={format(local)}>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={local}
        onValueChange={setLocal}
        onValueCommit={onCommit}
        className="py-2"
      />
    </FilterField>
  )
}

export function SelectField({
  label,
  value,
  options,
  anyLabel = "Cualquiera",
  onChange,
}: {
  label: string
  value: string | undefined
  options: { value: string; label: string }[]
  /** Texto de la opción sin elegir. */
  anyLabel?: string
  onChange: (v: string | undefined) => void
}) {
  return (
    <FilterField label={label}>
      <Select
        value={value ?? ANY}
        onValueChange={(v) => onChange(v === ANY ? undefined : v)}
      >
        <SelectTrigger
          size="sm"
          aria-label={label}
          className="h-8 w-full text-[13px]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{anyLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  )
}

export function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  const id = useId()
  return (
    <span className="flex h-8 items-center gap-2 self-end">
      <Switch id={id} size="sm" checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-[13px] font-normal">
        {label}
      </Label>
    </span>
  )
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | undefined
  onChange: (v: string | undefined) => void
}) {
  return (
    <FilterField label={label}>
      <Input
        type="date"
        aria-label={label}
        value={value ?? ""}
        className="h-8 text-[13px]"
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    </FilterField>
  )
}

/** Un jugador por su alias, con el buscador del comparador. */
export function PlayerField({
  label,
  value,
  disabled,
  placeholder = "Elegir jugador",
  taken = [],
  onChange,
}: {
  label: string
  value: string | undefined
  disabled?: boolean
  placeholder?: string
  /** Los que ya están en otro campo: no se pueden repetir. */
  taken?: (string | undefined)[]
  onChange: (nick: string | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <FilterField label={label}>
      <span className="flex gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-label={label}
              disabled={disabled}
              className="h-8 min-w-0 flex-1 justify-between px-2.5 text-[13px] font-normal"
            >
              <span
                className={cn("truncate", !value && "text-muted-foreground")}
              >
                {value ?? placeholder}
              </span>
              <ChevronsUpDownIcon aria-hidden className="size-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-0" align="start">
            <PlayerPicker
              taken={taken}
              onPick={(nick) => {
                onChange(nick)
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Quitar ${label.toLowerCase()}`}
            onClick={() => onChange(undefined)}
          >
            <XIcon aria-hidden />
          </Button>
        )}
      </span>
    </FilterField>
  )
}

/** La lista con su buscador. Solo se monta con el popover abierto. */
export function PlayerPicker({
  taken,
  onPick,
}: {
  taken: (string | undefined)[]
  onPick: (nick: string) => void
}) {
  const [q, setQ] = useState("")
  const debounced = useDebouncedValue(q.trim(), 250)
  const results = useQuery(playerSearchOptions(debounced))
  const isTaken = (n: string) =>
    taken.some((t) => t?.toLowerCase() === n.toLowerCase())
  return (
    <Command shouldFilter={false}>
      <CommandInput
        value={q}
        onValueChange={setQ}
        placeholder="Buscar por alias"
      />
      <CommandList>
        {results.isPending ? (
          <div className="p-2">
            <Skeleton className="h-7 w-full" />
          </div>
        ) : (
          <>
            <CommandEmpty>No hay jugadores con ese alias.</CommandEmpty>
            {results.data?.map((p) => (
              <CommandItem
                key={p.id}
                value={p.id}
                disabled={isTaken(p.alias)}
                onSelect={() => onPick(p.alias)}
              >
                <PlayerAvatar
                  size="row"
                  alias={p.alias}
                  playerId={p.id}
                  photo={p.photo_url}
                  className="size-6"
                />
                <span className="flex-1 truncate">{p.alias}</span>
                {p.elo !== null && (
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {p.elo}
                  </span>
                )}
              </CommandItem>
            ))}
          </>
        )}
      </CommandList>
    </Command>
  )
}
