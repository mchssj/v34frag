import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { MonitorPlayIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { CardTitle, SectionCard } from "@/features/profile/components/ui"
import {
  saveWidget,
  widgetDataOptions,
  widgetKeys,
  type WidgetResponse,
} from "./api"
import {
  optionsQuery,
  parseOptions,
  savedWidgetUrl,
  type WidgetOptions,
} from "./options"
import { WidgetControls, WidgetPreview } from "./WidgetCustomizer"

// Widget para stream en Cuenta (bitácora 2026-11-10-widget-streamers-en-main): para cualquiera con ficha,
// al lado del HUD de los streamers. Desde 2026-11-11-widget-guardar lo que se elige se guarda en la cuenta y la
// URL de OBS queda fija (solo la ficha).

/** El diálogo con el personalizador, la vista previa con los datos reales y el botón Guardar. */
function WidgetDialog({
  playerId,
  open,
  onOpenChange,
}: {
  playerId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  // null: sin cambios, se muestra lo guardado. Al tocar algo, la copia que se está editando.
  const [edit, setEdit] = useState<WidgetOptions | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [period, setPeriod] = useState<WidgetOptions["period"] | null>(null)
  const data = useQuery(
    widgetDataOptions(playerId, edit?.period ?? period, open)
  )
  const saved = data.data ? parseOptions(data.data.settings ?? "") : null
  const o = edit ?? saved
  const dirty =
    edit !== null &&
    saved !== null &&
    optionsQuery(edit) !== optionsQuery(saved)
  const url = savedWidgetUrl(location.origin, playerId)

  const save = useMutation({
    mutationFn: (o: WidgetOptions) => saveWidget(optionsQuery(o)),
    onSuccess: (r, o) => {
      // Todas las consultas del widget de esta ficha pasan a tener lo guardado.
      queryClient.setQueriesData<WidgetResponse>(
        { queryKey: widgetKeys.all(playerId) },
        (old) => old && { ...old, settings: r.query }
      )
      setPeriod(o.period)
      setEdit(null)
      toast.success("Guardado. Tu widget en OBS cambia solo en un minuto.")
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const close = () => {
    setEdit(null)
    setPeriod(null)
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) onOpenChange(true)
        else if (dirty) setConfirmClose(true)
        else close()
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-32px)] gap-5 overflow-y-auto sm:max-w-[960px]">
        <DialogHeader>
          <DialogTitle>Widget para stream</DialogTitle>
          <DialogDescription>
            Elige cómo se ve y toca Guardar. La URL no cambia: pégala una vez en
            una fuente de navegador de OBS y, cada vez que guardes, tu widget se
            actualiza solo.
          </DialogDescription>
        </DialogHeader>
        {o ? (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <WidgetControls value={o} onChange={setEdit} data={data.data} />
            <div className="flex flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
              <WidgetPreview
                value={o}
                data={data.data}
                url={url}
                hint="Pégala una sola vez: cuando guardes, se actualiza sola en un minuto."
                empty={<Spinner className="size-6 text-white/70" />}
              />
              <p className="text-xs text-muted-foreground">
                Si en OBS tienes una URL más larga (de antes), reemplázala una
                vez por esta: la larga sigue mostrando lo que tenía.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid min-h-[200px] place-items-center">
            {data.isError ? (
              <span className="text-sm text-destructive">
                {errorMessage(data.error)}
              </span>
            ) : (
              <Spinner className="size-6" />
            )}
          </div>
        )}
        <DialogFooter className="items-center gap-3 sm:justify-end">
          {dirty && (
            <span className="text-sm text-muted-foreground">
              Cambios sin guardar
            </span>
          )}
          <Button
            disabled={!dirty || save.isPending}
            onClick={() => edit && save.mutate(edit)}
          >
            {save.isPending && <Spinner />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="¿Cerrar sin guardar?"
        description="Se pierden los cambios. Tu widget en OBS sigue como estaba."
        confirmLabel="Cerrar sin guardar"
        pending={false}
        error={null}
        onConfirm={() => {
          setConfirmClose(false)
          close()
        }}
      />
    </Dialog>
  )
}

export function WidgetCard({ playerId }: { playerId: string | null }) {
  const [open, setOpen] = useState(false)
  return (
    <SectionCard>
      <div className="flex flex-wrap items-center gap-3.5 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted">
          <MonitorPlayIcon className="size-[18px]" aria-hidden />
        </span>
        <CardTitle
          className="min-w-[180px] flex-1"
          title="Widget para stream"
          description={
            playerId ? (
              "Muestra en OBS tu nivel, tu ELO y cómo te va en los mixes del día. Se actualiza solo cada minuto."
            ) : (
              <>
                Para usarlo necesitas tu ficha de jugador:{" "}
                <Link to="/profile/link" className="underline">
                  vincúlala con !claim
                </Link>
                .
              </>
            )
          }
        />
        <Button
          className="text-[13px]"
          disabled={!playerId}
          onClick={() => setOpen(true)}
        >
          Armar mi widget
        </Button>
      </div>
      {playerId && (
        <WidgetDialog playerId={playerId} open={open} onOpenChange={setOpen} />
      )}
    </SectionCard>
  )
}
