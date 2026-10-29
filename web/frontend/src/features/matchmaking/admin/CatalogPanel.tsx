import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import {
  ImageIcon,
  ImageOffIcon,
  PencilIcon,
  PlusIcon,
  UploadIcon,
} from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { MAP_ART_RULES, MAP_ART_TYPES, mapLabel } from "../labels"
import { useMmAdminMutation } from "../queries"
import { useMmSource } from "../source"
import type { MapArt, MmCatalogMap } from "../types"

// Catálogo de mapas (plan, decisiones "Catálogo de mapas" e "Imagen y fondo de cada mapa"): agregar,
// editar y retirar mapas, y subir su imagen y su fondo. Es el mismo catálogo de Mixes, PCW y torneos.

const catalogKey = ["mm", "admin", "catalog"] as const
const NAME_RE = /^[a-z0-9_]{3,32}$/

export function CatalogPanel() {
  const source = useMmSource()
  const { data } = useQuery({
    queryKey: catalogKey,
    queryFn: ({ signal }) => source.adminCatalog(signal),
  })
  const save = useMmAdminMutation((maps: MmCatalogMap[]) =>
    source.saveCatalog(maps)
  )
  const [editing, setEditing] = useState<MmCatalogMap | "new" | null>(null)

  if (!data) return <Skeleton className="h-96 w-full rounded-xl" />

  const persist = (next: MmCatalogMap[], ok: string) =>
    save.mutate(next, {
      onSuccess: () => {
        setEditing(null)
        toast.success(ok)
      },
      onError: (e) => toast.error(errorMessage(e)),
    })

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <AlertDescription>
          Este catálogo también lo usan Mixes, PCW y torneos. Un mapa no se
          borra: se retira, porque las partidas viejas lo nombran.
        </AlertDescription>
      </Alert>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {data.filter((m) => m.active).length} disponibles · {data.length} en
          total
        </span>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon aria-hidden />
          Agregar mapa
        </Button>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((m) => (
          <MapCard key={m.name} map={m} onEdit={() => setEditing(m)} />
        ))}
      </ul>
      {editing && (
        <MapDialog
          map={editing === "new" ? null : editing}
          taken={data.map((m) => m.name)}
          pending={save.isPending}
          onClose={() => setEditing(null)}
          onSave={(m) =>
            editing === "new"
              ? persist(
                  [...data, m],
                  `${mapLabel(m.name, m.display_name)} agregado`
                )
              : persist(
                  data.map((x) => (x.name === m.name ? m : x)),
                  "Mapa guardado"
                )
          }
        />
      )}
    </div>
  )
}

function MapCard({ map, onEdit }: { map: MmCatalogMap; onEdit: () => void }) {
  const label = mapLabel(map.name, map.display_name)
  return (
    <li
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card",
        !map.active && "opacity-60"
      )}
    >
      {/* Vista previa como en la sala: el fondo grande y la imagen encima. */}
      <div className="relative aspect-video bg-muted">
        {(map.background_url ?? map.image_url) && (
          <img
            src={map.background_url ?? map.image_url!}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-2.5 left-2.5 flex items-end gap-2.5">
          <div className="grid aspect-[4/3] w-20 place-items-center overflow-hidden rounded-md border border-white/20 bg-black/40">
            {map.image_url ? (
              <img
                src={map.image_url}
                alt={`Imagen de ${label}`}
                className="size-full object-cover"
              />
            ) : (
              <ImageOffIcon
                aria-label="Sin imagen"
                className="size-4 text-white/60"
              />
            )}
          </div>
          <div className="flex flex-col text-white">
            <span className="font-semibold">{label}</span>
            <span className="font-mono text-xs text-white/70">
              {map.versions.join(", ")}
            </span>
          </div>
        </div>
        {!map.active && (
          <span className="absolute top-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
            Retirado
          </span>
        )}
        {!map.background_url && (
          <span className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white/80">
            Sin fondo: usa la imagen
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 p-3">
        <ArtButtons map={map} kind="image" />
        <ArtButtons map={map} kind="background" />
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          aria-label={`Editar ${label}`}
          onClick={onEdit}
        >
          <PencilIcon aria-hidden />
          Editar
        </Button>
      </div>
    </li>
  )
}

/** Subir o sacar la imagen o el fondo de un mapa. Valida tipo y peso antes de mandarlo. */
function ArtButtons({ map, kind }: { map: MmCatalogMap; kind: MapArt }) {
  const source = useMmSource()
  const input = useRef<HTMLInputElement>(null)
  const label = mapLabel(map.name, map.display_name)
  const what = kind === "image" ? "imagen" : "fondo"
  const has = kind === "image" ? !!map.image_url : !!map.background_url
  const rules = MAP_ART_RULES[kind]
  const upload = useMmAdminMutation((file: File) =>
    source.uploadMapArt(map.name, kind, file)
  )
  const remove = useMmAdminMutation(() => source.removeMapArt(map.name, kind))
  const busy = upload.isPending || remove.isPending

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (!MAP_ART_TYPES.includes(file.type))
      return toast.error("Tiene que ser JPEG, PNG o WebP")
    if (file.size > rules.maxMb * 1024 * 1024)
      return toast.error(
        `La ${what === "fondo" ? "imagen del fondo" : what} pesa más de ${rules.maxMb} MB`
      )
    upload.mutate(file, {
      onSuccess: () =>
        toast.success(
          what === "fondo"
            ? `Fondo de ${label} actualizado`
            : `Imagen de ${label} actualizada`
        ),
      onError: (e) => toast.error(errorMessage(e)),
    })
  }

  return (
    <span className="inline-flex items-center">
      <input
        ref={input}
        type="file"
        accept={MAP_ART_TYPES.join(",")}
        aria-label={`Archivo de ${what} de ${label}`}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        title={rules.hint}
        aria-label={`${has ? "Cambiar" : "Subir"} ${what} de ${label}`}
        onClick={() => input.current?.click()}
      >
        {kind === "image" ? (
          <ImageIcon aria-hidden />
        ) : (
          <UploadIcon aria-hidden />
        )}
        {has ? `Cambiar ${what}` : `Subir ${what}`}
      </Button>
      {has && (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={busy}
          aria-label={`Sacar ${what} de ${label}`}
          title={`Sacar ${what}`}
          onClick={() => remove.mutate()}
        >
          <ImageOffIcon aria-hidden />
        </Button>
      )}
    </span>
  )
}

function MapDialog({
  map,
  taken,
  pending,
  onClose,
  onSave,
}: {
  map: MmCatalogMap | null
  taken: string[]
  pending: boolean
  onClose: () => void
  onSave: (map: MmCatalogMap) => void
}) {
  const isNew = map === null
  const [name, setName] = useState(map?.name ?? "")
  const [display, setDisplay] = useState(map?.display_name ?? "")
  const [versions, setVersions] = useState(
    map?.versions.slice(1).join(", ") ?? ""
  )
  const [active, setActive] = useState(map?.active ?? true)

  const clean = name.trim().toLowerCase()
  const extra = versions
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
  const error = !NAME_RE.test(clean)
    ? "Minúsculas, números y _ (como en el servidor: de_dust2)"
    : isNew && taken.includes(clean)
      ? "Ese mapa ya está en el catálogo"
      : extra.some((v) => !NAME_RE.test(v))
        ? "Las versiones van como en el servidor, separadas por coma"
        : null

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {isNew
              ? "Agregar mapa"
              : `Editar ${mapLabel(map.name, map.display_name)}`}
          </DialogTitle>
          <DialogDescription>
            La imagen y el fondo se suben desde la tarjeta del mapa.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (error) return
            onSave({
              name: clean,
              display_name: display.trim() || null,
              versions: [clean, ...extra.filter((v) => v !== clean)],
              active,
              image_url: map?.image_url ?? null,
              background_url: map?.background_url ?? null,
            })
          }}
        >
          <Field label="Nombre en el servidor" id="map-name">
            <Input
              id="map-name"
              value={name}
              disabled={!isNew}
              placeholder="de_mirage"
              aria-invalid={!!error && name !== ""}
              onChange={(e) => setName(e.target.value)}
              className="font-mono"
            />
          </Field>
          <Field
            label="Nombre visible"
            id="map-display"
            hint={`Si queda vacío: ${mapLabel(clean || "de_mapa")}`}
          >
            <Input
              id="map-display"
              value={display}
              maxLength={24}
              placeholder={mapLabel(clean || "de_mapa")}
              onChange={(e) => setDisplay(e.target.value)}
            />
          </Field>
          <Field
            label="Otras versiones del servidor"
            id="map-versions"
            hint="Opcional, separadas por coma: de_inferno_classic"
          >
            <Input
              id="map-versions"
              value={versions}
              onChange={(e) => setVersions(e.target.value)}
              className="font-mono"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={active} onCheckedChange={setActive} />
            {active
              ? "Disponible"
              : "Retirado (sale del veto de todos los modos)"}
          </label>
          {error && name !== "" && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!!error || pending}>
              {isNew ? "Agregar" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string
  id: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}
