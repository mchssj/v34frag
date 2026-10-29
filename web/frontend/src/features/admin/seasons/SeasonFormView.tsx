import { useQuery } from "@tanstack/react-query"
import { XIcon } from "lucide-react"
import { useId, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { pickPlayerOptions } from "@/features/admin/players/queries"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { Card } from "../ui"
import {
  addTier,
  removeTier,
  resetElo,
  setTierEnd,
  tierName,
  tiersError,
  type SeasonForm,
} from "./seasons"

const num = (v: string) => (v === "" ? -1 : Number(v))
const shown = (n: number) => (n < 0 ? "" : n)

/** Reglas de una temporada: la activa (con fecha de fin) o la próxima (con duración en días). */
export function SeasonFormView({
  mode,
  value,
  onChange,
  seasonNumber,
}: {
  mode: "active" | "next"
  value: SeasonForm
  onChange: (f: SeasonForm) => void
  /** Número de la temporada, para la vista de la medalla. */
  seasonNumber: number
}) {
  const id = useId()
  const f = value
  const set = (patch: Partial<SeasonForm>) => onChange({ ...f, ...patch })
  const tierErr = tiersError(f.tiers, f.top_n)

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
        <Card className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
          {mode === "active" ? (
            <>
              <Field id={`${id}-n`} label="Nombre">
                <Input
                  id={`${id}-n`}
                  value={f.name}
                  maxLength={40}
                  onChange={(e) => set({ name: e.target.value })}
                />
              </Field>
              <Field
                id={`${id}-e`}
                label="Termina el"
                help="A las 06:00 de Argentina. Si hay un mix en vivo, espera a que termine."
              >
                <Input
                  id={`${id}-e`}
                  type="date"
                  value={f.ends}
                  onChange={(e) => set({ ends: e.target.value })}
                />
              </Field>
            </>
          ) : (
            <Field id={`${id}-d`} label="Duración" suffix="días">
              <Input
                id={`${id}-d`}
                type="number"
                min={1}
                max={365}
                value={shown(f.days)}
                onChange={(e) => set({ days: num(e.target.value) })}
                className="w-24 font-mono"
              />
            </Field>
          )}
          <Field id={`${id}-t`} label="Top con medalla" suffix="puestos">
            <Input
              id={`${id}-t`}
              type="number"
              min={1}
              max={500}
              value={shown(f.top_n)}
              onChange={(e) => set({ top_n: num(e.target.value) })}
              className="w-24 font-mono"
            />
          </Field>
          <Field
            id={`${id}-m`}
            label="Mínimo para el ranking"
            suffix="mixes en la temporada"
          >
            <Input
              id={`${id}-m`}
              type="number"
              min={1}
              max={1000}
              value={shown(f.min_matches)}
              onChange={(e) => set({ min_matches: num(e.target.value) })}
              className="w-24 font-mono"
            />
          </Field>
        </Card>

        <Card>
          <div className="flex flex-col gap-1">
            <h2 className="text-[17px] font-bold">Medallas por tramo</h2>
            <span className="text-[13px] leading-relaxed text-muted-foreground">
              Desde el puesto 1, sin huecos. El último tramo llega hasta el top.
              En el nombre, {"{top}"} se reemplaza por el top.
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {f.tiers.map((t, i) => {
              const last = i === f.tiers.length - 1
              const to = last ? f.top_n : t.to
              return (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-2"
                >
                  <span className="w-24 font-mono text-[13px] text-muted-foreground">
                    {t.from === to
                      ? `#${t.from}`
                      : `#${t.from} a ${last ? "top" : `#${to}`}`}
                  </span>
                  {!last && (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      hasta
                      <Input
                        type="number"
                        min={t.from}
                        aria-label={`Último puesto del tramo ${i + 1}`}
                        value={t.to ?? ""}
                        onChange={(e) =>
                          set({
                            tiers: setTierEnd(
                              f.tiers,
                              i,
                              Number(e.target.value) || 0
                            ),
                          })
                        }
                        className="h-8 w-16 font-mono"
                      />
                    </label>
                  )}
                  <Input
                    aria-label={`Ícono del tramo ${i + 1}`}
                    value={t.icon}
                    maxLength={8}
                    onChange={(e) =>
                      set({
                        tiers: f.tiers.map((x, j) =>
                          j === i ? { ...x, icon: e.target.value } : x
                        ),
                      })
                    }
                    className="h-8 w-12 text-center text-base"
                  />
                  <Input
                    aria-label={`Nombre del tramo ${i + 1}`}
                    value={t.name}
                    maxLength={40}
                    onChange={(e) =>
                      set({
                        tiers: f.tiers.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x
                        ),
                      })
                    }
                    className="h-8 min-w-0 flex-[1_1_160px]"
                  />
                  <span className="min-w-[150px] text-xs text-muted-foreground">
                    {t.icon} {tierName(t, f.top_n)} · Temporada {seasonNumber} ·
                    #{t.from}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Quitar el tramo ${i + 1}`}
                    disabled={f.tiers.length === 1}
                    onClick={() => set({ tiers: removeTier(f.tiers, i) })}
                  >
                    <XIcon aria-hidden />
                  </Button>
                </li>
              )
            })}
          </ul>
          {tierErr && (
            <p role="alert" className="text-[13px] text-destructive">
              {tierErr}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => set({ tiers: addTier(f.tiers) })}
          >
            Agregar tramo
          </Button>
        </Card>
      </div>

      <ResetCard
        pct={f.reset_pct}
        floor={f.reset_floor}
        onPct={(v) => set({ reset_pct: v })}
        onFloor={(v) => set({ reset_floor: v })}
      />
    </div>
  )
}

function Field({
  id,
  label,
  help,
  suffix,
  children,
}: {
  id: string
  label: string
  help?: string
  suffix?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <span className="flex items-center gap-2">
        {children}
        {suffix && (
          <span className="text-sm text-muted-foreground">{suffix}</span>
        )}
      </span>
      {help && <span className="text-xs text-muted-foreground">{help}</span>}
    </div>
  )
}

/** Reinicio de los nivel 10, con la prueba en el navegador (contrato: sin consultar a la API). */
function ResetCard({
  pct,
  floor,
  onPct,
  onFloor,
}: {
  pct: number
  floor: number
  onPct: (v: number) => void
  onFloor: (v: number) => void
}) {
  const id = useId()
  const [probe, setProbe] = useState("2540")
  const raw = probe.trim()
  const isNumber = /^\d+$/.test(raw)
  const nick = useDebouncedValue(isNumber ? "" : raw, 300)
  const players = useQuery(pickPlayerOptions(nick))
  const found = isNumber ? null : players.data?.items[0]
  const elo = isNumber ? Number(raw) : (found?.elo ?? null)
  const ok = pct >= 0 && floor >= 0
  const after = elo === null || !ok ? null : resetElo(elo, pct, floor)
  const note =
    elo === null
      ? raw && !isNumber && !players.isFetching
        ? "Ningún jugador con ese nombre."
        : ""
      : after === elo
        ? "Está debajo del piso: no cambia."
        : `${found ? `${found.alias}, con su ELO de hoy. ` : ""}Pierde ${elo - (after ?? elo)} de ELO.`

  return (
    <Card className="min-w-0 flex-[1_1_360px] gap-3.5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[17px] font-bold">Reinicio de los nivel 10</h2>
        <span className="text-[13px] leading-relaxed text-muted-foreground">
          Al cerrar, quien esté sobre el piso conserva este porcentaje de lo que
          tiene por encima. Debajo del piso no cambia.
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <span className="flex justify-between text-sm font-medium">
          <span id={`${id}-pl`}>Conserva</span>
          <span className="font-mono">{pct} %</span>
        </span>
        <Slider
          aria-labelledby={`${id}-pl`}
          min={0}
          max={100}
          step={1}
          value={[Math.max(0, pct)]}
          onValueChange={([v]) => onPct(v)}
        />
      </div>
      <div className="flex items-center gap-2.5">
        <Label htmlFor={`${id}-f`} className="flex-1">
          Piso
        </Label>
        <Input
          id={`${id}-f`}
          type="number"
          min={0}
          max={10000}
          value={shown(floor)}
          onChange={(e) => onFloor(num(e.target.value))}
          className="w-24 font-mono"
        />
      </div>
      <div className="flex flex-col gap-2 rounded-lg bg-muted p-3.5">
        <Label
          htmlFor={`${id}-p`}
          className="text-xs font-normal text-muted-foreground"
        >
          Prueba con un ELO o un jugador
        </Label>
        <Input
          id={`${id}-p`}
          value={probe}
          placeholder="2540 o un nick"
          onChange={(e) => setProbe(e.target.value)}
          className="bg-card"
        />
        <span className="font-mono text-2xl font-bold" aria-live="polite">
          {elo ?? "—"} <span className="text-muted-foreground">→</span>{" "}
          {after ?? "—"}
        </span>
        <span className="text-xs text-muted-foreground">{note}</span>
      </div>
      {ok && (
        <ul className="grid grid-cols-2 gap-1.5">
          {[2540, 2200, 2010, 1990].map((e) => (
            <li
              key={e}
              className="rounded-md border px-2 py-1.5 font-mono text-[13px]"
            >
              {e} → {resetElo(e, pct, floor)}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
