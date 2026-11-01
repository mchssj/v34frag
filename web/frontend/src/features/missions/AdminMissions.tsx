import { cn } from "cn"
import { AlertTriangleIcon } from "lucide-react"
import { useState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  AREA_LABEL,
  COOLDOWN_WEEKS,
  DIFFICULTY_LABEL,
  FIRST_STEPS,
  isReady,
  METRICS,
  MISSIONS,
  rewardOf,
  titleOf,
  type MetricSource,
  type Mission,
} from "./catalog"
import { weekRange } from "./MissionsUi"
import { minimumPool, rotation } from "./rotation"

// Admin → Misiones (docs/bitacora/2026-10-29-misiones-semanales en kyan/pruebas): el catálogo editable y
// la rotación de las próximas semanas, para ver el efecto de un cambio antes de guardarlo.

const SOURCE: Record<MetricSource, { label: string; className: string }> = {
  plugin: { label: "Plugin 1.8", className: "bg-win/15 text-win" },
  web: {
    label: "Web",
    className: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  plugin_v2: {
    label: "Plugin nuevo",
    className: "bg-amber-400/15 text-amber-600 dark:text-amber-400",
  },
  sistema: {
    label: "Falta sistema",
    className: "bg-muted text-muted-foreground",
  },
}
const head = "h-auto py-2.5 text-xs font-medium text-muted-foreground"
const AHEAD = 8

export function AdminMissions({ fromWeek }: { fromWeek: number }) {
  const [catalog, setCatalog] = useState<Mission[]>(() => [
    ...MISSIONS,
    ...FIRST_STEPS,
  ])
  const [v2, setV2] = useState(false)
  const [focus, setFocus] = useState<string | null>(null)
  const ready: MetricSource[] = v2
    ? ["plugin", "plugin_v2", "web"]
    : ["plugin", "web"]
  const weeks = rotation(catalog, fromWeek + AHEAD - 1, fromWeek, ready)
  const min = minimumPool()
  const edit = (id: string, patch: Partial<Mission>) =>
    setCatalog((c) => c.map((m) => (m.id === id ? { ...m, ...patch } : m)))

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Switch id="adm-v2" size="sm" checked={v2} onCheckedChange={setV2} />
        <Label htmlFor="adm-v2" className="font-normal">
          Simular el plugin nuevo (schema 2: kills por arma, clutchs, pistolas,
          ecos, bombas explotadas)
        </Label>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Alcanzan las semanales</h2>
        <p className="text-xs text-muted-foreground">
          Con {COOLDOWN_WEEKS} semanas de espera, cada dificultad necesita por
          lo menos {COOLDOWN_WEEKS + 1} veces las que salen por semana.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {(["normal", "vip"] as const).flatMap((g) =>
            (["facil", "media", "dificil"] as const).map((diff) => {
              const have = catalog.filter(
                (m) =>
                  !m.once &&
                  isReady(m, ready) &&
                  m.vip === (g === "vip") &&
                  m.difficulty === diff
              ).length
              const ok = have >= min[g][diff]
              return (
                <div
                  key={g + diff}
                  className={cn(
                    "rounded-xl border bg-card px-3 py-2",
                    !ok && "border-destructive"
                  )}
                >
                  <p className="text-xs text-muted-foreground">
                    {g === "vip" ? "VIP" : "Para todos"} ·{" "}
                    {DIFFICULTY_LABEL[diff]}
                  </p>
                  <p className="font-mono text-lg font-semibold">
                    {have}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      / mín. {min[g][diff]}
                    </span>
                  </p>
                </div>
              )
            })
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold">Próximas {AHEAD} semanas</h2>
          <p className="text-xs text-muted-foreground">
            Tocá una misión para ver en qué semanas sale.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {weeks.map((w) => (
            <div
              key={w.week}
              className="flex flex-col gap-1.5 rounded-xl border bg-card px-3 py-2.5"
            >
              <span className="text-xs font-semibold text-muted-foreground">
                Semana {w.week + 1} · {weekRange(w.week)}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {w.missions.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setFocus((f) => (f === m.id ? null : m.id))}
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-xs",
                      m.vip && "border-amber-400/50",
                      focus === m.id &&
                        "border-primary bg-primary text-primary-foreground",
                      focus && focus !== m.id && "opacity-40"
                    )}
                  >
                    {titleOf(m)}
                  </button>
                ))}
              </div>
              {w.warnings.map((x) => (
                <span
                  key={x}
                  className="flex items-center gap-1 text-xs text-destructive"
                >
                  <AlertTriangleIcon aria-hidden className="size-3.5" />
                  {x}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold">
            Catálogo ({catalog.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            Los cambios se ven arriba al instante. Las que esperan datos del
            plugin nuevo o de otro sistema quedan guardadas y entran solas
            cuando los datos existan. Las de Primeros pasos (las de la web) no
            rotan: se hacen una sola vez por cuenta.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table className="min-w-[900px] text-sm">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={cn(head, "pl-4")}>Activa</TableHead>
                <TableHead className={head}>Misión</TableHead>
                <TableHead className={head}>Área</TableHead>
                <TableHead className={head}>Dificultad</TableHead>
                <TableHead className={head}>Objetivo</TableHead>
                <TableHead className={head}>Premio</TableHead>
                <TableHead className={cn(head, "pr-4")}>Datos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalog.map((m) => {
                const src = METRICS[m.metric].source
                return (
                  <TableRow
                    key={m.id}
                    className={cn(
                      !isReady(m, ready) && "text-muted-foreground"
                    )}
                  >
                    <TableCell className="pl-4">
                      <Switch
                        size="sm"
                        aria-label={`Activa: ${titleOf(m)}`}
                        checked={m.active}
                        onCheckedChange={(v) => edit(m.id, { active: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {m.vip && (
                          <span className="rounded bg-amber-400/15 px-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            VIP
                          </span>
                        )}
                        {m.once && (
                          <span className="rounded bg-primary/15 px-1 text-[10px] font-semibold text-primary">
                            Una vez
                          </span>
                        )}
                        {titleOf(m)}
                      </span>
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {m.id}
                      </span>
                    </TableCell>
                    <TableCell>{AREA_LABEL[m.area]}</TableCell>
                    <TableCell>{DIFFICULTY_LABEL[m.difficulty]}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        aria-label={`Objetivo: ${m.id}`}
                        value={m.target}
                        onChange={(e) =>
                          edit(m.id, {
                            target: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="h-7 w-24 font-mono text-xs"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      +{rewardOf(m)} {m.vip ? "VIP" : "pts"}
                    </TableCell>
                    <TableCell className="pr-4">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[11px] font-medium",
                          SOURCE[src].className
                        )}
                        title={METRICS[m.metric].label}
                      >
                        {SOURCE[src].label}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
