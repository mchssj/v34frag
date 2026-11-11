import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { MonitorPlayIcon } from "lucide-react"
import { useState } from "react"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { CardTitle, SectionCard } from "@/features/profile/components/ui"
import { widgetDataOptions } from "./api"
import { DEFAULT_OPTIONS, widgetUrl, type WidgetOptions } from "./options"
import { WidgetControls, WidgetPreview } from "./WidgetCustomizer"

// Widget para stream en Cuenta (bitácora 2026-11-10-widget-streamers-en-main): para cualquiera con ficha,
// al lado del HUD de los streamers. Lo que se elige queda solo en la URL; no se guarda nada.

/** El diálogo con el personalizador y la vista previa con los datos reales de la ficha. */
function WidgetDialog({
  playerId,
  open,
  onOpenChange,
}: {
  playerId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [o, setO] = useState<WidgetOptions>(DEFAULT_OPTIONS)
  const data = useQuery(widgetDataOptions(playerId, o.period, open))
  const url = widgetUrl(location.origin, playerId, o)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-32px)] gap-5 overflow-y-auto sm:max-w-[960px]">
        <DialogHeader>
          <DialogTitle>Widget para stream</DialogTitle>
          <DialogDescription>
            Elige cómo se ve y copia la URL en una fuente de navegador de OBS.
            Todo queda guardado en la URL: si cambias algo, vuelve a copiarla.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <WidgetControls value={o} onChange={setO} data={data.data} />
          <div className="lg:sticky lg:top-0 lg:self-start">
            <WidgetPreview
              value={o}
              data={data.data}
              url={url}
              empty={
                data.isError ? (
                  <span className="dark rounded-lg bg-black/70 px-3 py-2 text-[13px] text-foreground">
                    {errorMessage(data.error)}
                  </span>
                ) : (
                  <Spinner className="size-6 text-white/70" />
                )
              }
            />
          </div>
        </div>
      </DialogContent>
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
