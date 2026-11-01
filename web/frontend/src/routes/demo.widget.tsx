import { createFileRoute, notFound } from "@tanstack/react-router"
import { cn } from "cn"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWidgetDemo } from "@/features/widget/demo"
import {
  StreamWidget,
  WIDGET_SIZE,
  type WidgetDesign,
  type WidgetPeriod,
} from "@/features/widget/StreamWidget"

// Ejemplo del widget para streamers sin API ni sesión (docs/bitacora/2026-10-29-widget-streamers en
// kyan/pruebas). Solo en `pnpm dev`: en el build de producción la ruta no existe.
export const Route = createFileRoute("/demo/widget")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoWidget,
})

const DESIGNS: Record<WidgetDesign, string> = {
  mini: "Mini",
  compacto: "Compacto",
  completo: "Completo",
}
const PERIODS: Record<WidgetPeriod, string> = { hoy: "Hoy", "24h": "24 h" }
const BACKGROUNDS = { stream: "Stream", transparent: "Transparente" } as const

// Fondo "de juego" para ver el widget como en el stream, o damero para ver la transparencia.
const BG_CLASS: Record<keyof typeof BACKGROUNDS, string> = {
  stream: "bg-[linear-gradient(135deg,#1f2b38,#3c5a49_45%,#6b4a33)]",
  transparent:
    "bg-[conic-gradient(#8884_25%,transparent_0_50%,#8884_0_75%,transparent_0)] bg-[length:20px_20px]",
}

function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: Record<K, string>
  value: K
  onChange: (v: K) => void
}) {
  return (
    <span className="inline-flex rounded-lg border p-0.5">
      {(Object.keys(options) as K[]).map((k) => (
        <Button
          key={k}
          size="sm"
          variant={value === k ? "secondary" : "ghost"}
          aria-pressed={value === k}
          onClick={() => onChange(k)}
        >
          {options[k]}
        </Button>
      ))}
    </span>
  )
}

function DemoWidget() {
  const demo = useWidgetDemo()
  const [period, setPeriod] = useState<WidgetPeriod>("hoy")
  const [bg, setBg] = useState<keyof typeof BACKGROUNDS>("stream")
  const [design, setDesign] = useState<WidgetDesign>("compacto")

  const play = (r: "V" | "D" | "E", text: string) => {
    const d = demo.playMix(r)
    toast.success(`${text}: ${d > 0 ? "+" : ""}${d} ELO.`)
  }
  const url = `${location.origin}/widget?id=00000000-0000-0000-0000-000000000000&d=${design}${
    period === "24h" ? "&v=24h" : ""
  }`

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
        <span className="mr-2 font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
          Demo
        </span>
        <Button size="sm" variant="outline" onClick={() => play("V", "Mix ganado")}>
          Ganar un mix
        </Button>
        <Button size="sm" variant="outline" onClick={() => play("D", "Mix perdido")}>
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
        <Button size="sm" variant="ghost" onClick={demo.reset}>
          Reiniciar
        </Button>
        <span className="ml-auto flex flex-wrap gap-2">
          <Segmented options={PERIODS} value={period} onChange={setPeriod} />
          <Segmented options={BACKGROUNDS} value={bg} onChange={setBg} />
        </span>
      </div>

      <section className="flex flex-col gap-3">
        <h1 className="font-heading text-xl font-semibold">Widget para stream</h1>
        <p className="text-sm text-muted-foreground">
          Así se ve en OBS cada diseño. El recuadro punteado es el tamaño recomendado para la fuente
          de navegador.
        </p>
        <div className={cn("flex flex-wrap items-start gap-8 rounded-xl p-6", BG_CLASS[bg])}>
          {(Object.keys(DESIGNS) as WidgetDesign[]).map((d) => {
            const [w, h] = WIDGET_SIZE[d]
            return (
              <figure key={d} className="flex flex-col gap-1.5">
                <figcaption className="text-xs font-semibold text-white drop-shadow">
                  {DESIGNS[d]} · {w} × {h}
                </figcaption>
                <div
                  className="rounded-md border border-dashed border-white/40 p-[5px]"
                  style={{ width: w, height: h }}
                >
                  <StreamWidget data={demo.data} design={d} period={period} />
                </div>
              </figure>
            )
          })}
        </div>
      </section>

      <section className="flex max-w-xl flex-col gap-3 rounded-xl border p-4">
        <h2 className="font-heading text-base font-semibold">Generador del perfil</h2>
        <p className="text-sm text-muted-foreground">
          Lo que ve el jugador al tocar "Widget para stream" en su perfil.
        </p>
        <span className="flex flex-wrap gap-2">
          <Segmented options={DESIGNS} value={design} onChange={setDesign} />
          <Segmented options={PERIODS} value={period} onChange={setPeriod} />
        </span>
        <div className={cn("rounded-lg p-4", BG_CLASS.stream)}>
          <StreamWidget data={demo.data} design={design} period={period} />
        </div>
        <div className="flex gap-2">
          <Input readOnly value={url} aria-label="URL del widget" onFocus={(e) => e.target.select()} />
          <Button
            onClick={() =>
              navigator.clipboard.writeText(url).then(
                () => toast.success("URL copiada."),
                () => toast.error("Copiala con Ctrl+C.")
              )
            }
          >
            Copiar URL
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          En OBS: Fuentes → + → <strong className="text-foreground">Navegador</strong> → pegá la URL
          con tamaño {WIDGET_SIZE[design][0]} × {WIDGET_SIZE[design][1]}. Se actualiza solo cada
          minuto.
        </p>
      </section>
    </div>
  )
}
