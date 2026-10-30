import { useQuery } from "@tanstack/react-query"
import { useBlocker } from "@tanstack/react-router"
import { cn } from "cn"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ImageIcon,
  PlusIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { mapsOptions } from "@/features/maps/queries"
import { SearchBox } from "@/features/ranking/SearchBox"
import {
  AdminHeader,
  Chip,
  EmptyState,
  FilterChips,
  PickHint,
  QueryError,
  SaveBar,
  SplitLayout,
  StatTile,
  TableBox,
  headCell,
} from "../ui"
import { AddMapDialog } from "./AddMapDialog"
import {
  catalogStats,
  changedCount,
  fromCatalog,
  inDefaultPool,
  inMixes,
  moveMap,
  saveError,
  type DraftMap,
} from "./catalog"
import { MapPanel } from "./MapPanel"
import { useSaveCatalog } from "./queries"

export const MAP_FILTERS = ["mixes", "veto", "nophoto", "retired"] as const
export type MapFilter = (typeof MAP_FILTERS)[number]

export function AdminMapsPage({
  filter,
  selected,
  onFilter,
  onSelect,
}: {
  filter: MapFilter | undefined
  selected: string | undefined
  onFilter: (f: MapFilter | undefined) => void
  onSelect: (name: string | undefined) => void
}) {
  const catalog = useQuery(mapsOptions)
  const saved = useMemo(
    () => (catalog.data ? fromCatalog(catalog.data) : null),
    [catalog.data]
  )
  // Orden, marcas, versiones y mapas nuevos se juntan acá hasta "Guardar catálogo".
  const [draft, setDraft] = useState<DraftMap[] | null>(null)
  const current = draft ?? saved ?? []
  const edit = (fn: (d: DraftMap[]) => DraftMap[]) => setDraft(fn(current))
  const changes = draft && saved ? changedCount(draft, saved) : 0
  const save = useSaveCatalog()
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState<string | undefined>(undefined)

  useBlocker({
    shouldBlockFn: ({ current: from, next }) =>
      changes > 0 &&
      from.pathname !== next.pathname &&
      !window.confirm("Hay cambios del catálogo sin guardar. ¿Salir igual?"),
    enableBeforeUnload: () => changes > 0,
  })

  const image = (name: string) =>
    catalog.data?.find((m) => m.name === name)?.image_url ?? null
  const stats = catalogStats(current, (n) => !!image(n))
  const blocked = saveError(current)

  const rows = current
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => {
      if (filter === "mixes" && !inMixes(m)) return false
      if (filter === "veto" && !inDefaultPool(m)) return false
      if (filter === "nophoto" && image(m.name)) return false
      if (filter === "retired" && m.active) return false
      return !q || m.versions.some((v) => v.includes(q.toLowerCase()))
    })
  const sel = current.find((m) => m.name === selected)
  const isSaved = (name: string) => !!saved?.some((m) => m.name === name)
  const update = (m: DraftMap) =>
    edit((d) => d.map((x) => (x.name === m.name ? m : x)))

  return (
    <section className={cn("flex flex-col gap-5", changes > 0 && "pb-24")}>
      <AdminHeader
        title="Mapas"
        subtitle="El catálogo de todos los mapas que se pueden jugar. Acá decides cuáles salen en Mixes, cuáles forman el pool por defecto del veto y la foto de cada uno. Un mapa no se borra: se retira."
        action={
          <Button size="md" onClick={() => setAdding(true)} disabled={!saved}>
            <PlusIcon aria-hidden />
            Agregar mapa
          </Button>
        }
      />

      {catalog.isError ? (
        <QueryError
          error={catalog.error}
          onRetry={() => void catalog.refetch()}
        />
      ) : catalog.isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            <StatTile
              label="En el select de Mixes"
              value={stats.mixes}
              sub="Los que se eligen al crear un mix"
              warn={false}
              onClick={() => onFilter("mixes")}
            />
            <StatTile
              label="Pool por defecto del veto"
              value={stats.defaultPool}
              sub={blocked ?? "PCW y torneos sin pool propio"}
              warn={!!blocked}
              onClick={() => onFilter("veto")}
            />
            <StatTile
              label="Sin foto"
              value={stats.noPhoto}
              sub={
                stats.noPhoto
                  ? "La sala del mix usa un fondo liso"
                  : "Todos tienen foto"
              }
              warn={stats.noPhoto > 0}
              onClick={() => onFilter("nophoto")}
            />
            <StatTile
              label="Retirados"
              value={stats.retired}
              sub="No entran en pools nuevos"
              warn={false}
              onClick={() => onFilter("retired")}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SearchBox
              value={q}
              label="Buscar mapas"
              placeholder="Buscar mapa"
              onChange={setQ}
            />
            <FilterChips
              label="Filtro"
              value={filter}
              onChange={onFilter}
              options={[
                { value: undefined, label: "Todos", count: current.length },
                { value: "mixes", label: "En Mixes", count: stats.mixes },
                {
                  value: "veto",
                  label: "Pool por defecto",
                  count: stats.defaultPool,
                },
                { value: "nophoto", label: "Sin foto", count: stats.noPhoto },
                { value: "retired", label: "Retirados", count: stats.retired },
              ]}
            />
          </div>

          <SplitLayout
            asideLabel="Detalle del mapa"
            main={
              <>
                {rows.length === 0 ? (
                  <EmptyState>Ningún mapa con ese filtro.</EmptyState>
                ) : (
                  <TableBox>
                    <Table className="min-w-[660px]">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className={cn(headCell, "w-20 pl-4")}>
                            Orden
                          </TableHead>
                          <TableHead className={headCell}>Mapa</TableHead>
                          <TableHead className={cn(headCell, "text-center")}>
                            Mixes
                          </TableHead>
                          <TableHead className={cn(headCell, "text-center")}>
                            Pool por defecto
                          </TableHead>
                          <TableHead className={headCell}>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map(({ m, i }) => (
                          <MapRow
                            key={m.name}
                            m={m}
                            image={image(m.name)}
                            on={m.name === selected}
                            first={i === 0}
                            last={i === current.length - 1}
                            onMove={(d) => edit((x) => moveMap(x, i, d))}
                            onChange={update}
                            onSelect={() => onSelect(m.name)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </TableBox>
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  El orden es el del select de Mixes y el del veto. "Pool por
                  defecto" es el que usan las PCW y los torneos que no eligen el
                  suyo.
                </p>
              </>
            }
            aside={
              sel ? (
                <MapPanel
                  key={sel.name}
                  map={sel}
                  draft={current}
                  image={image(sel.name)}
                  saved={isSaved(sel.name)}
                  onChange={update}
                  onClose={() => onSelect(undefined)}
                />
              ) : (
                <PickHint
                  title="Elige un mapa"
                  text="Acá cambias su foto, sus versiones del servidor y lo retiras."
                />
              )
            }
          />
        </>
      )}

      {changes > 0 && (
        <SaveBar
          title={
            changes === 1
              ? "1 mapa con cambios sin guardar"
              : `${changes} mapas con cambios sin guardar`
          }
          hint={
            blocked ??
            (save.isError
              ? errorMessage(save.error)
              : "Se guarda el catálogo completo, en este orden.")
          }
          error={!!blocked || save.isError}
          pending={save.isPending}
          disabled={!!blocked}
          saveLabel="Guardar catálogo"
          onDiscard={() => {
            setDraft(null)
            save.reset()
          }}
          onSave={() =>
            save.mutate(current, {
              onSuccess: () => {
                setDraft(null)
                toast.success("Catálogo guardado.")
              },
            })
          }
        />
      )}

      {adding && (
        <AddMapDialog
          draft={current}
          onClose={() => setAdding(false)}
          onAdd={(m) => {
            edit((d) => [...d, m])
            onSelect(m.name)
          }}
        />
      )}
    </section>
  )
}

function MapRow({
  m,
  image,
  on,
  first,
  last,
  onMove,
  onChange,
  onSelect,
}: {
  m: DraftMap
  image: string | null
  on: boolean
  first: boolean
  last: boolean
  onMove: (d: -1 | 1) => void
  onChange: (m: DraftMap) => void
  onSelect: () => void
}) {
  return (
    <TableRow
      className={cn(
        on && "bg-primary/[0.08]",
        !m.active && "text-muted-foreground"
      )}
    >
      <TableCell className="pl-3">
        <span className="flex gap-0.5">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={`Subir ${m.name}`}
            disabled={first}
            onClick={() => onMove(-1)}
          >
            <ChevronUpIcon aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={`Bajar ${m.name}`}
            disabled={last}
            onClick={() => onMove(1)}
          >
            <ChevronDownIcon aria-hidden />
          </Button>
        </span>
      </TableCell>
      <TableCell className="py-1.5">
        <button
          type="button"
          aria-pressed={on}
          onClick={onSelect}
          className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-muted"
        >
          <MapThumb image={image} dim={!m.active} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-mono text-[13px] font-semibold">
              {m.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {[
                m.versions.length > 1 && `${m.versions.length} versiones`,
                image ? "Con foto" : "Sin foto",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        </button>
      </TableCell>
      <TableCell className="text-center">
        <Switch
          aria-label={`Mixes: ${m.name}`}
          checked={inMixes(m)}
          disabled={!m.active}
          onCheckedChange={(v) => onChange({ ...m, mixes: v })}
        />
      </TableCell>
      <TableCell className="text-center">
        <Switch
          aria-label={`Pool por defecto: ${m.name}`}
          checked={inDefaultPool(m)}
          disabled={!m.active}
          onCheckedChange={(v) => onChange({ ...m, veto_default: v })}
        />
      </TableCell>
      <TableCell>
        <Chip tone={m.active ? "win" : "neutral"}>
          {m.active ? "Disponible" : "Retirado"}
        </Chip>
      </TableCell>
    </TableRow>
  )
}

export function MapThumb({
  image,
  dim,
  className,
}: {
  image: string | null
  dim?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-10 w-[72px] shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground",
        dim && "opacity-50",
        className
      )}
    >
      {image ? (
        <img src={image} alt="" className="size-full object-cover" />
      ) : (
        <ImageIcon className="size-4" />
      )}
    </span>
  )
}
