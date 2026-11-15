import { createFileRoute, notFound } from "@tanstack/react-router"
import { cn } from "cn"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  PIN_AWARDS,
  PIN_METALS,
  PIN_STYLES,
  PIN_TIERS,
  styleOf,
  tierOf,
  type PinAward,
  type PinMetal,
  type PinStyle,
  type PinTier,
} from "@/features/pins/pinSvg"
import { TournamentPin } from "@/features/pins/TournamentPin"
import {
  DEFAULT_CONFIG,
  FORMAT_LABEL,
  award,
  summary,
  tierExists,
  type Format,
  type PinsConfig,
  type Setup,
} from "./-demo-pines/sim"

// Prototipo de los pines de torneo (plan docs/bitacora/2026-11-14-pines-de-torneo) con datos inventados.
// Solo en `pnpm dev`: en producción la ruta no existe.
export const Route = createFileRoute("/demo/pines")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoPines,
})

const FORMATS: Format[] = ["single", "double", "groups", "swiss", "rr"]

// Vitrina de ejemplo: un torneo, un pin (el campeón de la Copa no tiene también el de finalista).
const SHOWCASE: {
  tier: PinTier
  style: PinStyle
  metal: PinMetal
  event: string
  year: number
  date: string
  teams: number
}[] = [
  {
    tier: "champion",
    metal: "oro",
    style: "anillos",
    event: "Copa CM League",
    year: 2026,
    date: "2026-11-02",
    teams: 16,
  },
  {
    tier: "finalist",
    metal: "plata",
    style: "corona",
    event: "Liga de Primavera",
    year: 2026,
    date: "2026-10-12",
    teams: 8,
  },
  {
    tier: "third",
    metal: "bronce",
    style: "obelisco",
    event: "Torneo Relámpago",
    year: 2026,
    date: "2026-09-20",
    teams: 12,
  },
  {
    tier: "semifinalist",
    metal: "bronce",
    style: "disco",
    event: "Copa Invierno",
    year: 2026,
    date: "2026-07-14",
    teams: 16,
  },
  {
    tier: "quarter",
    metal: "acero",
    style: "isotipo",
    event: "Open Abierto #3",
    year: 2026,
    date: "2026-06-01",
    teams: 24,
  },
  {
    tier: "participant",
    metal: "acero",
    style: "estrella3d",
    event: "Liga Federal",
    year: 2025,
    date: "2025-12-10",
    teams: 20,
  },
]

function DemoPines() {
  const [event, setEvent] = useState("Copa CM League")
  const [year, setYear] = useState(2026)
  const [setup, setSetup] = useState<Setup>({
    format: "single",
    teams: 12,
    third: false,
    playoff: 8,
  })
  const [config, setConfig] = useState<PinsConfig>(DEFAULT_CONFIG)
  const [style, setStyle] = useState<PinStyle>("anillos")
  const [awards, setAwards] = useState<Record<PinAward, boolean>>(
    () =>
      Object.fromEntries(
        PIN_AWARDS.map((a) => [a.id, a.id !== "entry" && a.id !== "adr"])
      ) as Record<PinAward, boolean>
  )
  const results = useMemo(() => award(setup, config), [setup, config])
  const usesPlayoff = setup.format === "groups" || setup.format === "swiss"
  const usesThird = setup.format === "single" || usesPlayoff

  const setTier = (t: PinTier, patch: Partial<PinsConfig["tiers"][PinTier]>) =>
    setConfig((c) => ({
      ...c,
      tiers: { ...c.tiers, [t]: { ...c.tiers[t], ...patch } },
    }))

  return (
    <TooltipProvider>
      <main className="mx-auto flex max-w-6xl flex-col gap-8 p-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Pines de torneo</h1>
          <p className="text-sm text-muted-foreground">
            Cada equipo recibe un solo pin por torneo: el de su mejor resultado.
            Prototipo con datos inventados.
          </p>
        </header>

        {/* Escalones */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
              Escalones
            </h2>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="st">Estilo</Label>
                <Select
                  value={style}
                  onValueChange={(v) => setStyle(v as PinStyle)}
                >
                  <SelectTrigger id="st" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIN_STYLES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ev">Torneo</Label>
                <Input
                  id="ev"
                  value={event}
                  maxLength={40}
                  onChange={(e) => setEvent(e.target.value)}
                  className="w-56"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="yr">Año</Label>
                <Input
                  id="yr"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value) || 2026)}
                  className="w-24 font-mono"
                />
              </div>
            </div>
          </div>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
            {PIN_TIERS.map((t) => (
              <li
                key={t.id}
                className="flex flex-col items-center gap-1.5 rounded-xl border bg-card p-3 text-center"
              >
                <TournamentPin
                  style={style}
                  tier={t.id}
                  metal={config.tiers[t.id].metal}
                  event={event}
                  year={year}
                  size={130}
                />
                <span className="text-sm font-semibold">{t.name}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {styleOf(style).hint}. El organizador elige el estilo al crear el
            torneo.
          </p>
        </section>

        {/* Estilos */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
            Estilos ({PIN_STYLES.length})
          </h2>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {PIN_STYLES.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setStyle(s.id)}
                  aria-pressed={style === s.id}
                  className={cn(
                    "flex w-full flex-col gap-2 rounded-xl border bg-card p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    style === s.id
                      ? "border-primary ring-1 ring-primary"
                      : "hover:border-foreground/25"
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.hint}
                    </span>
                  </span>
                  <span className="flex justify-between gap-0.5">
                    {(
                      [
                        { tier: "champion" },
                        { tier: "finalist" },
                        { tier: "semifinalist" },
                        { tier: "participant" },
                        { award: "mvp" },
                      ] as { tier?: PinTier; award?: PinAward }[]
                    ).map((p) => (
                      <TournamentPin
                        key={p.tier ?? p.award}
                        style={s.id}
                        tier={p.tier}
                        award={p.award}
                        metal={p.tier ? config.tiers[p.tier].metal : undefined}
                        event={event}
                        year={year}
                        size={60}
                      />
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Premios individuales */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
              Premios individuales
            </h2>
            <p className="text-xs text-muted-foreground">
              Van al jugador, además del pin de su equipo. Salen de las stats
              del torneo y cada uno se prende o se apaga por torneo.
            </p>
          </div>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {PIN_AWARDS.map((a, i) => (
              <li
                key={a.id}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center",
                  !awards[a.id] && "opacity-60"
                )}
              >
                <TournamentPin
                  style={style}
                  award={a.id}
                  event={event}
                  year={year}
                  size={120}
                  locked={!awards[a.id]}
                />
                <span className="text-sm font-semibold">{a.name}</span>
                <span className="text-xs text-muted-foreground">{a.rule}</span>
                {awards[a.id] && (
                  <Badge variant="soft">
                    Jugador {i + 1} · Equipo {(i % 4) + 1}
                  </Badge>
                )}
                <Switch
                  aria-label={`Repartir ${a.name}`}
                  checked={awards[a.id]}
                  onCheckedChange={(on) =>
                    setAwards((w) => ({ ...w, [a.id]: on }))
                  }
                />
              </li>
            ))}
          </ul>
        </section>

        {/* Simulador */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
            Configuración del torneo
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <Card variant="outline" className="flex min-w-0 flex-col gap-4 p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fmt">Formato</Label>
                  <Select
                    value={setup.format}
                    onValueChange={(v) =>
                      setSetup((s) => ({ ...s, format: v as Format }))
                    }
                  >
                    <SelectTrigger id="fmt" className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMATS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {FORMAT_LABEL[f]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="n">Equipos que jugaron</Label>
                  <Input
                    id="n"
                    type="number"
                    min={2}
                    max={64}
                    value={setup.teams}
                    onChange={(e) =>
                      setSetup((s) => ({
                        ...s,
                        teams: Math.max(
                          2,
                          Math.min(64, Number(e.target.value) || 2)
                        ),
                      }))
                    }
                    className="w-24 font-mono"
                  />
                </div>
                {usesPlayoff && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="po">Pasan a playoffs</Label>
                    <Select
                      value={String(setup.playoff)}
                      onValueChange={(v) =>
                        setSetup((s) => ({ ...s, playoff: Number(v) }))
                      }
                    >
                      <SelectTrigger id="po" className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2, 4, 8, 16].map((k) => (
                          <SelectItem key={k} value={String(k)}>
                            {k}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {usesThird && (
                  <div className="flex items-center gap-2 pb-2">
                    <Switch
                      id="third"
                      checked={setup.third}
                      onCheckedChange={(third) =>
                        setSetup((s) => ({ ...s, third }))
                      }
                    />
                    <Label htmlFor="third">Partido por el 3.º puesto</Label>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t pt-4">
                <div>
                  <p className="text-sm font-semibold">Pines</p>
                  <p className="text-xs text-muted-foreground">
                    Apagado, el torneo no reparte ninguno.
                  </p>
                </div>
                <Switch
                  aria-label="Pines del torneo"
                  checked={config.enabled}
                  onCheckedChange={(enabled) =>
                    setConfig((c) => ({ ...c, enabled }))
                  }
                />
              </div>

              <ul
                className={cn(
                  "flex flex-col divide-y",
                  !config.enabled && "opacity-50"
                )}
              >
                {PIN_TIERS.map((t) => {
                  const cfg = config.tiers[t.id]
                  const missing = tierExists(t.id, setup)
                  return (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
                    >
                      <TournamentPin
                        style={style}
                        tier={t.id}
                        metal={cfg.metal}
                        event={event}
                        year={year}
                        size={40}
                        locked={!!missing || !cfg.on}
                      />
                      <div className="min-w-[9rem] flex-1">
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {missing ?? (cfg.on ? "Se reparte" : "Apagado")}
                        </p>
                      </div>
                      <div className="ml-auto flex items-center gap-3">
                        <Select
                          value={cfg.metal}
                          onValueChange={(v) =>
                            setTier(t.id, { metal: v as PinMetal })
                          }
                          disabled={!config.enabled}
                        >
                          <SelectTrigger
                            className="w-24"
                            aria-label={`Metal de ${t.name}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PIN_METALS.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min={2}
                          placeholder="—"
                          aria-label={`Mínimo de equipos para ${t.name}`}
                          title="Mínimo de equipos"
                          value={cfg.min ?? ""}
                          disabled={!config.enabled}
                          onChange={(e) =>
                            setTier(t.id, {
                              min:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                          className="w-16 font-mono"
                        />
                        <Switch
                          aria-label={`Repartir ${t.name}`}
                          checked={cfg.on}
                          disabled={!config.enabled}
                          onCheckedChange={(on) => setTier(t.id, { on })}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
              <p className="text-xs text-muted-foreground">
                El número es el mínimo de equipos que tienen que jugar para que
                se reparta ese escalón (vacío: sin mínimo).
              </p>
            </Card>

            <Card variant="outline" className="flex min-w-0 flex-col gap-3 p-4">
              <div>
                <p className="text-sm font-semibold">Resultado del torneo</p>
                <p className="text-xs text-muted-foreground">
                  {summary(results)}
                </p>
              </div>
              <ul className="flex max-h-[640px] flex-col divide-y overflow-y-auto">
                {results.map((r) => (
                  <li key={r.team} className="flex items-center gap-3 py-2">
                    <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                      {r.label}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {r.team}
                      </span>
                      {r.why && (
                        <span className="text-xs text-muted-foreground">
                          {r.why}
                        </span>
                      )}
                    </span>
                    {r.pin ? (
                      <span className="flex items-center gap-2">
                        <span className="text-xs">{tierOf(r.pin).name}</span>
                        <TournamentPin
                          style={style}
                          tier={r.pin}
                          metal={r.metal ?? undefined}
                          event={event}
                          year={year}
                          size={30}
                        />
                      </span>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        Sin pin
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        {/* Vitrina */}
        <section className="flex flex-col gap-3">
          <h2 className="flex items-baseline gap-2.5 text-xl font-bold tracking-[-0.4px]">
            Vitrina
            <span className="text-sm font-normal text-muted-foreground">
              {SHOWCASE.length} pines · 1 título
            </span>
          </h2>
          <Card variant="outline" className="overflow-hidden p-0">
            <div className="flex flex-wrap items-end justify-center gap-x-6 gap-y-4 bg-gradient-to-b from-transparent to-muted/50 px-6 pt-6 pb-0">
              {SHOWCASE.map((p) => (
                <Tooltip key={p.event}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="rounded-lg transition-transform outline-none hover:-translate-y-1 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <TournamentPin
                        style={p.style}
                        tier={p.tier}
                        metal={p.metal}
                        event={p.event}
                        year={p.year}
                        size={p.tier === "champion" ? 128 : 104}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-semibold">{tierOf(p.tier).name}</p>
                    <p>
                      {p.event} · {p.date} · {p.teams} equipos
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            {/* Repisa */}
            <div className="h-3 border-t bg-muted shadow-[inset_0_2px_3px_rgb(0_0_0/.15)]" />
          </Card>
        </section>
      </main>
    </TooltipProvider>
  )
}
