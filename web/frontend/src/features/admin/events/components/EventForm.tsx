import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { useId, useState, type FormEvent, type ReactNode } from "react"

import type { Schemas } from "@/api/client"
import { errorMessage } from "@/api/errors"
import { ErrorAlert } from "@/components/brand/ErrorAlert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { gameModesOptions, poolMapsOptions } from "../api/queries"
import {
  presetOf,
  SWISS_PRESETS,
  swissMatches,
  swissCupo,
  swissTeams,
  TEMPLATE_HINT,
  TEMPLATE_LABEL,
  type Bo,
  type EventConfig,
  type Template,
} from "../lib/model"

export type EventFormValues = Schemas["EventCreate"]

const TEMPLATES: Template[] = [
  "single",
  "double",
  "groups",
  "swiss",
  "groups_double",
]

/** Valores por defecto de cada plantilla (los mismos que completa event_config en la base). */
const DEFAULTS: Record<Template, EventConfig> = {
  single: { bo: 3, bo_semi: 3, bo_final: 3, third_place: false, bo_third: 3 },
  double: {
    bo: 3,
    bo_upper_final: 3,
    bo_lower_final: 3,
    bo_grand_final: 5,
    advantage: false,
  },
  groups: {
    groups: 2,
    advance: 2,
    bo_group: 1,
    double_rr: false,
    playoffs: { bo: 3, bo_final: 3, third_place: false },
  },
  swiss: {
    stages: 2,
    size: 16,
    wins: 3,
    bo: 1,
    bo_decisive: 3,
    playoffs: { bo: 3, bo_final: 3, third_place: false },
  },
  groups_double: {
    groups: 2,
    advance: 2,
    bo_group: 3,
    playoffs: { bo: 3, bo_final: 5, third_place: false },
  },
}

const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Crear o editar un torneo. `locked`: el fixture ya se generó y el formato no se cambia. */
export function EventForm({
  initial,
  locked = false,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<EventFormValues>
  locked?: boolean
  submitLabel: string
  pending: boolean
  error: unknown
  onSubmit: (values: EventFormValues) => void
  onCancel?: () => void
}) {
  const id = useId()
  const modes = useQuery(gameModesOptions).data ?? []
  const maps = useQuery(poolMapsOptions).data ?? []
  const [name, setName] = useState(initial?.name ?? "")
  const [mode, setMode] = useState(initial?.game_mode ?? "5v5")
  const [subs, setSubs] = useState(initial?.subs_max ?? 1)
  const [startsOn, setStartsOn] = useState(initial?.starts_on ?? "")
  const [endsOn, setEndsOn] = useState(initial?.ends_on ?? "")
  const [closes, setCloses] = useState(
    toLocalInput(initial?.registration_closes_at)
  )
  const [prize, setPrize] = useState(initial?.prize ?? "")
  // Un torneo nuevo arranca en suizo: el cupo viene con los equipos que pide.
  const [maxTeams, setMaxTeams] = useState<number | "">(
    initial?.max_teams !== undefined
      ? (initial.max_teams ?? "")
      : (swissCupo("swiss", DEFAULTS.swiss) ?? "")
  )
  const [rules, setRules] = useState(initial?.rules ?? "")
  const [template, setTemplate] = useState<Template>(
    initial?.template ?? "swiss"
  )
  const [config, setConfig] = useState<EventConfig>(
    initial?.config && initial.template
      ? initial.config
      : DEFAULTS[initial?.template ?? "swiss"]
  )
  // null = el pool por defecto del catálogo.
  const [pool, setPool] = useState<string[] | null>(initial?.map_pool ?? null)

  // Solo el suizo pide un número exacto de equipos: al cambiar sus etapas o equipos por etapa, el
  // cupo se completa solo (se puede cambiar a mano después).
  const set = (patch: EventConfig) => {
    const next = { ...config, ...patch }
    setConfig(next)
    const cupo = swissCupo(template, next)
    if (cupo) setMaxTeams(cupo)
  }
  const setPo = (patch: NonNullable<EventConfig["playoffs"]>) =>
    setConfig((c) => ({ ...c, playoffs: { ...c.playoffs, ...patch } }))
  const pickTemplate = (t: Template) => {
    if (locked || t === template) return
    setTemplate(t)
    setConfig(DEFAULTS[t])
    const cupo = swissCupo(t, DEFAULTS[t])
    // Al salir del suizo, el cupo que puso el suizo se borra; uno escrito a mano queda.
    if (cupo) setMaxTeams(cupo)
    else if (maxTeams === swissCupo(template, config)) setMaxTeams("")
  }

  // El BO más alto de la configuración (solo las claves bo*), para el mínimo del pool.
  const bos = (o: object) =>
    Object.entries(o).flatMap(([k, v]) =>
      k.startsWith("bo") && typeof v === "number" ? [v] : []
    )
  const maxBo = Math.max(...bos(config), ...bos(config.playoffs ?? {}), 1)
  const poolNames =
    pool ?? maps.filter((m) => m.veto_default).map((m) => m.name)
  const problem =
    name.trim().length < 2
      ? name.trim()
        ? "El nombre tiene al menos 2 letras."
        : "Falta el nombre."
      : endsOn && startsOn && endsOn < startsOn
        ? "El torneo no puede terminar antes de empezar."
        : pool && pool.length < maxBo
          ? `El pool necesita al menos ${maxBo} mapas (el BO más alto).`
          : null

  function submit(e: FormEvent) {
    e.preventDefault()
    if (problem) return
    onSubmit({
      name: name.trim(),
      template,
      config,
      game_mode: mode,
      subs_max: subs,
      starts_on: startsOn || null,
      ends_on: endsOn || null,
      registration_closes_at: closes ? new Date(closes).toISOString() : null,
      prize: prize.trim() || null,
      max_teams: maxTeams === "" ? null : maxTeams,
      rules: rules.trim() || null,
      ...(pool ? { map_pool: pool } : {}),
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Card
        variant="outline"
        className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Labeled
          id={`${id}-name`}
          label="Nombre"
          className="sm:col-span-2 lg:col-span-1"
        >
          <Input
            id={`${id}-name`}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Copa CMLeague Invierno"
          />
        </Labeled>
        <Labeled id={`${id}-mode`} label="Modo de juego">
          <Select value={mode} onValueChange={setMode} disabled={locked}>
            <SelectTrigger id={`${id}-mode`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(modes.length ? modes : [{ code: "5v5", name: "5 vs 5" }]).map(
                (m) => (
                  <SelectItem key={m.code} value={m.code}>
                    {m.name}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </Labeled>
        <Labeled
          id={`${id}-subs`}
          label="Suplentes por equipo"
          hint="De 0 a 4."
        >
          <Input
            id={`${id}-subs`}
            type="number"
            min={0}
            max={4}
            value={subs}
            disabled={locked}
            onChange={(e) =>
              setSubs(Math.max(0, Math.min(4, Number(e.target.value))))
            }
            className="font-mono"
          />
        </Labeled>
        <Labeled id={`${id}-start`} label="Empieza">
          <Input
            id={`${id}-start`}
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        </Labeled>
        <Labeled
          id={`${id}-end`}
          label="Termina (aproximado)"
          hint="Fecha tentativa: puede terminar antes o después."
        >
          <Input
            id={`${id}-end`}
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
          />
        </Labeled>
        <Labeled
          id={`${id}-close`}
          label="Cierran las inscripciones"
          hint="Vacío: hasta generar el fixture."
        >
          <Input
            id={`${id}-close`}
            type="datetime-local"
            value={closes}
            onChange={(e) => setCloses(e.target.value)}
          />
        </Labeled>
        <Labeled id={`${id}-prize`} label="Premio">
          <Input
            id={`${id}-prize`}
            value={prize}
            maxLength={200}
            onChange={(e) => setPrize(e.target.value)}
            placeholder="USD 500"
          />
        </Labeled>
        <Labeled
          id={`${id}-max`}
          label="Cupo de equipos"
          hint={
            template === "swiss"
              ? `El suizo elegido necesita ${swissCupo(template, config) ?? "—"}.`
              : "Vacío: sin cupo."
          }
        >
          <Input
            id={`${id}-max`}
            type="number"
            min={2}
            max={256}
            value={maxTeams}
            onChange={(e) =>
              setMaxTeams(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="font-mono"
          />
        </Labeled>
      </Card>

      <div className="flex flex-col gap-2.5">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
          Formato
        </h2>
        {locked && (
          <p className="text-[13px] text-muted-foreground">
            El fixture ya está generado: para cambiar el formato hay que volver
            a la siembra (Resumen › Volver a la siembra).
          </p>
        )}
        <div
          role="radiogroup"
          aria-label="Formato del torneo"
          className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5"
        >
          {TEMPLATES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={template === t}
              disabled={locked && template !== t}
              onClick={() => pickTemplate(t)}
              className={cn(
                "flex flex-col gap-1 rounded-xl border bg-card p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                template === t
                  ? "border-primary ring-1 ring-primary"
                  : "hover:border-foreground/25"
              )}
            >
              <span className="text-sm font-semibold">{TEMPLATE_LABEL[t]}</span>
              <span className="text-xs text-muted-foreground">
                {TEMPLATE_HINT[t]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card variant="outline" className="flex flex-col gap-4 p-4">
          <ConfigFields
            template={template}
            config={config}
            set={set}
            setPo={setPo}
            locked={locked}
          />
        </Card>
        <Summary template={template} config={config} />
      </div>

      <div className="flex flex-col gap-2.5">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
          Pool de mapas
        </h2>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Pool de mapas"
        >
          {maps.map((m) => {
            const on = poolNames.includes(m.name)
            return (
              <button
                key={m.name}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setPool(
                    on
                      ? poolNames.filter((x) => x !== m.name)
                      : [...poolNames, m.name]
                  )
                }
                className={cn(
                  "h-8 rounded-full border px-3 font-mono text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  on
                    ? "border-foreground bg-foreground text-background"
                    : "bg-card hover:bg-muted"
                )}
              >
                {m.name}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Al menos tantos mapas como el BO más alto (BO{maxBo}).{" "}
          {pool ? (
            <button
              type="button"
              className="underline"
              onClick={() => setPool(null)}
            >
              Volver al pool por defecto
            </button>
          ) : (
            "Sin tocar, usa el pool por defecto."
          )}
        </p>
      </div>

      <Labeled
        id={`${id}-rules`}
        label="Reglamento"
        hint="Texto libre, hasta 5000 caracteres."
      >
        <Textarea
          id={`${id}-rules`}
          value={rules}
          maxLength={5000}
          rows={4}
          onChange={(e) => setRules(e.target.value)}
        />
      </Labeled>

      {/* Sin nombre todavía no se avisa: el botón ya queda deshabilitado. */}
      {problem && name.trim() && (
        <p className="text-sm text-destructive">{problem}</p>
      )}
      {error != null && <ErrorAlert message={errorMessage(error)} />}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" size="md" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" size="md" disabled={!!problem || pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

function Labeled({
  id,
  label,
  hint,
  className,
  children,
}: {
  id: string
  label: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

function BoSelect({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string
  label: string
  value: number | undefined
  onChange: (v: Bo) => void
  disabled?: boolean
}) {
  return (
    <Labeled id={id} label={label}>
      <Select
        value={String(value ?? 1)}
        onValueChange={(v) => onChange(Number(v) as Bo)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[1, 3, 5].map((b) => (
            <SelectItem key={b} value={String(b)}>
              BO{b}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Labeled>
  )
}

function NumberSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string
  label: string
  value: number | undefined
  options: number[]
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <Labeled id={id} label={label}>
      <Select
        value={String(value ?? options[0])}
        onValueChange={(v) => onChange(Number(v))}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={String(o)}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Labeled>
  )
}

function Check({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
      />
      {label}
    </label>
  )
}

function ConfigFields({
  template,
  config: c,
  set,
  setPo,
  locked,
}: {
  template: Template
  config: EventConfig
  set: (p: EventConfig) => void
  setPo: (p: NonNullable<EventConfig["playoffs"]>) => void
  locked: boolean
}) {
  const id = useId()
  const row = "flex flex-wrap items-end gap-4"
  const playoffs = (
    <div className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold text-muted-foreground">
        Playoffs
      </h3>
      <div className={row}>
        <BoSelect
          id={`${id}-pbo`}
          label="Rondas"
          value={c.playoffs?.bo}
          onChange={(bo) => setPo({ bo })}
          disabled={locked}
        />
        <BoSelect
          id={`${id}-pfi`}
          label="Final"
          value={c.playoffs?.bo_final}
          onChange={(bo_final) => setPo({ bo_final })}
          disabled={locked}
        />
        <Check
          id={`${id}-pth`}
          label="3.er puesto"
          checked={!!c.playoffs?.third_place}
          onChange={(third_place) => setPo({ third_place })}
          disabled={locked}
        />
      </div>
    </div>
  )
  if (template === "swiss") {
    const preset = presetOf({
      stages: c.stages ?? 1,
      size: c.size ?? 16,
      wins: c.wins ?? 3,
    })
    return (
      <>
        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-muted-foreground">
            Preset
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {SWISS_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={preset === p.key}
                disabled={locked}
                onClick={() =>
                  set({ stages: p.stages, size: p.size, wins: p.wins })
                }
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                  preset === p.key
                    ? "border-foreground bg-foreground text-background"
                    : "bg-card hover:bg-muted"
                )}
              >
                {p.label}
              </button>
            ))}
            {preset === "custom" && (
              <span className="inline-flex h-8 items-center rounded-full border border-dashed px-3 text-xs text-muted-foreground">
                Personalizado
              </span>
            )}
          </div>
        </div>
        <div className={row}>
          <NumberSelect
            id={`${id}-st`}
            label="Etapas suizas"
            value={c.stages}
            options={[1, 2, 3]}
            onChange={(v) => set({ stages: v })}
            disabled={locked}
          />
          <NumberSelect
            id={`${id}-sz`}
            label="Equipos por etapa"
            value={c.size}
            options={[8, 16]}
            onChange={(v) => set({ size: v as 8 | 16 })}
            disabled={locked}
          />
          <NumberSelect
            id={`${id}-w`}
            label="Victorias para clasificar"
            value={c.wins}
            options={[2, 3]}
            onChange={(v) => set({ wins: v as 2 | 3 })}
            disabled={locked}
          />
          <BoSelect
            id={`${id}-bo`}
            label="Partidas comunes"
            value={c.bo}
            onChange={(bo) => set({ bo })}
            disabled={locked}
          />
          <BoSelect
            id={`${id}-bd`}
            label="Partidas decisivas"
            value={c.bo_decisive}
            onChange={(bo_decisive) => set({ bo_decisive })}
            disabled={locked}
          />
        </div>
        {playoffs}
      </>
    )
  }
  if (template === "single")
    return (
      <>
        <div className={row}>
          <BoSelect
            id={`${id}-bo`}
            label="Rondas"
            value={c.bo}
            onChange={(bo) => set({ bo })}
            disabled={locked}
          />
          <BoSelect
            id={`${id}-se`}
            label="Semifinales"
            value={c.bo_semi}
            onChange={(bo_semi) => set({ bo_semi })}
            disabled={locked}
          />
          <BoSelect
            id={`${id}-fi`}
            label="Final"
            value={c.bo_final}
            onChange={(bo_final) => set({ bo_final })}
            disabled={locked}
          />
        </div>
        <div className={row}>
          <Check
            id={`${id}-th`}
            label="Partida por el 3.er puesto"
            checked={!!c.third_place}
            onChange={(third_place) => set({ third_place })}
            disabled={locked}
          />
          {c.third_place && (
            <BoSelect
              id={`${id}-bt`}
              label="3.er puesto"
              value={c.bo_third}
              onChange={(bo_third) => set({ bo_third })}
              disabled={locked}
            />
          )}
        </div>
      </>
    )
  if (template === "double")
    return (
      <>
        <div className={row}>
          <BoSelect
            id={`${id}-bo`}
            label="Rondas"
            value={c.bo}
            onChange={(bo) => set({ bo })}
            disabled={locked}
          />
          <BoSelect
            id={`${id}-uf`}
            label="Final del upper"
            value={c.bo_upper_final}
            onChange={(bo_upper_final) => set({ bo_upper_final })}
            disabled={locked}
          />
          <BoSelect
            id={`${id}-lf`}
            label="Final del lower"
            value={c.bo_lower_final}
            onChange={(bo_lower_final) => set({ bo_lower_final })}
            disabled={locked}
          />
          <BoSelect
            id={`${id}-gf`}
            label="Gran final"
            value={c.bo_grand_final}
            onChange={(bo_grand_final) => set({ bo_grand_final })}
            disabled={locked}
          />
        </div>
        <Check
          id={`${id}-adv`}
          label="El que viene del upper empieza la gran final 1:0 (mapa de ventaja)"
          checked={!!c.advantage}
          onChange={(advantage) => set({ advantage })}
          disabled={locked}
        />
      </>
    )
  return (
    <>
      <div className={row}>
        <NumberSelect
          id={`${id}-g`}
          label="Grupos"
          value={c.groups}
          options={[1, 2, 3, 4, 6, 8]}
          onChange={(groups) => set({ groups })}
          disabled={locked}
        />
        <NumberSelect
          id={`${id}-a`}
          label="Clasifican por grupo"
          value={c.advance}
          options={template === "groups_double" ? [2, 3] : [1, 2, 3, 4]}
          onChange={(advance) => set({ advance })}
          disabled={locked}
        />
        <BoSelect
          id={`${id}-bg`}
          label="Partidas del grupo"
          value={c.bo_group}
          onChange={(bo_group) => set({ bo_group })}
          disabled={locked}
        />
      </div>
      {template === "groups" && (
        <Check
          id={`${id}-rr`}
          label="Ida y vuelta"
          checked={!!c.double_rr}
          onChange={(double_rr) => set({ double_rr })}
          disabled={locked}
        />
      )}
      {playoffs}
    </>
  )
}

function Summary({
  template,
  config: c,
}: {
  template: Template
  config: EventConfig
}) {
  const steps: [string, string][] = []
  const kpis: [string | number, string][] = []
  if (template === "swiss") {
    const stages = c.stages ?? 1
    const size = c.size ?? 16
    const wins = c.wins ?? 3
    const adv = size / 2
    const m = swissMatches(size, wins)
    const po = adv - 1 + (c.playoffs?.third_place ? 1 : 0)
    kpis.push(
      [swissTeams(stages, size), "equipos"],
      [m.total * stages + po, "partidas"],
      [m.rounds, "rondas por etapa"]
    )
    for (let s = 1; s <= stages; s++)
      steps.push([
        `Etapa ${s} · ${size} equipos`,
        s === 1
          ? `Empiezan los ${size} sembrados más bajos. A ${wins} victorias o ${wins} derrotas: ${adv} pasan y ${adv} quedan afuera.`
          : `Los ${adv} que pasan de la etapa ${s - 1} contra los ${adv} que entran directo por siembra. ${adv} pasan.`,
      ])
    steps.push([
      `Playoffs · ${adv} equipos`,
      `Rondas en BO${c.playoffs?.bo ?? 3}, final en BO${c.playoffs?.bo_final ?? 3}${c.playoffs?.third_place ? ", y 3.er puesto" : ""}.`,
    ])
    steps.push([
      "",
      `BO${c.bo ?? 1} en las partidas comunes y BO${c.bo_decisive ?? 3} cuando un equipo puede clasificar o quedar eliminado. Los mejores sembrados entran a la etapa más avanzada.`,
    ])
  } else if (template === "single") {
    steps.push(
      [
        "Llave",
        `Rondas en BO${c.bo}, semifinales en BO${c.bo_semi}. Con equipos de menos, los mejores sembrados pasan con bye.`,
      ],
      [
        "Final",
        `BO${c.bo_final}${c.third_place ? `, y 3.er puesto en BO${c.bo_third}` : ""}.`,
      ]
    )
  } else if (template === "double") {
    steps.push(
      [
        "Upper y lower",
        `Rondas en BO${c.bo}. Quien pierde en el upper baja al lower; quien pierde en el lower queda afuera.`,
      ],
      [
        "Finales",
        `Final del upper en BO${c.bo_upper_final} y del lower en BO${c.bo_lower_final}.`,
      ],
      [
        "Gran final",
        `BO${c.bo_grand_final}${c.advantage ? ", y el que viene del upper empieza 1:0" : ""}.`,
      ]
    )
  } else {
    kpis.push(
      [c.groups ?? 2, "grupos"],
      [(c.groups ?? 2) * (c.advance ?? 2), "a playoffs"]
    )
    steps.push(
      [
        template === "groups"
          ? "Fase de grupos"
          : "Grupos de doble eliminación",
        template === "groups"
          ? `Todos contra todos${c.double_rr ? " ida y vuelta" : ""} en BO${c.bo_group}. Pasan ${c.advance} por grupo.`
          : `Cada grupo es una llave doble en BO${c.bo_group}. Pasan ${c.advance} por grupo.`,
      ],
      [
        `Playoffs`,
        `Rondas en BO${c.playoffs?.bo ?? 3}, final en BO${c.playoffs?.bo_final ?? 3}${c.playoffs?.third_place ? ", y 3.er puesto" : ""}.`,
      ]
    )
  }
  return (
    <div
      className="flex flex-col gap-3 rounded-xl bg-muted p-4"
      aria-live="polite"
    >
      <h3 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
        Cómo se juega
      </h3>
      {kpis.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {kpis.map(([v, l]) => (
            <div key={l} className="rounded-lg bg-card px-3 py-2">
              <div className="font-mono text-lg font-semibold">{v}</div>
              <div className="text-[11px] text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
      )}
      <ol className="flex flex-col gap-2.5">
        {steps.map(([t, d], i) => (
          <li key={i} className="flex flex-col gap-0.5 text-[13px]">
            {t && <span className="font-semibold">{t}</span>}
            <span className="text-muted-foreground">{d}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
