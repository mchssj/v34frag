import { cn } from "cn"
import { ArrowLeftIcon, InfoIcon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Medal } from "@/features/medals/Medal"
import {
  ACCENTS,
  CATEGORIES,
  METALS,
  METAL_LIST,
  TEMPLATES,
  defaultLook,
  numberFor,
  templateOf,
} from "@/features/medals/templates"
import { AdminHeader, Chip } from "../../components/ui"
import {
  useActivateMedal,
  useCreateMedal,
  usePatchMedal,
  usePreviewMedal,
  type MedalDefinition,
} from "../api/queries"
import {
  AGGREGATION_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  designBody,
  fixedTarget,
  fromDefinition,
  fromTemplate,
  lookOf,
  problems,
  ruleOf,
  withTarget,
  type Draft,
} from "../lib/editor"

const ACCENT_IDS = Object.keys(ACCENTS).filter((k) => k !== "bloqueada")

/** Administración › Medallas › Nueva medalla (o editar una). Plan, sección 9.1. */
export function MedalEditor({
  def,
  onDone,
  onSaved,
}: {
  def?: MedalDefinition
  onDone: () => void
  onSaved: (id: string) => void
}) {
  const [d, setD] = useState<Draft>(() =>
    def ? fromDefinition(def) : fromTemplate("victorias")
  )
  const [retro, setRetro] = useState(true)
  const [category, setCategory] = useState<string>(
    () => templateOf(d.template)?.category ?? "Trayectoria"
  )
  const create = useCreateMedal()
  const patch = usePatchMedal()
  const activate = useActivateMedal()
  const preview = usePreviewMedal()
  const [count, setCount] = useState<{ key: string; n: number | null } | null>(
    null
  )

  const t = templateOf(d.template)!
  const draft = !def || def.status === "draft"
  const locked = !draft // la plantilla y la condición solo cambian en un borrador
  const look = lookOf(d)
  const issues = problems(d)
  const busy = create.isPending || patch.isPending || activate.isPending
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))
  const countKey = `${d.template}:${d.target}:${d.minMatches}`
  const engine = !["season_rank", "manual", "event_result"].includes(
    t.aggregation
  )
  const avg = t.aggregation === "avg_min_matches"

  async function save(andActivate: boolean) {
    try {
      let id = def?.id
      const common = { title: d.title.trim(), design: designBody(d) }
      if (!id) {
        id = (
          await create.mutateAsync({
            template: d.template,
            target: d.target,
            ...(avg ? { min_matches: d.minMatches } : {}),
            ...common,
          })
        ).id
      } else {
        await patch.mutateAsync({
          id,
          body: {
            ...(draft
              ? {
                  target: d.target,
                  ...(avg ? { min_matches: d.minMatches } : {}),
                }
              : {}),
            ...common,
          },
        })
      }
      if (andActivate) {
        const r = await activate.mutateAsync({
          id,
          retroactive: engine && retro,
        })
        toast.success(
          r.awarded
            ? `Activada: se la dio a ${r.awarded} ${r.awarded === 1 ? "jugador" : "jugadores"}.`
            : engine
              ? "Activada. El motor la revisa después de cada mix."
              : "Activada."
        )
        onDone()
      } else {
        toast.success(def ? "Cambios guardados." : "Borrador guardado.")
        if (!def) onSaved(id)
      }
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <Button variant="ghost" size="sm" className="w-fit" onClick={onDone}>
        <ArrowLeftIcon aria-hidden />
        Medallas
      </Button>
      <AdminHeader
        title={def ? def.title : "Nueva medalla"}
        subtitle={
          locked
            ? "Esta medalla ya se otorga: se cambian el dibujo y el título. Para otra condición u otro objetivo, archívala y crea otra."
            : "Elige una plantilla, ponle un objetivo y ajusta lo que la plantilla deja editar."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {def && (
              <Chip tone={STATUS_TONE[def.status]}>
                {STATUS_LABEL[def.status]}
              </Chip>
            )}
            <Button
              variant="outline"
              size="md"
              disabled={busy || issues.length > 0}
              onClick={() => void save(false)}
            >
              {def && !draft ? "Guardar cambios" : "Guardar borrador"}
            </Button>
            {def?.status !== "active" && (
              <Button
                size="md"
                disabled={busy || issues.length > 0}
                onClick={() => void save(true)}
              >
                {def?.status === "archived"
                  ? "Guardar y reactivar"
                  : "Guardar y activar"}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Block
            title="1. Plantilla"
            sub="El diseño de Kyan y qué se cuenta. La forma y el ícono vienen con la plantilla."
          >
            {!locked && (
              <div
                role="tablist"
                aria-label="Categoría"
                className="flex flex-wrap gap-1.5"
              >
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={c === category}
                    onClick={() => setCategory(c)}
                    className={cn(
                      "h-8 rounded-full border px-3 text-sm",
                      c === category
                        ? "border-primary bg-primary/10 font-medium"
                        : "border-border"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div
              role="radiogroup"
              aria-label="Plantilla"
              className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2"
            >
              {TEMPLATES.filter((x) =>
                locked
                  ? x.id === d.template
                  : // Campeón y finalista de torneo ya existen (replanteo 114): se editan, no se crean otras.
                    x.category === category && x.aggregation !== "event_result"
              ).map((x) => {
                const sel = x.id === d.template
                return (
                  <button
                    key={x.id}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    disabled={locked}
                    onClick={() => setD(fromTemplate(x.id))}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border-2 p-2.5 text-center transition-colors",
                      sel
                        ? "border-primary bg-primary/10"
                        : "border-transparent bg-muted/40 hover:bg-muted"
                    )}
                  >
                    <Medal look={defaultLook(x)} size={56} title={x.title} />
                    <span className="text-[13px] leading-tight font-semibold">
                      {x.title}
                    </span>
                  </button>
                )
              })}
            </div>
          </Block>

          <Block
            title="2. Condición"
            sub="La métrica es la «misión base» de la plantilla. Tú pones el objetivo."
          >
            <dl className="grid gap-3 sm:grid-cols-3">
              <Fact k="Métrica" v={t.title} />
              <Fact
                k="Cómo se cuenta"
                v={AGGREGATION_LABEL[t.aggregation] ?? t.aggregation}
              />
              <Fact k="Filtro" v={filterText(t.filters)} />
            </dl>
            {!fixedTarget(t) && (
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  {t.id === "podio"
                    ? "Puesto"
                    : t.id === "top_temporada"
                      ? "Hasta el puesto"
                      : "Objetivo"}
                  <Input
                    type="number"
                    min={1}
                    step={avg ? 0.1 : 1}
                    className="w-36 font-mono"
                    value={d.target}
                    disabled={locked}
                    onChange={(e) =>
                      setD(
                        withTarget(d, Math.max(0, Number(e.target.value) || 0))
                      )
                    }
                  />
                </label>
                <div
                  className="flex flex-wrap gap-1.5"
                  aria-label="Escalones de Kyan"
                >
                  {t.steps.map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={locked}
                      onClick={() => setD(withTarget(d, n))}
                      className={cn(
                        "h-10 rounded-lg border px-3 font-mono text-sm disabled:opacity-50",
                        n === d.target
                          ? "border-primary bg-primary/15"
                          : "border-border"
                      )}
                    >
                      {t.id === "podio"
                        ? `${n}.º`
                        : (numberFor(t.defaults.number, n) ?? n)}
                    </button>
                  ))}
                </div>
                {avg && (
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Mínimo de mixes
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      className="w-28 font-mono"
                      value={d.minMatches}
                      disabled={locked}
                      onChange={(e) =>
                        set({
                          minMatches: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </label>
                )}
              </div>
            )}
            {t.id === "top_temporada" && d.target > 10 && (
              <Note>
                Los puestos 11 a 20 no tienen diseño propio. Propuesta mientras
                Kyan lo diseña: el círculo del Top 10 en bronce, con la banda
                «TOP 20».
              </Note>
            )}
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Título
              <Input
                value={d.title}
                maxLength={80}
                onChange={(e) =>
                  set({ title: e.target.value, titleAuto: false })
                }
                className="max-w-md"
              />
            </label>
          </Block>

          <Block
            title="3. Diseño"
            sub="Solo lo que la plantilla deja cambiar. La vista previa se actualiza al instante."
          >
            {t.editable.number && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Número</span>
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    role="group"
                    aria-label="Número"
                    className="inline-flex rounded-lg border p-0.5"
                  >
                    {(["auto", "custom"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={d.numMode === mode}
                        onClick={() =>
                          set({
                            numMode: mode,
                            number:
                              mode === "auto"
                                ? (numberFor(t.defaults.number, d.target) ?? "")
                                : d.number,
                          })
                        }
                        className={cn(
                          "h-9 rounded-md px-3 text-sm",
                          d.numMode === mode && "bg-muted font-medium"
                        )}
                      >
                        {mode === "auto" ? "El del objetivo" : "Personalizado"}
                      </button>
                    ))}
                  </div>
                  {d.numMode === "custom" && (
                    <Input
                      aria-label="Número personalizado"
                      className="w-28 font-mono"
                      value={d.number}
                      maxLength={5}
                      onChange={(e) => set({ number: e.target.value })}
                    />
                  )}
                  <span className="font-mono text-xs text-muted-foreground">
                    Hasta 5 caracteres
                  </span>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              {t.editable.label && (
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Etiqueta
                  <Input
                    className="w-52 uppercase"
                    value={d.label}
                    maxLength={14}
                    onChange={(e) =>
                      set({ label: e.target.value.toUpperCase() })
                    }
                  />
                </label>
              )}
              {t.editable.band && (
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Texto de la banda
                  <Input
                    className="w-52 uppercase"
                    value={d.band}
                    maxLength={14}
                    onChange={(e) =>
                      set({ band: e.target.value.toUpperCase() })
                    }
                  />
                </label>
              )}
              {t.aggregation === "season_rank" && (
                <span className="text-sm text-muted-foreground">
                  La etiqueta dice el número de la temporada al cerrarla (S1,
                  S2…).
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                Metal del marco (nivel)
              </span>
              <div
                role="group"
                aria-label="Metal del marco"
                className="flex flex-wrap gap-2"
              >
                {METAL_LIST.map((x) => {
                  const c = METALS[x.id]
                  return (
                    <button
                      key={x.id}
                      type="button"
                      aria-pressed={d.metal === x.id}
                      onClick={() => set({ metal: x.id })}
                      className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-lg border pr-3.5 pl-2.5 text-sm",
                        d.metal === x.id
                          ? "border-primary bg-primary/10"
                          : "border-border"
                      )}
                    >
                      <span
                        aria-hidden
                        className="size-[18px] rounded-full border border-black"
                        style={{
                          background: `linear-gradient(135deg, ${c.light}, ${c.mid} 45%, ${c.dark})`,
                        }}
                      />
                      {x.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Color</span>
              {t.editable.accent ? (
                <>
                  <div
                    role="group"
                    aria-label="Color de la medalla"
                    className="flex flex-wrap gap-1.5"
                  >
                    {ACCENT_IDS.map((id) => {
                      const c = ACCENTS[id]!
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={d.accent === id}
                          aria-label={id}
                          title={id}
                          onClick={() => set({ accent: id })}
                          className={cn(
                            "inline-flex size-9 items-center justify-center rounded-lg border-2",
                            d.accent === id
                              ? "border-primary"
                              : "border-transparent"
                          )}
                          style={{ background: c.face }}
                        >
                          <span
                            aria-hidden
                            className="size-[18px] rounded border border-black"
                            style={{ background: c.mid }}
                          />
                        </button>
                      )
                    })}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    La paleta de los diseños de Kyan: con un color libre el
                    ícono o el texto pueden dejar de leerse.
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Esta plantilla toma el color del metal.
                </span>
              )}
            </div>
          </Block>

          {(!def || def.status !== "active") && (
            <Block title="4. Al activarla">
              {engine ? (
                <>
                  <label className="flex items-start gap-2.5 text-sm leading-relaxed">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-primary"
                      checked={retro}
                      onChange={(e) => setRetro(e.target.checked)}
                    />
                    <span>
                      <b className="font-semibold">
                        Dársela a quienes ya la cumplen.
                      </b>{" "}
                      Si la apagas, solo cuenta desde el próximo mix de cada
                      jugador.
                    </span>
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/60 p-3">
                    <span className="text-sm">
                      Quiénes la recibirían hoy:{" "}
                      <b className="font-mono">
                        {count?.key === countKey
                          ? `${count.n ?? 0} ${count.n === 1 ? "jugador" : "jugadores"}`
                          : "—"}
                      </b>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={preview.isPending || issues.length > 0}
                      onClick={() =>
                        preview.mutate(
                          {
                            template: d.template,
                            target: d.target,
                            ...(avg ? { min_matches: d.minMatches } : {}),
                          },
                          {
                            onSuccess: (r) =>
                              setCount({ key: countKey, n: r.players }),
                            onError: (e) => toast.error(errorMessage(e)),
                          }
                        )
                      }
                    >
                      Calcular
                    </Button>
                  </div>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {t.aggregation === "manual"
                    ? "Activa, la puede dar un admin desde Administración › Jugadores › Fichas."
                    : t.aggregation === "event_result"
                      ? "Activa, se da sola al terminar cada torneo."
                      : "Activa, queda para elegirla en los tramos de Administración › Temporadas."}
                </span>
              )}
            </Block>
          )}
          {issues.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-destructive">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </div>

        <aside className="flex flex-col gap-4 rounded-xl border p-5 lg:sticky lg:top-4">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Vista previa
          </span>
          <div className="flex justify-center">
            <Medal look={look} size={210} title={d.title} />
          </div>
          <div className="flex flex-col gap-1 text-center">
            <span className="font-semibold">{d.title}</span>
            <span className="text-xs leading-relaxed text-muted-foreground">
              {ruleOf(d)}
            </span>
          </div>
          {engine && (
            <div className="flex items-center gap-3 border-t pt-4">
              <Medal look={look} locked size={64} title={d.title} />
              <span className="text-xs text-muted-foreground">
                Bloqueada, como la ve quien todavía no la tiene
              </span>
            </div>
          )}
          <div className="flex flex-col gap-2 border-t pt-4">
            <span className="text-xs text-muted-foreground">
              Tamaños en la web
            </span>
            <div className="flex items-end gap-5">
              {(
                [
                  [32, "Ranking"],
                  [48, "Campana"],
                  [96, "Perfil"],
                ] as const
              ).map(([s, l]) => (
                <div key={l} className="flex flex-col items-center gap-1">
                  <Medal look={look} size={s} title={d.title} />
                  <span className="text-[11px] text-muted-foreground">{l}</span>
                </div>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground">
              En 32 px el detalle no se lee: falta decidir con Kyan si en chico
              va la versión plana.
            </span>
          </div>
        </aside>
      </div>
    </section>
  )
}

function filterText(f: Record<string, unknown>): string {
  if (Array.isArray(f.weapons))
    return `Arma: ${(f.weapons as string[]).join(", ")}`
  if (Array.isArray(f.maps)) return `Mapa: ${(f.maps as string[]).join(" o ")}`
  if (f.season) return `Temporada ${String(f.season)}`
  return "Ninguno"
}

function Block({
  title,
  sub,
  children,
}: {
  title: string
  sub?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </section>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-muted/50 p-3">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="text-sm font-medium">{v}</dd>
    </div>
  )
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
      <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <span>{children}</span>
    </p>
  )
}
