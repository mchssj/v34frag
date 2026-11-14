import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ImageOffIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { Button } from "@/components/ui/button"

/**
 * Quitar una imagen que subió otro (la foto de perfil de un jugador o el logo de un equipo), con motivo. Es del staff:
 * soporte, moderador y admin (replanteo 117). `remove` llama a la API; después se vuelven a pedir las consultas de
 * `invalidate`.
 */
export function RemoveImageButton({
  label,
  title,
  description,
  done,
  remove,
  invalidate,
}: {
  /** El texto del botón ("Quitar foto"). */
  label: string
  title: string
  description: string
  /** El aviso al terminar. */
  done: string
  remove: (reason: string) => Promise<unknown>
  invalidate: readonly (readonly unknown[])[]
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const m = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      setOpen(false)
      toast.success(done)
      for (const queryKey of invalidate) void qc.invalidateQueries({ queryKey })
    },
  })
  return (
    <>
      <Button
        variant="outline"
        className="h-8 gap-1.5 px-3 text-[13px]"
        onClick={() => {
          m.reset()
          setOpen(true)
        }}
      >
        <ImageOffIcon aria-hidden className="size-4" />
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={label}
        danger
        reason={{
          label: "Motivo",
          help: "Obligatorio (3 caracteres o más). Le llega en el aviso y queda registrado.",
          required: true,
        }}
        pending={m.isPending}
        error={m.error}
        onConfirm={(reason) => m.mutate(reason.trim())}
      />
    </>
  )
}
