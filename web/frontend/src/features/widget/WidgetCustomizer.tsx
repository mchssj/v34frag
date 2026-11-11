import { cn } from "cn"
import type { ReactNode } from "react"
import { toast } from "sonner"

import { Segmented } from "@/components/brand/Segmented"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
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
  type Part,
  type StatKey,
  type WidgetDesign,
  type WidgetOptions,
  type WidgetPeriod,
} from "./options"
import { autoPhrase, StreamWidget, type WidgetData } from "./StreamWidget"

// Personalizador del widget para OBS: lo usan el diálogo de la cuenta y /demo/widget
// (bitácora 2026-11-10-widget-streamers-en-main, sobre el prototipo de Kyan del 2026-11-08).

export const opts = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }))

/** Fondo "de juego" para ver el widget como en el stream. */
export const STREAM_BG =
  "bg-[linear-gradient(135deg,#1f2b38,#3c5a49_45%,#6b4a33)]"

// Qué diseños usan cada grupo de stats, para no mostrar controles que no cambian nada.
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
                toast.error(`Hasta ${max}. Saca una para sumar otra.`)
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

/** Los controles: diseño, período, stats, color, fondo, tamaño, partes, frase y últimos resultados. */
export function WidgetControls({
  value: o,
  onChange,
  data,
}: {
  value: WidgetOptions
  onChange: (o: WidgetOptions) => void
  data: WidgetData | undefined
}) {
  const set = (p: Partial<WidgetOptions>) => onChange({ ...o, ...p })
  const togglePart = (p: Part, on: boolean) =>
    set({ hidden: on ? o.hidden.filter((x) => x !== p) : [...o.hidden, p] })
  const auto = data ? autoPhrase(data, o) : ""

  return (
    <div className="flex flex-col gap-5">
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
          placeholder={auto || "Vacía: sale sola cuando hay algo para destacar"}
          onChange={(e) => set({ phrase: e.target.value })}
          aria-label="Frase"
        />
        <span className="text-xs text-muted-foreground">
          Si la dejas vacía, sale sola: primero del ranking, racha de victorias,
          top 10…
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
        onClick={() => onChange({ ...DEFAULT_OPTIONS, design: o.design })}
      >
        Volver a lo de fábrica
      </Button>
    </div>
  )
}

/** Vista previa, la URL con Copiar y los pasos para OBS con el tamaño del diseño elegido. */
export function WidgetPreview({
  value: o,
  data,
  url,
  bgClassName = STREAM_BG,
  empty,
}: {
  value: WidgetOptions
  data: WidgetData | undefined
  url: string
  bgClassName?: string
  /** Lo que se ve en la vista previa sin datos (cargando o con error). */
  empty?: ReactNode
}) {
  const [w, h] = WIDGET_SIZE[o.design]
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div
        className={cn(
          "flex min-h-[280px] items-start justify-center overflow-auto rounded-lg p-6",
          bgClassName
        )}
      >
        {data ? <StreamWidget data={data} options={o} /> : empty}
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
              () => toast.error("Cópiala con Ctrl+C.")
            )
          }
        >
          Copiar URL
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        En OBS: Fuentes → + →{" "}
        <strong className="text-foreground">Navegador</strong> → pega la URL con
        tamaño {Math.round((w * o.scale) / 100)} ×{" "}
        {Math.round((h * o.scale) / 100)}. Se actualiza solo cada minuto.
      </p>
    </div>
  )
}
