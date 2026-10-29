import { cn } from "cn"
import {
  CheckIcon,
  CrownIcon,
  Gamepad2Icon,
  GiftIcon,
  GlobeIcon,
  LockIcon,
  TargetIcon,
  UsersIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { VipBadge } from "@/features/shop/cosmetics"

import {
  DIFFICULTY_LABEL,
  rewardOf,
  titleOf,
  WEEK_BONUS,
  type Area,
  type Mission,
} from "./catalog"
import type { MissionsDemo } from "./demo"
import { weekEnd, weekStart } from "./rotation"

// Popout y página de misiones semanales (docs/bitacora/2026-10-29-misiones-semanales en kyan/pruebas).

const AREA_ICON: Record<Area, typeof GlobeIcon> = {
  juego: Gamepad2Icon,
  web: GlobeIcon,
  comunidad: UsersIcon,
}
const DIFF_CLASS = {
  facil: "text-win",
  media: "text-amber-500 dark:text-amber-400",
  dificil: "text-primary",
} as const

export function timeLeft(week: number, now: number) {
  const ms = Math.max(0, weekEnd(week) - now)
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  return d > 0 ? `${d} d ${h} h` : `${h} h`
}
const fmtDay = (t: number) =>
  new Date(t).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
export const weekRange = (w: number) =>
  `${fmtDay(weekStart(w))} al ${fmtDay(weekEnd(w) - 1)}`

function Reward({ m }: { m: Mission }) {
  return m.vip ? (
    <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs font-semibold whitespace-nowrap text-amber-500 dark:text-amber-400">
      +{rewardOf(m)} <VipBadge className="h-[1.1em]" />
    </span>
  ) : (
    <span className="font-mono text-xs font-semibold whitespace-nowrap text-foreground">
      +{rewardOf(m)} pts
    </span>
  )
}

export function MissionRow({
  m,
  d,
  compact,
}: {
  m: Mission
  d: MissionsDemo
  compact?: boolean
}) {
  const Icon = AREA_ICON[m.area]
  const value = d.valueOf(m)
  const done = value >= m.target
  const claimed = d.claimed.includes(m.id)
  const locked = m.vip && !d.vip
  const claim = () => {
    const r = d.claim(m)
    if (r) toast.success(`+${r} ${m.vip ? "monedas VIP" : "puntos"}`)
  }
  return (
    <li
      className={cn(
        "flex items-center gap-3",
        compact ? "py-2.5" : "rounded-xl border bg-card p-3.5",
        claimed && "opacity-60"
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg bg-muted",
          locked && "opacity-50"
        )}
      >
        <Icon aria-hidden className="size-4 text-muted-foreground" />
      </span>
      <span
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-1.5",
          locked && "blur-[2.5px] select-none"
        )}
        aria-hidden={locked}
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[13px] font-medium">{titleOf(m)}</span>
          <Reward m={m} />
        </span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className={cn(
                "block h-full rounded-full transition-[width]",
                done ? "bg-win" : m.vip ? "bg-amber-400" : "bg-primary"
              )}
              style={{ width: `${(value / m.target) * 100}%` }}
            />
          </span>
          <span className="w-16 text-right font-mono text-[11px] text-muted-foreground tabular-nums">
            {value.toLocaleString("es-AR")}/{m.target.toLocaleString("es-AR")}
          </span>
        </span>
        {!compact && (
          <span
            className={cn(
              "text-[11px] font-semibold",
              DIFF_CLASS[m.difficulty]
            )}
          >
            {DIFFICULTY_LABEL[m.difficulty]}
          </span>
        )}
      </span>
      {locked ? (
        <LockIcon
          aria-label="Solo VIP"
          className="size-4 shrink-0 text-muted-foreground"
        />
      ) : claimed ? (
        <CheckIcon
          aria-label="Reclamada"
          className="size-4 shrink-0 text-win"
        />
      ) : done ? (
        <Button
          size="sm"
          className="h-7 shrink-0 px-2.5 text-xs"
          onClick={claim}
        >
          Reclamar
        </Button>
      ) : null}
    </li>
  )
}

function BonusBar({ d }: { d: MissionsDemo }) {
  const n = d.normal.filter(d.done).length
  const claim = () =>
    d.claimBonus() && toast.success(`¡Semana completa! +${WEEK_BONUS} puntos`)
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
      <GiftIcon
        aria-hidden
        className={cn(
          "size-4 shrink-0",
          d.allNormalDone ? "text-primary" : "text-muted-foreground"
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs">
          Completá las {d.normal.length}: <b>+{WEEK_BONUS} pts</b> de bonus
        </span>
        <span className="h-1 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${(n / d.normal.length) * 100}%` }}
          />
        </span>
      </span>
      <span className="font-mono text-xs tabular-nums">
        {n}/{d.normal.length}
      </span>
      {d.allNormalDone &&
        (d.bonusClaimed ? (
          <CheckIcon aria-label="Bonus reclamado" className="size-4 text-win" />
        ) : (
          <Button size="sm" className="h-7 px-2.5 text-xs" onClick={claim}>
            Reclamar
          </Button>
        ))}
    </div>
  )
}

function VipHeader({ d }: { d: MissionsDemo }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.4px] text-amber-500 uppercase dark:text-amber-400">
      <VipBadge className="h-[1.3em]" />
      Misiones VIP
      {!d.vip && (
        <span className="ml-auto font-normal tracking-normal text-muted-foreground normal-case">
          Con VIP, 3 más por semana
        </span>
      )}
    </span>
  )
}

/** El botón de la barra de arriba con el popout. */
export function MissionsPopout({
  d,
  onOpenPage,
}: {
  d: MissionsDemo
  onOpenPage: () => void
}) {
  const n = d.claimable.length
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label={`Misiones semanales${n ? `, ${n} para reclamar` : ""}`}
        >
          <TargetIcon aria-hidden />
          {n > 0 && (
            <span className="absolute -top-1.5 -right-1.5 grid size-[18px] place-items-center rounded-full bg-primary font-mono text-[10px] font-bold text-primary-foreground">
              {n}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-baseline justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Misiones semanales</span>
          <span className="text-xs text-muted-foreground">
            Se renuevan en {timeLeft(d.week, d.now)}
          </span>
        </div>
        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto px-4 py-3">
          <BonusBar d={d} />
          <ul className="divide-y">
            {d.normal.map((m) => (
              <MissionRow key={m.id} m={m} d={d} compact />
            ))}
          </ul>
          <VipHeader d={d} />
          <ul className="divide-y">
            {d.vipMissions.map((m) => (
              <MissionRow key={m.id} m={m} d={d} compact />
            ))}
          </ul>
        </div>
        <div className="border-t px-4 py-2.5">
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs"
            onClick={onOpenPage}
          >
            Ver todas y las semanas anteriores →
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Section({
  title,
  right,
  children,
}: {
  title: ReactNode
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

/** La página de Misiones: la semana completa y el historial. */
export function MissionsPage({ d }: { d: MissionsDemo }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
        <TargetIcon aria-hidden className="size-4 text-primary" />
        <span>
          Semana del {weekRange(d.week)} · se renuevan en{" "}
          <b>{timeLeft(d.week, d.now)}</b> (lunes 06:00)
        </span>
        <span className="ml-auto flex gap-4 font-mono text-xs">
          <span>{d.wallet.points} pts</span>
          <span className="inline-flex items-center gap-1">
            {d.wallet.coins} <VipBadge className="h-[1.2em]" />
          </span>
        </span>
      </div>

      <Section
        title="Para todos"
        right={
          <span className="text-xs text-muted-foreground">
            2 fáciles, 3 medias y 1 difícil
          </span>
        }
      >
        <BonusBar d={d} />
        <ul className="grid gap-3 md:grid-cols-2">
          {d.normal.map((m) => (
            <MissionRow key={m.id} m={m} d={d} />
          ))}
        </ul>
      </Section>

      <Section title={<VipHeader d={d} />}>
        <ul className="grid gap-3 md:grid-cols-3">
          {d.vipMissions.map((m) => (
            <MissionRow key={m.id} m={m} d={d} />
          ))}
        </ul>
        {!d.vip && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CrownIcon aria-hidden className="size-3.5 text-amber-400" />
            Las misiones VIP pagan monedas VIP, que se usan en la tienda para
            los cosméticos VIP.
          </p>
        )}
      </Section>

      <Section title="Semanas anteriores">
        {d.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no terminó ninguna semana. Probá "Pasar a la semana
            siguiente" en la barra Demo.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {d.history.map((h) => (
              <li
                key={h.week}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <span className="w-40 text-muted-foreground">
                  {weekRange(h.week)}
                </span>
                <span className="flex-1">
                  {h.done} de {h.total} completas
                </span>
                <span className="font-mono text-xs">+{h.points} pts</span>
                {h.coins > 0 && (
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-amber-500">
                    +{h.coins} <VipBadge className="h-[1.1em]" />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
