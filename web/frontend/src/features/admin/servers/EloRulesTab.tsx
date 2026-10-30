import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { InfoIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import type { Schemas } from "@/api/client"
import { errorMessage } from "@/api/errors"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { fmtDate, signed } from "../format"
import { Card, QueryError } from "../ui"
import {
  eloConfigOptions,
  eloPreviewOptions,
  useSaveEloConfig,
  type EloValues,
} from "./queries"

type Key = keyof EloValues
type FieldDef = {
  key: Key
  group: string
  label: string
  help: string
  min: number
  max: number
  unit?: string
  decimals?: boolean
}

// Rangos del contrato (admin.md, "ELO (admin)").
export const ELO_FIELDS: FieldDef[] = [
  {
    key: "base",
    group: "Por mix",
    label: "ELO base",
    min: 5,
    max: 100,
    help: "Lo que gana o pierde cada uno con equipos parejos.",
  },
  {
    key: "bonus_max",
    group: "Por mix",
    label: "Tope por rendimiento",
    min: 0,
    max: 20,
    help: "Máximo que el rating suma o resta.",
  },
  {
    key: "bonus_factor",
    group: "Por mix",
    label: "Bonus por punto de rating",
    min: 0,
    max: 50,
    decimals: true,
    help: "Por cada 1,00 de rating sobre o bajo 1,00.",
  },
  {
    key: "start_elo",
    group: "Límites",
    label: "ELO inicial",
    min: 100,
    max: 5000,
    help: "Con el que empieza un jugador nuevo.",
  },
  {
    key: "elo_floor",
    group: "Límites",
    label: "ELO mínimo",
    min: 0,
    max: 1000,
    help: "Nadie baja de este valor.",
  },
  {
    key: "min_pct",
    group: "Participación",
    label: "Mínima",
    unit: "%",
    min: 1,
    max: 100,
    help: "Con menos rondas que esto, el ELO no cambia.",
  },
  {
    key: "full_pct",
    group: "Participación",
    label: "Completa",
    unit: "%",
    min: 1,
    max: 100,
    help: "Desde acá cuenta entero; en el medio, proporcional.",
  },
]

type Draft = Record<Key, string>
const toDraft = (v: EloValues): Draft =>
  Object.fromEntries(
    ELO_FIELDS.map((f) => [f.key, String(v[f.key]).replace(".", ",")])
  ) as Draft

/** Valida el borrador con los rangos del contrato. Devuelve los valores o los errores por campo. */
export function parseElo(d: Draft): {
  values: EloValues | null
  errors: Partial<Record<Key, string>>
} {
  const errors: Partial<Record<Key, string>> = {}
  const out: Partial<EloValues> = {}
  for (const f of ELO_FIELDS) {
    const raw = d[f.key].trim().replace(",", ".")
    const n = Number(raw)
    if (!raw || Number.isNaN(n)) errors[f.key] = "Escribe un número."
    else if (!f.decimals && !Number.isInteger(n))
      errors[f.key] = "Tiene que ser un número entero."
    else if (n < f.min || n > f.max)
      errors[f.key] = `Entre ${f.min} y ${f.max}.`
    else out[f.key] = n
  }
  if (
    out.start_elo !== undefined &&
    out.elo_floor !== undefined &&
    out.start_elo < out.elo_floor
  )
    errors.start_elo = "No puede ser menor que el ELO mínimo."
  if (
    out.full_pct !== undefined &&
    out.min_pct !== undefined &&
    out.full_pct < out.min_pct
  )
    errors.full_pct = "No puede ser menor que la mínima."
  return {
    values: Object.keys(errors).length ? null : (out as EloValues),
    errors,
  }
}

export function EloRulesTab() {
  const config = useQuery(eloConfigOptions)
  if (config.isError)
    return (
      <QueryError error={config.error} onRetry={() => void config.refetch()} />
    )
  if (config.isPending) return <Skeleton className="h-[520px] rounded-xl" />
  return (
    <EloForm
      key={config.data.updated_at ?? "default"}
      saved={config.data.config}
      updatedAt={config.data.updated_at}
      updatedBy={config.data.updated_by?.alias ?? null}
    />
  )
}

function EloForm({
  saved,
  updatedAt,
  updatedBy,
}: {
  saved: EloValues
  updatedAt: string | null
  updatedBy: string | null
}) {
  const id = useId()
  const [d, setD] = useState<Draft>(() => toDraft(saved))
  const save = useSaveEloConfig()
  const { values, errors } = parseElo(d)
  const savedDraft = toDraft(saved)
  const changed = ELO_FIELDS.filter(
    (f) => d[f.key].trim() !== savedDraft[f.key]
  )
  // La vista previa se pide con un pequeño retardo entre teclas (contrato).
  const debounced = useDebouncedValue(values, 400)
  const preview = useQuery(eloPreviewOptions(debounced))
  const before = useQuery(eloPreviewOptions(saved))

  const groups = [...new Set(ELO_FIELDS.map((f) => f.group))]

  return (
    <div className="flex flex-wrap items-start gap-5">
      <section
        aria-label="Reglas del ELO"
        className="flex min-w-0 flex-[999_1_520px] flex-col rounded-xl border bg-card"
      >
        <div className="flex flex-col gap-2.5 p-4 pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-bold">Reglas del ELO</h2>
            {updatedAt && (
              <span className="text-xs text-muted-foreground">
                Guardado el {fmtDate(updatedAt)}
                {updatedBy ? ` por ${updatedBy}` : ""}
              </span>
            )}
          </div>
          <Alert>
            <InfoIcon aria-hidden />
            <AlertDescription>
              Los cambios valen para los mixes que terminen desde que guardas.{" "}
              <b>No recalculan el historial.</b> Para corregir a jugadores
              puntuales usa Ajustes manuales.
            </AlertDescription>
          </Alert>
        </div>
        {groups.map((g) => (
          <fieldset key={g} className="flex flex-col gap-3.5 border-b p-4">
            <legend className="float-left mb-3.5 w-full text-xs font-semibold tracking-[0.5px] text-muted-foreground uppercase">
              {g}
            </legend>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
              {ELO_FIELDS.filter((f) => f.group === g).map((f) => {
                const err = errors[f.key]
                const isChanged = !err && d[f.key].trim() !== savedDraft[f.key]
                return (
                  <div key={f.key} className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`${id}-${f.key}`}
                      className="flex justify-between gap-2 text-[13px] font-medium"
                    >
                      <span>{f.label}</span>
                      {isChanged && (
                        <span className="font-mono text-xs font-normal text-primary">
                          antes {savedDraft[f.key]}
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <Input
                        id={`${id}-${f.key}`}
                        inputMode="decimal"
                        value={d[f.key]}
                        aria-invalid={!!err}
                        aria-describedby={`${id}-${f.key}-help`}
                        onChange={(e) =>
                          setD((p) => ({ ...p, [f.key]: e.target.value }))
                        }
                        className="h-10 pr-8 font-mono"
                      />
                      {f.unit && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted-foreground"
                        >
                          {f.unit}
                        </span>
                      )}
                    </div>
                    <span
                      id={`${id}-${f.key}-help`}
                      className={cn(
                        "text-xs leading-snug",
                        err ? "text-destructive" : "text-muted-foreground"
                      )}
                    >
                      {err ?? `${f.help} (${f.min}–${f.max})`}
                    </span>
                  </div>
                )
              })}
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap items-center justify-end gap-2.5 p-4">
          <span className="flex-1 text-[13px] text-muted-foreground">
            {save.isError
              ? errorMessage(save.error)
              : changed.length === 0
                ? "Sin cambios"
                : changed.length === 1
                  ? "1 cambio sin guardar"
                  : `${changed.length} cambios sin guardar`}
          </span>
          <Button
            variant="outline"
            size="md"
            disabled={changed.length === 0 || save.isPending}
            onClick={() => setD(savedDraft)}
          >
            Descartar
          </Button>
          <Button
            size="md"
            disabled={changed.length === 0 || !values || save.isPending}
            onClick={() =>
              values &&
              save.mutate(values, {
                onSuccess: () =>
                  toast.success(
                    "Reglas guardadas. Valen para los mixes que terminen desde ahora."
                  ),
              })
            }
          >
            Guardar reglas
          </Button>
        </div>
      </section>

      <aside
        aria-label="Vista previa"
        className="flex min-w-0 flex-[1_1_380px] flex-col gap-3"
      >
        <Card className="gap-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-semibold">Así queda un mix</h2>
            <span className="text-xs text-muted-foreground">
              Equipos parejos
            </span>
          </div>
          {!values ? (
            <p className="text-[13px] text-destructive">
              Corrige los valores marcados para ver la vista previa.
            </p>
          ) : preview.isError ? (
            <p className="text-[13px] text-destructive">
              {errorMessage(preview.error)}
            </p>
          ) : !preview.data ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (
            <Preview
              p={preview.data}
              b={before.data}
              minPct={values.min_pct}
              fullPct={values.full_pct}
            />
          )}
        </Card>
      </aside>
    </div>
  )
}

type PreviewData = Schemas["EloPreview"]

const fmtDelta = (n: number | null) => (n === null ? "No cambia" : signed(n))

function Preview({
  p,
  b,
  minPct,
  fullPct,
}: {
  p: PreviewData
  b: PreviewData | undefined
  minPct: number
  fullPct: number
}) {
  const rows = [
    { label: "Partido normal", sub: "Rating 1,00", now: p.even, was: b?.even },
    {
      label: "Buen partido",
      sub: "Rating 1,40",
      now: p.high_rating,
      was: b?.high_rating,
    },
    {
      label: "Mal partido",
      sub: "Rating 0,60",
      now: p.low_rating,
      was: b?.low_rating,
    },
  ]
  const was = (now: number | null, before: number | null | undefined) =>
    before === undefined || before === now ? "" : `antes ${fmtDelta(before)}`

  return (
    <>
      <div className="flex flex-col">
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 border-t py-2.5 whitespace-nowrap"
          >
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{r.label}</span>
              <span className="text-xs text-muted-foreground">{r.sub}</span>
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <span className="font-mono font-semibold text-win">
                Gana {fmtDelta(r.now.win)}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {was(r.now.win, r.was?.win)}
              </span>
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <span className="font-mono font-semibold text-destructive">
                Pierde {fmtDelta(r.now.lose)}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {was(r.now.lose, r.was?.lose)}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] font-semibold">
          Participación en un mix de {p.participation[0]?.total ?? 30} rondas
        </span>
        <div
          aria-hidden
          className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        >
          <span style={{ width: `${minPct}%` }} />
          <span
            className="bg-primary/45"
            style={{ width: `${Math.max(0, fullPct - minPct)}%` }}
          />
          <span
            className="bg-primary"
            style={{ width: `${Math.max(0, 100 - fullPct)}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>No cuenta</span>
          <span>Proporcional</span>
          <span>Completo</span>
        </div>
        {p.participation.map((r) => (
          <div
            key={r.rounds}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[13px]"
          >
            <span>
              <span className="font-mono">{r.rounds}</span> de {r.total} rondas{" "}
              <span className="text-muted-foreground">({r.pct} %)</span>
            </span>
            <span
              className={cn(
                "font-mono",
                r.win === null
                  ? "text-muted-foreground"
                  : "font-semibold text-foreground"
              )}
            >
              {r.win === null
                ? "No cambia"
                : `${signed(r.win)} / ${fmtDelta(r.lose)}${
                    r.weight < 1
                      ? ` (×${String(r.weight).replace(".", ",")})`
                      : ""
                  }`}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
        {p.new_player.level !== null && (
          <LevelBadge level={p.new_player.level} />
        )}
        <span className="flex flex-col gap-0.5 text-[13px]">
          <span className="font-medium">
            Un jugador nuevo empieza con{" "}
            <span className="font-mono">{p.new_player.elo}</span>
          </span>
          <span className="text-muted-foreground">
            Nadie baja de <span className="font-mono">{p.floor}</span>
          </span>
        </span>
      </div>
    </>
  )
}
