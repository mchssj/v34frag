import { createFileRoute, notFound } from "@tanstack/react-router"
import { cn } from "cn"
import { useState } from "react"
import { toast } from "sonner"

import { Segmented } from "@/components/brand/Segmented"
import { Button } from "@/components/ui/button"
import { useWidgetDemo } from "@/features/widget/demo"
import {
  DEFAULT_OPTIONS,
  DESIGN_LABEL,
  WIDGET_SIZE,
  widgetUrl,
  type WidgetDesign,
  type WidgetOptions,
} from "@/features/widget/options"
import { StreamWidget } from "@/features/widget/StreamWidget"
import {
  opts,
  STREAM_BG,
  WidgetControls,
  WidgetPreview,
} from "@/features/widget/WidgetCustomizer"

// Ejemplo del widget para streamers sin API ni sesión (prototipo de Kyan, 2026-11-08-widget-streamers-stats,
// traído a main en 2026-11-10-widget-streamers-en-main). Solo en `pnpm dev`: en el build de producción la
// ruta no existe. El personalizador es el mismo de Cuenta › Widget para stream.
export const Route = createFileRoute("/demo/widget")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoWidget,
})

const BACKGROUNDS = { stream: "Stream", transparent: "Transparente" } as const
type Bg = keyof typeof BACKGROUNDS

// Fondo "de juego" para ver el widget como en el stream, o damero para ver la transparencia.
const BG_CLASS: Record<Bg, string> = {
  stream: STREAM_BG,
  transparent:
    "bg-[conic-gradient(#8884_25%,transparent_0_50%,#8884_0_75%,transparent_0)] bg-[length:20px_20px]",
}

function DemoWidget() {
  const demo = useWidgetDemo()
  const [bg, setBg] = useState<Bg>("stream")
  const [o, setO] = useState<WidgetOptions>({
    ...DEFAULT_OPTIONS,
    design: "stats",
  })
  const set = (p: Partial<WidgetOptions>) => setO((x) => ({ ...x, ...p }))
  const data = demo.dataFor(o.period)

  const play = (r: "V" | "D" | "E", text: string) => {
    const d = demo.playMix(r)
    toast.success(`${text}: ${d > 0 ? "+" : ""}${d} ELO.`)
  }
  const url = widgetUrl(
    location.origin,
    "00000000-0000-0000-0000-000000000000",
    o
  )

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
        <span className="mr-2 font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
          Demo
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => play("V", "Mix ganado")}
        >
          Ganar un mix
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => play("D", "Mix perdido")}
        >
          Perder un mix
        </Button>
        <Button size="sm" variant="outline" onClick={() => play("E", "Empate")}>
          Empatar
        </Button>
        <Button size="sm" variant="outline" onClick={demo.newDay}>
          Nuevo día
        </Button>
        <Button size="sm" variant="outline" onClick={() => demo.setElo(2050)}>
          Nivel 10
        </Button>
        <Button size="sm" variant="outline" onClick={() => demo.setRank(1)}>
          Primero del ranking
        </Button>
        <Button size="sm" variant="ghost" onClick={demo.reset}>
          Reiniciar
        </Button>
        <span className="ml-auto">
          <Segmented
            label="Fondo"
            size="sm"
            value={bg}
            options={opts(BACKGROUNDS)}
            onChange={setBg}
          />
        </span>
      </div>

      <section className="flex flex-col gap-3">
        <h1 className="font-heading text-xl font-semibold">
          Widget para stream
        </h1>
        <p className="text-sm text-muted-foreground">
          Los seis diseños con lo que elegiste abajo. El recuadro punteado es el
          tamaño recomendado para la fuente de navegador de OBS.
        </p>
        <div
          className={cn(
            "flex flex-wrap items-start gap-8 rounded-xl p-6",
            BG_CLASS[bg]
          )}
        >
          {(Object.keys(DESIGN_LABEL) as WidgetDesign[]).map((d) => {
            const [dw, dh] = WIDGET_SIZE[d]
            return (
              <figure key={d} className="flex flex-col gap-1.5">
                <figcaption className="text-xs font-semibold text-white drop-shadow">
                  {DESIGN_LABEL[d]} · {Math.round((dw * o.scale) / 100)} ×{" "}
                  {Math.round((dh * o.scale) / 100)}
                </figcaption>
                <button
                  type="button"
                  aria-label={`Elegir el diseño ${DESIGN_LABEL[d]}`}
                  onClick={() => set({ design: d })}
                  className={cn(
                    "rounded-md border border-dashed border-white/40 p-[5px] text-left",
                    o.design === d && "border-solid border-white"
                  )}
                  style={{
                    width: (dw * o.scale) / 100 + 12,
                    minHeight: (dh * o.scale) / 100 + 12,
                  }}
                >
                  <StreamWidget data={data} options={{ ...o, design: d }} />
                </button>
              </figure>
            )
          })}
        </div>
      </section>

      <section className="grid gap-6 rounded-xl border p-4 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="font-heading text-base font-semibold">
              Personaliza tu widget
            </h2>
            <p className="text-sm text-muted-foreground">
              Lo mismo que ve el jugador en Cuenta › Widget para stream. Todo
              queda guardado en la URL.
            </p>
          </div>
          <WidgetControls value={o} onChange={setO} data={data} />
        </div>

        <WidgetPreview
          value={o}
          data={data}
          url={url}
          bgClassName={BG_CLASS[bg]}
        />
      </section>
    </div>
  )
}
