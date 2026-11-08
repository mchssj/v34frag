import { createFileRoute, notFound } from "@tanstack/react-router"
import { cn } from "cn"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import { Segmented } from "@/components/brand/Segmented"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useWidgetDemo } from "@/features/widget/demo"
import {
  ACCENTS,
  DEFAULT_OPTIONS,
  DESIGN_LABEL,
  MAX_CHIPS,
  MAX_PHRASE,
  MAX_TOP,
  PART_LABEL,
  PERIOD_LABEL,
  STAT_LABEL,
  WIDGET_SIZE,
  widgetUrl,
  type Part,
  type StatKey,
  type WidgetDesign,
  type WidgetOptions,
  type WidgetPeriod,
} from "@/features/widget/options"
import { autoPhrase, StreamWidget } from "@/features/widget/StreamWidget"

// Ejemplo del widget para streamers sin API ni sesión (docs/bitacora/2026-10-29-widget-streamers y
// 2026-11-08-widget-streamers-stats en kyan/pruebas). Solo en `pnpm dev`: en el build de producción la ruta
// no existe.
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
  stream: "bg-[linear-gradient(135deg,#1f2b38,#3c5a49_45%,#6b4a33)]",
  transparent:
    "bg-[conic-gradient(#8884_25%,transparent_0_50%,#8884_0_75%,transparent_0)] bg-[length:20px_20px]",
}

const opts = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }))

// Qué diseños usan cada grupo de stats y cada parte, para no mostrar controles que no cambian nada.
const USES_TOP: WidgetDesign[] = ["stats", "barra", "vertical"]
const USES_CHIPS: WidgetDesign[] = ["stats", "vertical"]

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold tracking-[0.4px] text-muted-foreground uppercase">
          {label}
        </span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </div>
  )
}

/** Elegir stats: se marcan en orden y el número dice en qué lugar salen. */
function StatPicker({
  value,
  max,
  onChange,
}: {
  value: StatKey[]
  max: number
  onChange: (v: StatKey[]) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(STAT_LABEL) as StatKey[]).map((k) => {
        const i = value.indexOf(k)
        const on = i >= 0
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            onClick={() => {
              if (on) onChange(value.filter((x) => x !== k))
              else if (value.length >= max)
                toast.error(`Hasta ${max}. Sacá una para sumar otra.`)
              else onChange([...value, k])
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground",
              on && "border-primary bg-primary/10 text-foreground"
            )}
          >
            {on && (
              <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {i + 1}
              </span>
            )}
            {STAT_LABEL[k]}
          </button>
        )
      })}
    </div>
  )
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
  const [w, h] = WIDGET_SIZE[o.design]
  const togglePart = (p: Part, on: boolean) =>
    set({ hidden: on ? o.hidden.filter((x) => x !== p) : [...o.hidden, p] })

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
              Personalizá tu widget
            </h2>
            <p className="text-sm text-muted-foreground">
              Lo que ve el jugador al tocar "Widget para stream" en su perfil.
              Todo queda guardado en la URL.
            </p>
          </div>
          <Field label="Diseño">
            <Segmented
              label="Diseño"
              size="sm"
              value={o.design}
              options={opts(DESIGN_LABEL)}
              onChange={(d) => set({ design: d })}
            />
          </Field>
          <Field label="Período">
            <Segmented
              label="Período"
              size="sm"
              value={o.period}
              options={opts(PERIOD_LABEL)}
              onChange={(p: WidgetPeriod) => set({ period: p })}
            />
          </Field>
          {USES_TOP.includes(o.design) && (
            <Field label="Stats grandes" hint={`${o.top.length} de ${MAX_TOP}`}>
              <StatPicker
                value={o.top}
                max={MAX_TOP}
                onChange={(top) => set({ top })}
              />
            </Field>
          )}
          {USES_CHIPS.includes(o.design) && (
            <Field
              label={o.design === "vertical" ? "Más stats" : "Stats chicas"}
              hint={`${o.chips.length} de ${MAX_CHIPS}`}
            >
              <StatPicker
                value={o.chips}
                max={MAX_CHIPS}
                onChange={(chips) => set({ chips })}
              />
            </Field>
          )}
          <Field label="Color">
            <div className="flex flex-wrap items-center gap-1.5">
              {ACCENTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-label={`Color #${a}`}
                  aria-pressed={o.accent === a}
                  onClick={() => set({ accent: a })}
                  className={cn(
                    "size-7 rounded-full border-2 border-transparent",
                    o.accent === a && "border-foreground"
                  )}
                  style={{ backgroundColor: `#${a}` }}
                />
              ))}
              <label className="ml-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                Otro
                <input
                  type="color"
                  value={`#${o.accent}`}
                  onChange={(e) =>
                    set({ accent: e.target.value.slice(1).toLowerCase() })
                  }
                  className="size-7 cursor-pointer rounded border bg-transparent"
                />
              </label>
            </div>
          </Field>
          <Field label="Fondo" hint={`${o.opacity} %`}>
            <Slider
              aria-label="Opacidad del fondo"
              min={0}
              max={100}
              step={5}
              value={[o.opacity]}
              onValueChange={([v]) => set({ opacity: v! })}
            />
          </Field>
          <Field label="Tamaño" hint={`${o.scale} %`}>
            <Slider
              aria-label="Tamaño"
              min={75}
              max={150}
              step={5}
              value={[o.scale]}
              onValueChange={([v]) => set({ scale: v! })}
            />
          </Field>
          <Field label="Qué se muestra">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PART_LABEL) as Part[]).map((p) => (
                <Label
                  key={p}
                  className="flex items-center gap-2 text-sm font-normal"
                >
                  <Switch
                    size="sm"
                    checked={!o.hidden.includes(p)}
                    onCheckedChange={(v) => togglePart(p, v)}
                  />
                  {PART_LABEL[p]}
                </Label>
              ))}
            </div>
          </Field>
          <Field label="Frase" hint={`${o.phrase.length}/${MAX_PHRASE}`}>
            <Input
              value={o.phrase}
              maxLength={MAX_PHRASE}
              placeholder={
                autoPhrase(data, o) ||
                "Vacía: sale sola cuando hay algo para destacar"
              }
              onChange={(e) => set({ phrase: e.target.value })}
              aria-label="Frase"
            />
            <span className="text-xs text-muted-foreground">
              Si la dejás vacía, sale sola: primero del ranking, racha de
              victorias, top 10…
            </span>
          </Field>
          <Field label="Últimos resultados">
            <Segmented
              label="Últimos resultados"
              size="sm"
              value={o.last}
              options={[
                { value: 5, label: "5" },
                { value: 10, label: "10" },
              ]}
              onChange={(n) => set({ last: n })}
            />
          </Field>
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setO({ ...DEFAULT_OPTIONS, design: o.design })}
          >
            Volver a lo de fábrica
          </Button>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div
            className={cn(
              "flex min-h-[280px] items-start justify-center overflow-auto rounded-lg p-6",
              BG_CLASS[bg]
            )}
          >
            <StreamWidget data={data} options={o} />
          </div>
          <div className="flex gap-2">
            <Input
              readOnly
              value={url}
              aria-label="URL del widget"
              className="font-mono text-xs"
              onFocus={(e) => e.target.select()}
            />
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
            En OBS: Fuentes → + →{" "}
            <strong className="text-foreground">Navegador</strong> → pegá la URL
            con tamaño {Math.round((w * o.scale) / 100)} ×{" "}
            {Math.round((h * o.scale) / 100)}. Se actualiza solo cada minuto.
          </p>
        </div>
      </section>
    </div>
  )
}
