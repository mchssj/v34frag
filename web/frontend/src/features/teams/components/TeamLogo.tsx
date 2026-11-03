import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { ClockIcon, ImageUpIcon, Trash2Icon } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { AvatarCropDialog } from "@/features/profile/components/AvatarCropDialog"
import {
  checkAvatarSource,
  cropLogo,
  ImageError,
  type CropArea,
} from "@/lib/image"
import { useRemoveLogo, useRenameTeam, useUploadLogo } from "../api/queries"
import type { TeamDetail } from "../types"
import { TeamCrest } from "@/components/brand/TeamCrest"

/**
 * Elegir una imagen y encuadrarla en cuadrado (mismo recorte que la foto de perfil). Devuelve el
 * logo a 512×512 por `onCropped`; lo usan Crear equipo y el líder en Mi equipo.
 */
export function useLogoPicker(
  onCropped: (blob: Blob) => Promise<void> | void,
  busy: boolean
) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ file: File; src: string } | null>(
    null
  )

  // Libera la URL de la vista previa al cambiar de imagen o al desmontar.
  useEffect(() => {
    if (!pending) return
    return () => URL.revokeObjectURL(pending.src)
  }, [pending])

  function pick(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      checkAvatarSource(file)
      setPending({ file, src: URL.createObjectURL(file) })
    } catch (e) {
      setError(e instanceof ImageError ? e.message : errorMessage(e))
    }
  }

  async function confirm(area: CropArea) {
    if (!pending) return
    try {
      await onCropped(await cropLogo(pending.file, area))
    } catch (e) {
      setError(e instanceof ImageError ? e.message : errorMessage(e))
    }
    setPending(null)
  }

  const elements: ReactNode = (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      {pending && (
        <AvatarCropDialog
          key={pending.src}
          src={pending.src}
          busy={busy}
          shape="rect"
          title="Encuadra el logo"
          confirmLabel="Usar logo"
          onCancel={() => setPending(null)}
          onConfirm={(area) => void confirm(area)}
        />
      )}
    </>
  )

  return { open: () => input.current?.click(), elements, error }
}

/** Escudo de la cabecera del líder: al pasar el mouse dice "Modificar logo" y abre "Editar equipo". */
export function EditableCrest({
  team,
  onEdit,
}: {
  team: TeamDetail
  onEdit: () => void
}) {
  return (
    <button
      type="button"
      aria-label="Editar equipo"
      onClick={onEdit}
      className="group/crest relative rounded-[18px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <TeamCrest team={team} size="lg" />
      <span
        aria-hidden
        className="absolute inset-0 grid place-items-center rounded-[14px] bg-black/58 px-1 text-center text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover/crest:opacity-100 group-focus-visible/crest:opacity-100 sm:rounded-[18px] sm:text-xs"
      >
        Modificar logo
      </span>
    </button>
  )
}

/**
 * Panel lateral "Editar equipo" del líder: el logo (se guarda apenas se recorta o se elimina, cuando
 * quiera) y el nombre y la sigla, una vez cada `team_config.rename_days` días (el admin, sin espera;
 * plan docs/bitacora/2026-11-03-reportes-clips-nombre-equipo).
 */
export function EditTeamSheet({
  team,
  open,
  onOpenChange,
}: {
  team: TeamDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const upload = useUploadLogo()
  const remove = useRemoveLogo()
  const busy = upload.isPending || remove.isPending
  const picker = useLogoPicker(async (blob) => {
    await upload.mutateAsync({ teamId: team.id, blob })
    toast.success("Logo actualizado")
  }, upload.isPending)

  async function clear() {
    try {
      await remove.mutateAsync(team.id)
      toast.success("Logo eliminado: el escudo vuelve a la sigla")
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[420px]">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>Editar equipo</SheetTitle>
          <SheetDescription>
            Los cambios se ven al instante en tu equipo y en Buscar equipo.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
          <div className="flex flex-col gap-2">
            {/* leading-5: con un alto de línea fraccionario los botones caen en medio píxel y el
                ícono se ve más bajo que el texto. */}
            <span className="text-[13px] leading-5 font-medium">Logo</span>
            <div className="flex items-center gap-3.5">
              <TeamCrest
                team={team}
                size="md"
                className="size-[72px] text-base"
              />
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={picker.open}
                  >
                    {upload.isPending ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <ImageUpIcon aria-hidden />
                    )}
                    Cambiar
                  </Button>
                  {team.logo_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      className="text-destructive hover:text-destructive"
                      onClick={() => void clear()}
                    >
                      <Trash2Icon aria-hidden />
                      Eliminar
                    </Button>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  PNG, JPG o WebP. Lo encuadras en cuadrado antes de guardarlo.
                </span>
              </div>
            </div>
            {picker.error && (
              <span role="alert" className="text-xs text-destructive">
                {picker.error}
              </span>
            )}
          </div>
          {/* La key reinicia el formulario al abrir o si el equipo cambió por fuera. */}
          <RenameFields
            key={`${open}-${team.name}-${team.tag ?? ""}`}
            team={team}
          />
        </div>
        <SheetFooter className="flex-row justify-end border-t px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </SheetFooter>
        {picker.elements}
      </SheetContent>
    </Sheet>
  )
}

/** Nombre y sigla del equipo: una vez cada `team_config.rename_days` días (el admin, sin espera). */
function RenameFields({ team }: { team: TeamDetail }) {
  const rename = useRenameTeam()
  const [name, setName] = useState(team.name)
  const [tag, setTag] = useState(team.tag ?? "")
  const admin = !!team.viewer?.is_admin
  const next = admin ? null : team.next_name_change_at
  // La API manda la fecha solo mientras falta para el próximo cambio.
  const locked = !!next
  const trimmed = { name: name.trim(), tag: tag.trim() }
  const changed = trimmed.name !== team.name || trimmed.tag !== (team.tag ?? "")
  const nameOk =
    trimmed.name.length >= 2 &&
    trimmed.name.length <= 40 &&
    trimmed.tag.length >= 1 &&
    trimmed.tag.length <= 6

  async function saveName() {
    try {
      await rename.mutateAsync({ teamId: team.id, ...trimmed })
      toast.success("Nombre actualizado")
    } catch {
      // Se muestra debajo de los campos.
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2.5">
        <label className="flex flex-col gap-1.5 text-[13px] leading-5 font-medium">
          Nombre
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            disabled={locked || rename.isPending}
            className="h-10"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] leading-5 font-medium">
          Sigla
          <Input
            value={tag}
            onChange={(e) =>
              setTag(e.target.value.toUpperCase().replace(/\s/g, ""))
            }
            maxLength={6}
            disabled={locked || rename.isPending}
            className="h-10 font-mono"
          />
        </label>
      </div>
      {locked ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ClockIcon className="size-3.5 shrink-0" aria-hidden />
          Podrás cambiar el nombre y la sigla el{" "}
          {format(parseISO(next!), "d 'de' MMMM", { locale: es })}.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {admin
              ? "Como admin, sin espera entre cambios."
              : "Después de cambiarlos, hay que esperar unos días para el próximo cambio."}
          </span>
          <Button
            size="sm"
            disabled={!changed || !nameOk || rename.isPending}
            onClick={() => void saveName()}
          >
            {rename.isPending ? "Guardando…" : "Guardar nombre"}
          </Button>
        </div>
      )}
      {rename.error != null && (
        <span role="alert" className="text-xs text-destructive">
          {errorMessage(rename.error)}
        </span>
      )}
    </div>
  )
}
