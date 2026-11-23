import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useState, type DragEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { pickerOptions, type Tierlist } from "../api/queries"
import {
  addItem,
  addTier,
  BANK,
  boardError,
  countItems,
  fromTierlist,
  hasEntry,
  entryKey,
  MAX_ITEMS,
  MAX_TIERS,
  moveItem,
  NAME_MAX,
  removeItem,
  removeTier,
  renameTier,
  shiftItem,
  shiftTier,
  toSave,
  type Board,
  type Entry,
} from "../lib/board"
import { ItemFace, TierRow } from "./TierBoard"

// Editor de una tierlist: arrastrar y soltar con el mouse (HTML5, sin librerías) y, para el teléfono y el teclado, el
// menú de cada ítem (mover a un tier, correrlo, quitarlo). Se guarda todo junto con "Guardar".

const DRAG_TYPE = "application/x-tierlist-item"

export function TierlistEditor({
  tierlist,
  saving,
  onSave,
  onCancel,
}: {
  tierlist: Tierlist
  saving: boolean
  onSave: (body: ReturnType<typeof toSave>) => void
  onCancel: () => void
}) {
  const [board, setBoard] = useState<Board>(() => fromTierlist(tierlist))
  const [over, setOver] = useState<string | null>(null)
  const error = boardError(board)
  const total = countItems(board)

  const drop = (container: string, index?: number) => (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOver(null)
    const key = e.dataTransfer.getData(DRAG_TYPE)
    if (key) setBoard((b) => moveItem(b, key, container, index))
  }
  const zone = (container: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      setOver(container)
    },
    onDragLeave: () => setOver((o) => (o === container ? null : o)),
    onDrop: drop(container),
  })
  const targets = [
    ...board.tiers.map((t) => ({
      key: t.key,
      label: t.label || "(sin nombre)",
    })),
    { key: BANK, label: "Sin clasificar" },
  ]
  const tile = (e: Entry, container: string, index: number) => (
    <EditableItem
      key={e.key}
      entry={e}
      targets={targets.filter((t) => t.key !== container)}
      onDrop={drop(container, index)}
      onMove={(to) => setBoard((b) => moveItem(b, e.key, to))}
      onShift={(by) => setBoard((b) => shiftItem(b, e.key, by))}
      onRemove={() => setBoard((b) => removeItem(b, e.key))}
    />
  )

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Nombre</span>
        <Input
          value={board.name}
          maxLength={NAME_MAX}
          onChange={(e) => setBoard((b) => ({ ...b, name: e.target.value }))}
        />
      </label>

      <div className="overflow-hidden rounded-xl border">
        {board.tiers.map((t, i) => (
          <TierRow
            key={t.key}
            index={i}
            className={cn(over === t.key && "ring-2 ring-primary ring-inset")}
            {...zone(t.key)}
            label={
              <div className="flex w-full flex-col items-center gap-1">
                <input
                  aria-label={`Nombre del tier ${i + 1}`}
                  value={t.label}
                  maxLength={NAME_MAX}
                  onChange={(e) =>
                    setBoard((b) => renameTier(b, t.key, e.target.value))
                  }
                  className="w-full rounded bg-white/40 px-1 text-center font-bold outline-none focus:bg-white/70"
                />
                <div className="flex gap-0.5">
                  <TierButton
                    label="Subir el tier"
                    disabled={i === 0}
                    onClick={() => setBoard((b) => shiftTier(b, t.key, -1))}
                  >
                    <ArrowUpIcon />
                  </TierButton>
                  <TierButton
                    label="Bajar el tier"
                    disabled={i === board.tiers.length - 1}
                    onClick={() => setBoard((b) => shiftTier(b, t.key, 1))}
                  >
                    <ArrowDownIcon />
                  </TierButton>
                  <TierButton
                    label="Borrar el tier (sus ítems vuelven a Sin clasificar)"
                    disabled={board.tiers.length <= 1}
                    onClick={() => setBoard((b) => removeTier(b, t.key))}
                  >
                    <Trash2Icon />
                  </TierButton>
                </div>
              </div>
            }
          >
            {t.items.map((e, j) => tile(e, t.key, j))}
          </TierRow>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={board.tiers.length >= MAX_TIERS}
        onClick={() => setBoard((b) => addTier(b))}
      >
        <PlusIcon aria-hidden />
        Agregar tier ({board.tiers.length}/{MAX_TIERS})
      </Button>

      <section className="flex flex-col gap-2" aria-label="Sin clasificar">
        <h3 className="text-sm font-semibold">
          Sin clasificar{" "}
          <span className="font-normal text-muted-foreground">
            · arrástralos a un tier o usa el menú de cada uno
          </span>
        </h3>
        <div
          {...zone(BANK)}
          className={cn(
            "flex min-h-[92px] flex-wrap content-start gap-2 rounded-xl border border-dashed p-2",
            over === BANK && "ring-2 ring-primary"
          )}
        >
          {board.bank.map((e, j) => tile(e, BANK, j))}
          {board.bank.length === 0 && (
            <p className="self-center px-2 text-sm text-muted-foreground">
              Lo que agregues aparece acá.
            </p>
          )}
        </div>
      </section>

      <Picker
        kind={tierlist.kind}
        full={total >= MAX_ITEMS}
        isAdded={(i) => i.kind !== "external" && hasEntry(board, entryKey(i))}
        onAdd={(i) => setBoard((b) => addItem(b, i))}
      />

      <div className="sticky bottom-0 z-[5] -mx-4 flex flex-wrap items-center justify-end gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <span
          className={cn(
            "mr-auto text-xs text-muted-foreground tabular-nums",
            error && "text-destructive"
          )}
        >
          {error ?? `${total}/${MAX_ITEMS} ítems`}
        </span>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button
          disabled={saving || !!error}
          onClick={() => onSave(toSave(board))}
        >
          <SaveIcon aria-hidden />
          Guardar
        </Button>
      </div>
    </div>
  )
}

function TierButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-6 place-items-center rounded text-neutral-900 enabled:hover:bg-black/10 disabled:opacity-30 [&_svg]:size-3.5"
    >
      {children}
    </button>
  )
}

function EditableItem({
  entry,
  targets,
  onDrop,
  onMove,
  onShift,
  onRemove,
}: {
  entry: Entry
  targets: { key: string; label: string }[]
  onDrop: (e: DragEvent) => void
  onMove: (to: string) => void
  onShift: (by: -1 | 1) => void
  onRemove: () => void
}) {
  // El menú va en su propio botón: si la ficha entera abriera el menú, se cruzaría con el arrastre.
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, entry.key)
        e.dataTransfer.effectAllowed = "move"
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault()
      }}
      onDrop={onDrop}
      className="relative cursor-grab rounded-lg p-0.5 hover:bg-muted active:cursor-grabbing"
    >
      <ItemFace item={entry} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${entry.name}: mover o quitar`}
            title="Mover o quitar"
            className="absolute -top-1 -right-1 grid size-6 place-items-center rounded-full border bg-background shadow-sm hover:bg-muted [&_svg]:size-3.5"
          >
            <EllipsisVerticalIcon />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{entry.name}</DropdownMenuLabel>
          {targets.map((t) => (
            <DropdownMenuItem key={t.key} onSelect={() => onMove(t.key)}>
              Mover a {t.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onShift(-1)}>
            <ArrowLeftIcon aria-hidden />
            Correr a la izquierda
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onShift(1)}>
            <ArrowRightIcon aria-hidden />
            Correr a la derecha
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onRemove}>
            <XIcon aria-hidden />
            Quitar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

type PickItem = Tierlist["bank"][number]

/** Buscar fichas o equipos de CMLeague, o escribir uno que no está. */
function Picker({
  kind,
  full,
  isAdded,
  onAdd,
}: {
  kind: Tierlist["kind"]
  full: boolean
  isAdded: (i: PickItem) => boolean
  onAdd: (i: PickItem) => void
}) {
  const [q, setQ] = useState("")
  const [external, setExternal] = useState("")
  const debounced = useDebouncedValue(q.trim(), 300)
  const results = useQuery(pickerOptions(kind, debounced))
  const what = kind === "players" ? "jugador" : "equipo"
  const addExternal = () => {
    const name = external.trim()
    if (!name || full) return
    onAdd({ kind: "external", id: null, name, tag: null, image_url: null })
    setExternal("")
  }
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border p-4"
      aria-label="Agregar"
    >
      <h3 className="text-sm font-semibold">
        Agregar {kind === "players" ? "jugadores" : "equipos"}
      </h3>
      {full && (
        <p className="text-sm text-destructive">
          Llegaste al tope de {MAX_ITEMS} ítems.
        </p>
      )}
      <Input
        type="search"
        aria-label={`Buscar un ${what} de CMLeague`}
        placeholder={`Buscar un ${what} de CMLeague…`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {debounced && results.data && (
        <ul className="flex flex-col">
          {results.data.length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">
              No hay resultados. Puedes agregarlo abajo como externo.
            </li>
          )}
          {results.data.map((r) => {
            const added = isAdded(r)
            return (
              <li key={r.id} className="border-t first:border-t-0">
                {/* Toda la fila agrega (foto, nombre o el botón): el botón solo quedaba lejos en pantallas anchas. */}
                <button
                  type="button"
                  disabled={added || full}
                  onClick={() => onAdd(r)}
                  aria-label={`${added ? "Ya agregado" : "Agregar"}: ${r.name}`}
                  className="group/pick flex w-full items-center gap-3 rounded-md px-1 py-1.5 text-left enabled:hover:bg-muted disabled:cursor-default"
                >
                  <ItemFace
                    item={r}
                    className="w-10 [&>*:first-child]:size-9 [&>span:last-child]:hidden"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {r.name}
                  </span>
                  <span
                    aria-hidden
                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground group-enabled/pick:group-hover/pick:text-foreground"
                  >
                    {added ? (
                      "Agregado"
                    ) : (
                      <>
                        <PlusIcon className="size-3.5" />
                        Agregar
                      </>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          addExternal()
        }}
      >
        <span className="text-xs text-muted-foreground">
          ¿No está en CMLeague? Escribe su nombre y se agrega con la inicial.
        </span>
        <div className="flex gap-2">
          <Input
            aria-label={`Nombre del ${what} externo`}
            placeholder={`Nombre del ${what}`}
            maxLength={NAME_MAX}
            value={external}
            onChange={(e) => setExternal(e.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={!external.trim() || full}
          >
            <PlusIcon aria-hidden />
            Agregar
          </Button>
        </div>
      </form>
    </section>
  )
}
