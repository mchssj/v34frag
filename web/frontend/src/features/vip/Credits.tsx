import { cn } from "cn"
import { HeartIcon } from "lucide-react"

import { PlayerAvatar } from "@/features/ranking/parts"
import { VipBadge } from "@/features/shop/cosmetics"

import { RANK_PLAYERS } from "./demo"

// Página de créditos con los VIP (docs/bitacora/2026-10-29-creditos en kyan/pruebas). Los VIP aparecen por
// cuántos meses llevan; el que no quiere aparecer lo apaga en su configuración.

const TEAM = [
  { name: "Kyan", role: "Ideas, diseño y prototipos" },
  { name: "Daniel", role: "Backend, servidores y plugins del juego" },
  { name: "Esteban (Killuaz)", role: "Frontend y perfil de jugador" },
]

/** Hace al menos un año que es VIP. */
const FOUNDER = 12

export function Credits({
  me,
}: {
  me: { nick: string; months: number; show: boolean } | null
}) {
  const vips = RANK_PLAYERS.filter((p) => p.vip).map((p) => ({
    nick: p.nick,
    months: p.vip_months,
  }))
  if (me?.show) vips.push({ nick: me.nick, months: me.months })
  vips.sort((a, b) => b.months - a.months || a.nick.localeCompare(b.nick))
  const founders = vips.filter((v) => v.months >= FOUNDER)
  const rest = vips.filter((v) => v.months < FOUNDER)

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Hecho por</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {TEAM.map((t) => (
            <li
              key={t.name}
              className="flex flex-col gap-0.5 rounded-xl border bg-card p-[18px] shadow-[0_1px_2px_rgb(0_0_0/.04)]"
            >
              <span className="text-[15px] font-semibold">{t.name}</span>
              <span className="text-[13px] text-muted-foreground">
                {t.role}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-semibold">
            <HeartIcon
              aria-hidden
              className="size-4 fill-primary text-primary"
            />
            Gracias a los VIP
          </h2>
          <p className="text-sm text-muted-foreground">
            Gracias a ellos los servidores siguen prendidos. Están ordenados por
            cuánto tiempo nos bancan.
          </p>
        </div>
        {founders.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-[0.4px] text-amber-500 uppercase dark:text-amber-400">
              Más de un año
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {founders.map((v) => (
                <Supporter key={v.nick} {...v} big mine={v.nick === me?.nick} />
              ))}
            </ul>
          </div>
        )}
        <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-5">
          {rest.map((v) => (
            <Supporter key={v.nick} {...v} mine={v.nick === me?.nick} />
          ))}
        </ul>
      </section>
    </div>
  )
}

function Supporter({
  nick,
  months,
  big,
  mine,
}: {
  nick: string
  months: number
  big?: boolean
  mine?: boolean
}) {
  const when = months === 1 ? "1 mes" : `${months} meses`
  return big ? (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card p-3",
        mine && "border-primary"
      )}
    >
      <PlayerAvatar
        alias={nick}
        photo={null}
        className="size-9 ring-2 ring-amber-400 ring-offset-2 ring-offset-background"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{nick}</span>
        <span className="text-xs text-muted-foreground">
          VIP desde hace {when}
        </span>
      </span>
      <VipBadge />
    </li>
  ) : (
    <li
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
        mine && "bg-primary/10 font-semibold"
      )}
    >
      <VipBadge className="h-[1.2em]" />
      <span className="flex-1 truncate">{nick}</span>
      <span className="font-mono text-xs text-muted-foreground">{when}</span>
    </li>
  )
}
