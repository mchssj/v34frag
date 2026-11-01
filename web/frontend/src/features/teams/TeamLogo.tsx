import { ImageUpIcon, LockIcon, Trash2Icon } from "lucide-react"
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
import { AvatarCropDialog } from "@/features/profile/AvatarCropDialog"
import {
  checkAvatarSource,
  cropLogo,
  ImageError,
  type CropArea,
} from "@/lib/image"
import { useRemoveLogo, useUploadLogo, type TeamDetail } from "./queries"
import { TeamCrest } from "./ui"

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
 * Panel lateral "Editar equipo" del líder: el logo (se guarda apenas se recorta o se elimina) y el
 * nombre y la sigla, que solo cambia un admin.
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
          <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2.5">
            <label className="flex flex-col gap-1.5 text-[13px] leading-5 font-medium">
              Nombre
              <Input value={team.name} readOnly disabled className="h-10" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] leading-5 font-medium">
              Sigla
              <Input
                value={team.tag ?? ""}
                readOnly
                disabled
                className="h-10 font-mono"
              />
            </label>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LockIcon className="size-3.5 shrink-0" aria-hidden />
            El nombre y la sigla los cambia un admin: pídeselo si hace falta.
          </p>
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
