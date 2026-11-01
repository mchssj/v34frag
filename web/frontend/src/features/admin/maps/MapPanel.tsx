import { ImageIcon, UploadIcon, XIcon } from "lucide-react"
import { useId, useRef, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "../dialogs"
import { Chip, PanelSection } from "../ui"
import {
  imageError,
  inDefaultPool,
  inMixes,
  MAP_IMAGE_TYPES,
  setActive,
  versionError,
  type DraftMap,
} from "./catalog"
import { useDeleteMapImage, useUploadMapImage } from "./queries"

/** Detalle de un mapa: foto (se guarda al momento), versiones y retirar (van al borrador). */
export function MapPanel({
  map,
  draft,
  image,
  saved,
  onChange,
  onClose,
}: {
  map: DraftMap
  draft: DraftMap[]
  image: string | null
  /** Ya existe en la API (un mapa nuevo sin guardar todavía no puede tener foto). */
  saved: boolean
  onChange: (m: DraftMap) => void
  onClose: () => void
}) {
  const id = useId()
  const file = useRef<HTMLInputElement>(null)
  const upload = useUploadMapImage()
  const remove = useDeleteMapImage()
  const [fileErr, setFileErr] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [version, setVersion] = useState("")
  const v = version.trim().toLowerCase()
  const vErr = v ? versionError(draft, map, v) : null

  const where = !map.active
    ? "Retirado: no sale en Mixes ni en pools nuevos."
    : inMixes(map) || inDefaultPool(map)
      ? `Sale en ${[inMixes(map) && "Mixes", inDefaultPool(map) && "el pool por defecto"].filter(Boolean).join(" y ")}.`
      : "Disponible solo para los torneos y PCW que lo elijan."

  function pick(f: File | undefined) {
    if (!f) return
    const err = imageError(f)
    setFileErr(err)
    if (err) return
    upload.mutate(
      { name: map.name, file: f },
      { onSuccess: () => toast.success(`Foto de ${map.name} guardada.`) }
    )
  }

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="flex flex-wrap items-center gap-2 font-mono text-lg font-semibold">
            {map.name}
            <Chip tone={map.active ? "win" : "neutral"}>
              {map.active ? "Disponible" : "Retirado"}
            </Chip>
          </h2>
          <span className="text-[13px] text-muted-foreground">{where}</span>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Cerrar detalle"
          onClick={onClose}
        >
          <XIcon aria-hidden />
        </Button>
      </div>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Foto</h3>
          <span className="text-xs text-muted-foreground">
            Se guarda al subirla
          </span>
        </div>
        <div className="relative grid aspect-video place-items-center overflow-hidden rounded-xl border bg-muted">
          {image ? (
            <>
              <img
                src={image}
                alt={`Foto de ${map.name}`}
                className="absolute inset-0 size-full object-cover"
              />
              <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-lg bg-black/55 px-3.5 py-2.5 text-white">
                <span className="flex flex-col gap-0.5">
                  <span className="text-[11px] opacity-75">
                    Así se ve en la sala
                  </span>
                  <span className="font-mono text-xs">{map.name}</span>
                </span>
                <span className="font-mono text-xl font-bold">
                  13 <span className="opacity-55">:</span> 9
                </span>
              </div>
            </>
          ) : (
            <span className="flex flex-col items-center gap-1.5 px-4 text-center text-[13px] text-muted-foreground">
              <ImageIcon aria-hidden className="size-7" />
              Sin foto: la sala del mix usa un fondo liso
            </span>
          )}
        </div>
        <input
          ref={file}
          type="file"
          accept={MAP_IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0])
            e.target.value = ""
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={!saved || upload.isPending}
            onClick={() => file.current?.click()}
          >
            <UploadIcon aria-hidden />
            {upload.isPending
              ? "Subiendo…"
              : image
                ? "Cambiar foto"
                : "Subir foto"}
          </Button>
          {image && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setRemoving(true)}
            >
              Quitar foto
            </Button>
          )}
        </div>
        {(fileErr || upload.isError) && (
          <p role="alert" className="text-[13px] text-destructive">
            {fileErr ?? errorMessage(upload.error)}
          </p>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          {saved
            ? "JPG, PNG o WebP de hasta 2 MB. Una captura horizontal sin HUD, idealmente de 1920×1080. Vale para todas sus versiones."
            : "Guarda el catálogo para poder subir la foto de este mapa."}
        </p>
      </section>

      <PanelSection title="Versiones del servidor">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Los .bsp que cuentan como este mapa: un mix en cualquiera de ellos usa
          esta foto. La primera es el nombre y no se quita.
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {map.versions.map((ver, i) => (
            <li
              key={ver}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border pr-1 pl-3 text-[13px]"
            >
              <span className="font-mono">{ver}</span>
              {i === 0 ? (
                <span className="pr-2 text-[11px] text-muted-foreground">
                  nombre
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="rounded-full bg-muted"
                  aria-label={`Quitar ${ver}`}
                  onClick={() =>
                    onChange({
                      ...map,
                      versions: map.versions.filter((x) => x !== ver),
                    })
                  }
                >
                  <XIcon aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!v || vErr) return
            onChange({ ...map, versions: [...map.versions, v] })
            setVersion("")
          }}
        >
          <Input
            id={`${id}-v`}
            aria-label="Versión nueva"
            value={version}
            placeholder="de_inferno_classic"
            className="font-mono"
            onChange={(e) => setVersion(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={!v || !!vErr}>
            Agregar
          </Button>
        </form>
        {vErr && <p className="text-xs text-destructive">{vErr}</p>}
      </PanelSection>

      <PanelSection title={map.active ? "Retirar" : "Retirado"}>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="min-w-[200px] flex-1 text-[13px] leading-relaxed text-muted-foreground">
            {map.active
              ? "Retirarlo lo saca de Mixes y del pool por defecto. Los torneos que ya lo tienen en su pool lo conservan."
              : "Volver a ponerlo disponible. Después decides si sale en Mixes o en el pool por defecto."}
          </span>
          <Button
            variant="outline"
            className={
              map.active
                ? "border-destructive/50 text-destructive hover:text-destructive"
                : undefined
            }
            onClick={() => onChange(setActive(map, !map.active))}
          >
            {map.active ? "Retirar mapa" : "Volver a ponerlo disponible"}
          </Button>
        </div>
      </PanelSection>

      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={`¿Quitar la foto de ${map.name}?`}
        description="La sala del mix vuelve a usar un fondo liso. Para tenerla de nuevo hay que subirla otra vez."
        confirmLabel="Quitar foto"
        danger
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          remove.mutate(map.name, {
            onSuccess: () => {
              setRemoving(false)
              toast.success("Foto quitada.")
            },
          })
        }
      />
    </>
  )
}
