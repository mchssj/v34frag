import { cn } from "cn"
import { ClockIcon, MedalIcon, SparklesIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Box } from "@/features/home/components/Box"
import { Medal } from "@/features/medals/Medal"
import { defaultLook, templateOf } from "@/features/medals/templates"
import type { SeasonRecap } from "./data"
import { fmt } from "./hints"

// Lo que avisa del recap (plan docs/bitacora/2026-11-14-recap-temporada): el aviso "por llegar" (recap_soon, 3 días
// antes del cierre), el de "llegó" (season_closed con texto nuevo) y la tarjeta de "Para ti" en los dos momentos.

export type Stage = "soon" | "ready"

const dayLabel = (d: Date) =>
  d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })

/** Cuenta regresiva hasta el cierre: "2 d 14 h 05 min". */
function useCountdown(to: Date) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const ms = Math.max(0, to.getTime() - now)
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return { d, h, m, now }
}

// ---------- Avisos ----------

/** Una fila con el mismo aspecto que las del menú de avisos. */
function Row({
  icon,
  title,
  body,
  ago,
  unread,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  body: string
  ago: string
  unread?: boolean
  onClick?: () => void
}) {
  return (
    <li className={cn("border-b px-4 py-3 last:border-b-0", unread && "bg-primary/5")}>
      <button type="button" onClick={onClick} className="flex w-full items-start gap-3 rounded-md text-left">
        {icon}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>{title}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{ago}</span>
          </span>
          <span className="text-xs text-muted-foreground">{body}</span>
        </span>
        {unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
      </button>
    </li>
  )
}

export function RecapNotices({ r, stage, onOpen }: { r: SeasonRecap; stage: Stage; onOpen: () => void }) {
  const tpl = r.final.medal ? templateOf(r.final.medal.template) : undefined
  const ready = stage === "ready"
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-md">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-sm font-semibold">Notificaciones</span>
        <span className="text-xs text-muted-foreground">Temporadas</span>
      </div>
      <ul>
        {ready && (
          <Row
            unread
            onClick={onOpen}
            icon={
              tpl ? (
                <Medal look={defaultLook(tpl)} size={32} title={r.final.medal!.name} />
              ) : (
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/16 text-primary">
                  <SparklesIcon className="size-4" />
                </span>
              )
            }
            title={`Llegó tu recap de la ${r.season.name}`}
            body={
              r.final.eligible && r.final.rank
                ? `Terminaste ${r.final.rank}.º${r.final.medal ? ` · ${r.final.medal.name}` : ""}. Tocá para ver tu temporada.`
                : `${r.mixes.matches} mixes y ${fmt(r.numbers.kills)} kills. Tocá para ver tu temporada.`
            }
            ago="ahora"
          />
        )}
        <Row
          unread={!ready}
          icon={
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/16 text-primary">
              <ClockIcon className="size-4" />
            </span>
          }
          title={`Tu recap de la ${r.season.name} llega en 3 días`}
          body={`Llevás ${r.mixes.matches} mixes. Todavía podés sumar antes del cierre.`}
          ago={ready ? "hace 3 d" : "ahora"}
        />
        <Row
          icon={
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
              <MedalIcon className="size-4" />
            </span>
          }
          title="Ya tienes puesto en la temporada"
          body={`Llegaste a 20 mixes en la temporada.`}
          ago="hace 9 d"
        />
      </ul>
    </div>
  )
}

// ---------- Para ti ----------

export function RecapHomeCard({
  r,
  stage,
  endsAt,
  onOpen,
}: {
  r: SeasonRecap
  stage: Stage
  endsAt: Date
  onOpen: () => void
}) {
  return stage === "soon" ? <Soon r={r} endsAt={endsAt} /> : <Ready r={r} onOpen={onOpen} />
}

function Soon({ r, endsAt }: { r: SeasonRecap; endsAt: Date }) {
  const { d, h, m, now } = useCountdown(endsAt)
  const start = new Date(`${r.season.starts_at}T00:00:00`).getTime()
  const done = Math.min(100, ((now - start) / (endsAt.getTime() - start)) * 100)
  return (
    <Box
      title={
        <>
          <SparklesIcon className="size-4 text-primary" /> Tu recap está en camino
        </>
      }
      label="Tu recap está en camino"
      sub={`Llega cuando cierre la ${r.season.name}`}
      aside={
        <Badge variant="soft" shape="pill" className="font-mono">
          {d > 0 ? `${d} d` : `${h} h`}
        </Badge>
      }
    >
      <div className="flex flex-col gap-4 px-4 pb-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            [d, "días"],
            [h, "horas"],
            [m, "min"],
          ].map(([v, l]) => (
            <div key={l} className="flex flex-col rounded-lg border bg-muted/40 py-2">
              <span className="font-mono text-2xl font-semibold tabular-nums">{String(v).padStart(2, "0")}</span>
              <span className="text-[11px] text-muted-foreground">{l}</span>
            </div>
          ))}
        </div>
        {/* Adelanto borroso: se ve que hay datos, pero no cuáles. */}
        <div className="relative overflow-hidden rounded-lg border">
          <div aria-hidden className="grid grid-cols-3 gap-2 p-3 blur-[6px] select-none">
            {["Mixes", "K/D", "ELO"].map((l) => (
              <div key={l} className="flex flex-col">
                <span className="text-[11px] text-muted-foreground">{l}</span>
                <span className="font-mono text-lg font-semibold">8,88</span>
              </div>
            ))}
          </div>
          <span className="absolute inset-0 grid place-items-center text-xs font-medium text-muted-foreground">
            Se revela el {dayLabel(endsAt)}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{r.season.name}</span>
            <span className="font-mono tabular-nums">{Math.round(done)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${done}%` }} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Llevás {r.mixes.matches} mixes. Cada mix que jugues hasta el cierre entra en tu recap.
        </p>
      </div>
    </Box>
  )
}

function Ready({ r, onOpen }: { r: SeasonRecap; onOpen: () => void }) {
  const tpl = r.final.medal ? templateOf(r.final.medal.template) : undefined
  const played = r.record.wins + r.record.losses
  const wr = played ? Math.round((r.record.wins / played) * 100) : 0
  const delta = r.elo.end - r.elo.start
  return (
    <Box
      title={
        <>
          <SparklesIcon className="size-4 text-primary" /> Llegó tu recap
        </>
      }
      label="Llegó tu recap"
      sub={`${r.season.name} · disponible en Para ti por 14 días`}
      aside={
        <Badge variant="soft" shape="pill">
          Nuevo
        </Badge>
      }
    >
      <div className="flex flex-col gap-4 px-4 pb-4">
        <div className="relative isolate flex items-center gap-4 overflow-hidden rounded-xl border bg-neutral-950 p-4 text-white">
          <span
            aria-hidden
            className="absolute inset-0 -z-10 [background:radial-gradient(120%_120%_at_0%_0%,color-mix(in_oklch,var(--primary)_45%,transparent),transparent_60%)]"
          />
          {tpl ? (
            <Medal look={defaultLook(tpl)} size={64} title={r.final.medal!.name} />
          ) : (
            <span className="grid size-16 place-items-center rounded-full bg-white/10">
              <SparklesIcon className="size-7" />
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            <span className="text-xs font-semibold tracking-[1.5px] text-primary uppercase">{r.season.name}</span>
            <span className="font-mono text-3xl font-semibold tabular-nums">
              {r.final.eligible && r.final.rank ? `#${r.final.rank}` : `${r.mixes.matches} mixes`}
            </span>
            <span className="text-xs text-white/70">
              {r.final.eligible && r.final.rank ? `de ${r.final.total_ranked}${r.final.medal ? ` · ${r.final.medal.name}` : ""}` : "No clasificaste"}
            </span>
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini label="ELO" value={`${delta >= 0 ? "+" : "−"}${fmt(Math.abs(delta))}`} tone={delta >= 0 ? "text-win" : "text-destructive"} />
          <Mini label="Victorias" value={`${wr}%`} />
          <Mini label="Kills" value={fmt(r.numbers.kills)} />
        </div>
        <Button className="w-full" onClick={onOpen}>
          <SparklesIcon /> Ver tu recap
        </Button>
      </div>
    </Box>
  )
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col rounded-lg border bg-muted/40 py-2">
      <span className={cn("font-mono text-lg font-semibold tabular-nums", tone)}>{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}
