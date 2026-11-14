import { createFileRoute, notFound } from "@tanstack/react-router"
import { cn } from "cn"
import { SparklesIcon } from "lucide-react"
import { useState } from "react"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Medal } from "@/features/medals/Medal"
import { defaultLook, templateOf } from "@/features/medals/templates"
import { RECAP_CASUAL, RECAP_TOP, type SeasonRecap } from "./-demo-recap/data"
import { RecapViewer } from "./-demo-recap/RecapViewer"
import { RecapHomeCard, RecapNotices, type Stage } from "./-demo-recap/notices"
import { Segmented } from "@/components/brand/Segmented"

// Prototipo del recap de temporada (plan docs/bitacora/2026-11-14-recap-temporada) con datos inventados.
// Solo en `pnpm dev`: en producción la ruta no existe.
export const Route = createFileRoute("/demo/recap")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoRecap,
})

const SEASONS: { recap: SeasonRecap; best?: boolean }[] = [
  { recap: RECAP_TOP, best: true },
  {
    recap: {
      ...RECAP_CASUAL,
      player: RECAP_TOP.player,
      season: { number: 2, name: "Temporada 2", starts_at: "2026-09-01", closed_at: "2026-09-30", players: 168 },
    },
  },
]

// En la demo la temporada "cierra" dentro de 2 días y 14 horas, para ver la cuenta regresiva.
const ENDS_AT = new Date(Date.now() + (2 * 24 + 14) * 3_600_000)

function DemoRecap() {
  const [open, setOpen] = useState<SeasonRecap | null>(null)
  const [stage, setStage] = useState<Stage>("ready")
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
        <span className="mr-2 font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
          Demo
        </span>
        <span className="text-xs text-muted-foreground">Abrir directo:</span>
        <Button size="xs" variant="outline" onClick={() => setOpen(RECAP_TOP)}>
          Top 10 (con rivales)
        </Button>
        <Button size="xs" variant="outline" onClick={() => setOpen(RECAP_CASUAL)}>
          No clasificó (sin rivales)
        </Button>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Momento:</span>
          <Segmented
            size="sm"
            label="Momento del recap"
            value={stage}
            options={[
              { value: "soon", label: "Por llegar" },
              { value: "ready", label: "Llegó" },
            ]}
            onChange={setStage}
          />
        </span>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold">Avisos y Para ti</h1>
          <p className="text-sm text-muted-foreground">
            {stage === "soon"
              ? "3 días antes del cierre llega el aviso y aparece la tarjeta con la cuenta regresiva."
              : "Al cerrar la temporada llega el aviso y la tarjeta queda 14 días en Para ti."}
          </p>
        </div>
        <div className="grid items-start gap-4 md:grid-cols-2">
          <RecapNotices r={RECAP_TOP} stage={stage} onOpen={() => setOpen(RECAP_TOP)} />
          <RecapHomeCard r={RECAP_TOP} stage={stage} endsAt={ENDS_AT} onOpen={() => setOpen(RECAP_TOP)} />
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold">Perfil › Temporadas</h1>
        <p className="text-sm text-muted-foreground">
          Así quedaría la pestaña con el botón "Recap" en cada temporada cerrada.
        </p>
      </section>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] content-start gap-3 pt-2.5">
        {SEASONS.map(({ recap, best }) => (
          <SeasonCard key={recap.season.number} r={recap} best={!!best} onRecap={() => setOpen(recap)} />
        ))}
      </div>

      {open && <RecapViewer recap={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

// Copia simplificada de la tarjeta de SeasonsTab, para ver dónde va el botón.
function SeasonCard({ r, best, onRecap }: { r: SeasonRecap; best: boolean; onRecap: () => void }) {
  const played = r.record.wins + r.record.losses
  const wr = played ? Math.round((r.record.wins / played) * 100) : 0
  const tpl = r.final.medal ? templateOf(r.final.medal.template) : undefined
  return (
    <Card
      variant="outline"
      className={cn("relative flex flex-col gap-3.5 p-4", best && "border-amber-400/70 ring-3 ring-amber-400/15")}
    >
      {best && (
        <span className="absolute -top-[11px] left-3.5 inline-flex h-[22px] items-center gap-1 rounded-full bg-amber-400 px-2 text-[11px] font-semibold text-amber-950 shadow-[0_0_0_3px_var(--background)]">
          ★ Mejor temporada
        </span>
      )}
      <div className="flex items-center gap-3">
        {tpl ? (
          <Medal look={defaultLook(tpl)} size={52} title={r.final.medal!.name} />
        ) : (
          <span aria-hidden className="grid size-[52px] shrink-0 place-items-center rounded-full border bg-muted text-lg text-muted-foreground">
            —
          </span>
        )}
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold">{r.season.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {r.final.medal ? `Medalla: ${r.final.medal.name}` : "Sin medalla"}
          </span>
        </span>
        <span className="ml-auto flex shrink-0 flex-col items-end">
          {r.final.eligible && r.final.rank !== null ? (
            <>
              <span className="font-mono text-2xl leading-none font-semibold tracking-[-0.5px] tabular-nums">
                #{r.final.rank}
              </span>
              <span className="text-[11px] text-muted-foreground">Puesto final</span>
            </>
          ) : (
            <Badge variant="muted" shape="pill" size="md" className="text-[11px] font-semibold">
              No clasificó
            </Badge>
          )}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <Kv label="ELO final">{r.elo.end}</Kv>
        <Kv label="Pico">{r.elo.peak}</Kv>
        <Kv label="Nivel">
          <LevelBadge level={r.final.level} size={22} />
        </Kv>
      </dl>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {r.mixes.matches} mixes · <b className="font-semibold text-win">{r.record.wins} V</b> –{" "}
            <b className="font-semibold text-destructive">{r.record.losses} D</b>
          </span>
          <span className="font-mono tabular-nums">{wr}%</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
          <span className="bg-win" style={{ width: `${wr}%` }} />
          <span className="bg-destructive/70" style={{ width: `${100 - wr}%` }} />
        </div>
      </div>
      <Button variant="outline" className="w-full" onClick={onRecap}>
        <SparklesIcon /> Recap
      </Button>
    </Card>
  )
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11.5px] text-muted-foreground">{label}</dt>
      <dd className="font-mono text-[15px] font-semibold tabular-nums">{children}</dd>
    </div>
  )
}
