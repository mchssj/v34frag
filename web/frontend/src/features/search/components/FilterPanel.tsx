import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import {
  BookmarkIcon,
  LockIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { VipLock } from "@/features/vip/VipLock"
import {
  MAX_SAVED,
  savedSearchesOptions,
  useDeleteSearch,
  useSaveSearch,
} from "../api/queries"
import type { Chip } from "../lib/search"
import type { SavedSearch, SearchKind } from "../types"

// El botón, el panel, las píldoras y las búsquedas guardadas de los filtros avanzados. Los usan /ranking y /matches.

export function FilterToggle({
  open,
  onOpen,
  count,
  vip,
}: {
  open: boolean
  onOpen: (open: boolean) => void
  count: number
  vip: boolean
}) {
  return (
    <Button
      size="sm"
      variant={open ? "secondary" : "outline"}
      aria-expanded={open}
      className="h-8 text-[13px]"
      onClick={() => onOpen(!open)}
    >
      {vip ? (
        <SlidersHorizontalIcon aria-hidden />
      ) : (
        <LockIcon
          aria-hidden
          className="text-yellow-600 dark:text-yellow-300"
        />
      )}
      Filtros avanzados
      {vip && count > 0 && (
        <span className="rounded-full bg-primary px-1.5 font-mono text-[11px] text-primary-foreground">
          {count}
        </span>
      )}
    </Button>
  )
}

/** Los campos. Sin VIP se ven apagados, con la franja de cómo ser VIP. */
export function FilterPanel({
  vip,
  lock,
  children,
}: {
  vip: boolean
  lock: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 border-b p-4">
      {!vip && <VipLock>{lock}</VipLock>}
      <fieldset
        disabled={!vip}
        inert={!vip}
        className={cn(
          "grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4",
          !vip && "opacity-40"
        )}
      >
        {children}
      </fieldset>
    </div>
  )
}

/** Una píldora por filtro. Sin VIP (por ejemplo, con un link) van tachadas: no se aplican. */
export function FilterPills<K extends string>({
  chips,
  vip,
  onClear,
}: {
  chips: Chip<K>[]
  vip: boolean
  onClear: (keys: K[]) => void
}) {
  if (!chips.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2 text-xs">
      {chips.map((c) => (
        <span
          key={c.label}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border bg-muted/50 py-1 pr-1 pl-2.5",
            !vip && "line-through opacity-60"
          )}
        >
          {c.label}
          <button
            type="button"
            aria-label={`Quitar ${c.label}`}
            className="rounded-full p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() => onClear(c.clear)}
          >
            <XIcon aria-hidden className="size-3" />
          </button>
        </span>
      ))}
      <Button
        size="sm"
        variant="link"
        className="h-auto px-1 text-xs"
        onClick={() => onClear(chips.flatMap((c) => c.clear))}
      >
        Limpiar filtros
      </Button>
      {!vip && (
        <span className="text-muted-foreground">No se aplican sin VIP.</span>
      )}
    </div>
  )
}

/** Guardar la búsqueda actual y abrir una guardada. Con el VIP vencido se ven y se borran, pero no se suman. */
export function SavedSearches({
  kind,
  vip,
  current,
  onApply,
}: {
  kind: SearchKind
  vip: boolean
  /** Los filtros de ahora. Vacío: no hay nada que guardar. */
  current: SavedSearch["query"]
  onApply: (query: SavedSearch["query"]) => void
}) {
  const saved = useQuery(savedSearchesOptions(kind)).data ?? []
  const save = useSaveSearch(kind)
  const del = useDeleteSearch(kind)
  const [naming, setNaming] = useState<string | null>(null)
  const canSave = vip && Object.keys(current).length > 0
  if (!saved.length && !canSave) return null

  const submit = () => {
    const name = naming?.trim()
    if (!name) return
    save.mutate(
      { name, query: current },
      {
        onSuccess: () => {
          setNaming(null)
          toast.success(`Búsqueda "${name}" guardada.`)
        },
        onError: (e) => toast.error(errorMessage(e)),
      }
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2 text-xs">
      {saved.length > 0 && (
        <span className="text-muted-foreground">
          Guardadas ({saved.length}/{MAX_SAVED}):
        </span>
      )}
      {saved.map((x) => (
        <span
          key={x.id}
          className="inline-flex items-center rounded-full border"
        >
          <button
            type="button"
            className="rounded-l-full py-1 pr-1 pl-2.5 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() => onApply(x.query)}
          >
            {x.name}
          </button>
          <button
            type="button"
            aria-label={`Borrar ${x.name}`}
            className="rounded-full p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() =>
              del.mutate(x.id, {
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
          >
            <XIcon aria-hidden className="size-3" />
          </button>
        </span>
      ))}
      {canSave &&
        (naming === null ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setNaming("")}
          >
            <BookmarkIcon aria-hidden />
            Guardar búsqueda
          </Button>
        ) : (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <Input
              autoFocus
              aria-label="Nombre de la búsqueda"
              placeholder="Nombre"
              value={naming}
              maxLength={30}
              className="h-7 w-36 text-xs"
              onChange={(e) => setNaming(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setNaming(null)}
            />
            <Button
              type="submit"
              size="sm"
              className="h-7 text-xs"
              disabled={save.isPending || !naming.trim()}
            >
              Guardar
            </Button>
          </form>
        ))}
    </div>
  )
}
