import { cn } from "cn"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { PinsConfig } from "./api"
import { AWARD_ORDER, TIER_ORDER, tierUnavailable } from "./config"
import {
  PIN_METALS,
  PIN_STYLES,
  awardOf,
  tierOf,
  type PinMetal,
  type PinStyle,
} from "./pinSvg"
import { TournamentPin } from "./TournamentPin"

// Sección "Pines y trofeos" del formulario del torneo (replanteo 123): el estilo, qué puestos reciben pin (con su
// metal y el mínimo de equipos) y los premios individuales (automático o "lo elijo yo").

const AUTO_HINT: Record<string, string> = {
  mvp: "Mejor rating",
  top_fragger: "Más kills",
  awp: "Más kills con AWP",
  clutch: "Más clutches ganados",
  hs: "Mayor % de headshots",
  adr: "Mayor ADR",
  entry: "Más primeras kills",
}

export function PinsFields({
  value,
  onChange,
  eventName,
  template,
  config,
  teams,
  finished,
}: {
  value: PinsConfig
  onChange: (next: PinsConfig) => void
  eventName: string
  template: string
  config: Record<string, unknown>
  teams: number | null
  finished: boolean
}) {
  const year = new Date().getFullYear()
  const name = eventName.trim() || "Tu torneo"
  const set = (patch: Partial<PinsConfig>) => onChange({ ...value, ...patch })
  const setTier = (
    t: (typeof TIER_ORDER)[number],
    patch: Partial<NonNullable<PinsConfig["tiers"]["champion"]>>
  ) => set({ tiers: { ...value.tiers, [t]: { ...value.tiers[t]!, ...patch } } })
  const setAward = (
    a: (typeof AWARD_ORDER)[number],
    patch: Partial<NonNullable<PinsConfig["awards"]["mvp"]>>
  ) =>
    set({ awards: { ...value.awards, [a]: { ...value.awards[a]!, ...patch } } })

  return (
    <div className="flex flex-col gap-2.5">
      <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
        Pines y trofeos
      </h2>
      <label className="flex items-center gap-3 text-sm">
        <Switch
          checked={value.enabled}
          onCheckedChange={(on) => set({ enabled: on })}
        />
        <span className="flex flex-col">
          <span className="font-medium">Repartir pines y premios</span>
          <span className="text-xs text-muted-foreground">
            Al terminar el torneo, cada equipo recibe el pin de su puesto (uno
            solo, el de su mejor resultado) y sus jugadores lo ven en su
            vitrina.
          </span>
        </span>
      </label>
      {finished && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          El torneo ya terminó: al guardar, los pines y premios se vuelven a
          calcular con esta configuración. El cambio queda registrado.
        </p>
      )}
      {value.enabled && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-muted-foreground">
              Diseño
            </h3>
            <div
              role="radiogroup"
              aria-label="Diseño de los pines"
              className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2"
            >
              {PIN_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={value.style === s.id}
                  title={s.hint}
                  onClick={() => set({ style: s.id })}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border bg-card p-2 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    value.style === s.id
                      ? "border-primary ring-1 ring-primary"
                      : "hover:border-foreground/25"
                  )}
                >
                  <TournamentPin
                    tier="champion"
                    style={s.id}
                    event={name}
                    year={year}
                    size={64}
                  />
                  <span className="text-xs font-medium">{s.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-muted-foreground">
              Por puesto
            </h3>
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {TIER_ORDER.map((t) => {
                const cfg = value.tiers[t]!
                const off = tierUnavailable(t, template, config, teams)
                return (
                  <li
                    key={t}
                    className={cn(
                      "flex flex-wrap items-center gap-3 px-3 py-2.5",
                      off && "opacity-60"
                    )}
                  >
                    <TournamentPin
                      tier={t}
                      metal={cfg.metal}
                      style={value.style as PinStyle}
                      event={name}
                      year={year}
                      size={44}
                      locked={!cfg.on}
                    />
                    <span className="flex min-w-32 flex-1 flex-col">
                      <span className="text-sm font-medium">
                        {tierOf(t).name}
                      </span>
                      {off && (
                        <span className="text-xs text-muted-foreground">
                          {off}
                        </span>
                      )}
                    </span>
                    <Select
                      value={cfg.metal}
                      onValueChange={(m) =>
                        setTier(t, { metal: m as PinMetal })
                      }
                      disabled={!cfg.on}
                    >
                      <SelectTrigger
                        aria-label={`Metal de ${tierOf(t).name}`}
                        className="w-28"
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
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Desde
                      <Input
                        type="number"
                        min={2}
                        max={128}
                        value={cfg.min_teams ?? ""}
                        placeholder="—"
                        disabled={!cfg.on}
                        aria-label={`Equipos mínimos para ${tierOf(t).name}`}
                        onChange={(e) =>
                          setTier(t, {
                            min_teams:
                              e.target.value === ""
                                ? null
                                : Math.min(
                                    128,
                                    Math.max(2, Number(e.target.value))
                                  ),
                          })
                        }
                        className="h-8 w-16 font-mono"
                      />
                      equipos
                    </label>
                    <Switch
                      checked={cfg.on}
                      onCheckedChange={(on) => setTier(t, { on })}
                      aria-label={`Dar el pin de ${tierOf(t).name}`}
                    />
                  </li>
                )
              })}
            </ul>
            <p className="text-xs text-muted-foreground">
              Cada equipo recibe un solo pin, el de su puesto final: el campeón
              no recibe también el de finalista. Si el escalón que le toca está
              apagado (o no se llega a los equipos mínimos), ese equipo no
              recibe pin. Con «Tercer puesto» apagado, el 3.º recibe
              «Semifinalista».
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-muted-foreground">
              Premios individuales
            </h3>
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {AWARD_ORDER.map((a) => {
                const cfg = value.awards[a]!
                return (
                  <li
                    key={a}
                    className="flex flex-wrap items-center gap-3 px-3 py-2.5"
                  >
                    <TournamentPin
                      award={a}
                      style={value.style as PinStyle}
                      event={name}
                      year={year}
                      size={44}
                      locked={!cfg.on}
                    />
                    <span className="flex min-w-32 flex-1 flex-col">
                      <span className="text-sm font-medium">
                        {awardOf(a).name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {a === "play"
                          ? "La eliges tú entre los clips del torneo"
                          : cfg.mode === "auto"
                            ? `Automático: ${AUTO_HINT[a]}`
                            : `Lo eliges tú de una lista ordenada por ${AUTO_HINT[a]?.toLowerCase()}`}
                      </span>
                    </span>
                    {a !== "play" && (
                      <Select
                        value={cfg.mode}
                        onValueChange={(m) =>
                          setAward(a, { mode: m as "auto" | "pick" })
                        }
                        disabled={!cfg.on}
                      >
                        <SelectTrigger
                          aria-label={`Quién elige ${awardOf(a).name}`}
                          className="w-36"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automático</SelectItem>
                          <SelectItem value="pick">Lo elijo yo</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Switch
                      checked={cfg.on}
                      onCheckedChange={(on) => setAward(a, { on })}
                      aria-label={`Dar ${awardOf(a).name}`}
                    />
                  </li>
                )
              })}
            </ul>
            <p className="text-xs text-muted-foreground">
              Los automáticos salen de las stats de las partidas del torneo
              jugadas en el servidor (AWP y clutch, solo con el reporter 2.7.0 o
              más nuevo). Si el torneo no tiene stats, todos se eligen a mano,
              entre los jugadores inscritos.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
