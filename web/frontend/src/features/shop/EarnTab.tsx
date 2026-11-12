import { cn } from "cn"
import {
  AwardIcon,
  CalendarCheckIcon,
  CrownIcon,
  FilmIcon,
  FootprintsIcon,
  GiftIcon,
  ListChecksIcon,
  SwordsIcon,
  TrendingUpIcon,
  TrophyIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react"
import { useMemo, useState } from "react"

import { FilterChips } from "@/components/brand/FilterChips"
import { StatTile } from "@/components/brand/StatTile"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { VipBadge } from "./cosmetics"
import type { ShopDemo } from "./demo"
import { METALS, SOURCE_LABEL, type Source } from "./economy"
import { Amount, GOLD, num } from "./parts"
import type { Currency } from "./types"

export const SOURCE_ICON: Record<Source, LucideIcon> = {
  match: SwordsIcon,
  match_win: TrophyIcon,
  first_of_day: CalendarCheckIcon,
  official: SwordsIcon,
  tournament: TrophyIcon,
  medal: AwardIcon,
  season: CrownIcon,
  level_up: TrendingUpIcon,
  mission: ListChecksIcon,
  mission_vip: ListChecksIcon,
  first_steps: FootprintsIcon,
  clip_featured: FilmIcon,
  referral: UserPlusIcon,
  vip_welcome: GiftIcon,
  grant: GiftIcon,
  purchase: GiftIcon,
}

const head = "h-auto py-2.5 text-xs font-medium text-muted-foreground"

/** Cómo se ganan los puntos y las monedas VIP, con los valores de la configuración en vivo. */
export function EarnTab({ shop }: { shop: ShopDemo }) {
  const c = shop.config
  const r = c.rules
  const left = Math.max(0, c.daily_match_cap - shop.matchesToday)
  const [week] = useState(() => Date.now() - 7 * 86400_000)
  const thisWeek = (cur: Currency) =>
    shop.ledger
      .filter(
        (x) =>
          x.currency === cur &&
          x.amount > 0 &&
          x.source !== "grant" &&
          +new Date(x.at) >= week
      )
      .reduce((s, x) => s + x.amount, 0)

  const rows: {
    icon: LucideIcon
    what: string
    when: string
    points: number
    vip: number
    off?: boolean
  }[] = [
    {
      icon: SwordsIcon,
      what: "Partida jugada",
      when: "Matchmaking o mix terminado con ELO",
      points: r.match.points,
      vip: r.match.vip,
      off: !r.match.enabled,
    },
    {
      icon: TrophyIcon,
      what: "Victoria",
      when: "Además, si ganás",
      points: r.match_win.points,
      vip: r.match_win.vip,
      off: !r.match_win.enabled,
    },
    {
      icon: CalendarCheckIcon,
      what: "Primera del día",
      when: "Además, en tu primera partida del día",
      points: r.first_of_day.points,
      vip: r.first_of_day.vip,
      off: !r.first_of_day.enabled,
    },
    {
      icon: SwordsIcon,
      what: "Partida oficial",
      when: "Partida de torneo terminada",
      points: r.official.points,
      vip: r.official.vip,
      off: !r.official.enabled,
    },
    {
      icon: TrophyIcon,
      what: "Campeón de torneo",
      when: "Cada jugador de la plantilla",
      points: c.tournament.champion.points,
      vip: c.tournament.champion.vip,
    },
    {
      icon: TrophyIcon,
      what: "Subcampeón de torneo",
      when: "Cada jugador de la plantilla",
      points: c.tournament.runnerUp.points,
      vip: c.tournament.runnerUp.vip,
    },
    {
      icon: TrendingUpIcon,
      what: "Nivel nuevo",
      when: "La primera vez que llegás a un nivel en la temporada",
      points: r.level_up.points,
      vip: r.level_up.vip,
      off: !r.level_up.enabled,
    },
    {
      icon: ListChecksIcon,
      what: "Misión semanal",
      when: "Cada misión de la semana completada",
      points: r.mission.points,
      vip: r.mission.vip,
      off: !r.mission.enabled,
    },
    {
      icon: ListChecksIcon,
      what: "Misión VIP",
      when: "Las 3 misiones extra de los VIP",
      points: r.mission_vip.points,
      vip: r.mission_vip.vip,
      off: !r.mission_vip.enabled,
    },
    {
      icon: FootprintsIcon,
      what: "Primeros pasos",
      when: "Cada paso, una sola vez",
      points: r.first_steps.points,
      vip: r.first_steps.vip,
      off: !r.first_steps.enabled,
    },
    {
      icon: FilmIcon,
      what: "Clip destacado",
      when: "Cuando un admin destaca un clip tuyo",
      points: r.clip_featured.points,
      vip: r.clip_featured.vip,
      off: !r.clip_featured.enabled,
    },
    {
      icon: UserPlusIcon,
      what: "Amigo invitado",
      when: "Cuando juega sus primeras 10 partidas",
      points: r.referral.points,
      vip: r.referral.vip,
      off: !r.referral.enabled,
    },
    {
      icon: GiftIcon,
      what: "Bienvenida VIP",
      when: "Cada mes de VIP que empieza",
      points: r.vip_welcome.points,
      vip: r.vip_welcome.vip,
      off: !r.vip_welcome.enabled,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Partidas con premio hoy"
          value={`${shop.matchesToday}/${c.daily_match_cap}`}
        >
          <Progress
            value={(shop.matchesToday / c.daily_match_cap) * 100}
            className="mt-1"
          />
          <span className="text-[11px] text-muted-foreground">
            {left
              ? `Te quedan ${left}. Se renueva a la medianoche.`
              : "Llegaste al tope de hoy. Mañana se renueva."}
          </span>
        </StatTile>
        <StatTile
          label="Puntos esta semana"
          value={`+${num(thisWeek("points"))}`}
          valueClassName="text-primary"
        />
        <StatTile
          label={
            <span className="inline-flex items-center gap-1.5">
              <VipBadge className="h-3.5" /> Monedas VIP esta semana
            </span>
          }
          value={`+${num(thisWeek("vip"))}`}
          valueClassName={GOLD}
        >
          {!shop.vip && (
            <span className="text-[11px] text-muted-foreground">
              Se ganan siendo VIP
            </span>
          )}
        </StatTile>
      </div>

      <Card
        variant="outline"
        className="overflow-hidden bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]"
      >
        <div className="flex flex-col gap-1 border-b p-4">
          <h2 className="text-sm font-semibold">De dónde salen</h2>
          <p className="text-xs text-pretty text-muted-foreground">
            Todos ganan puntos. Siendo VIP, además ganás monedas VIP con lo
            mismo: no se descuentan de los puntos. Las PCW no dan premio. Hasta{" "}
            {c.daily_match_cap} partidas por día dan premio; medallas, misiones,
            torneos y temporada no tienen tope.
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[560px] text-sm">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={cn(head, "pl-4")}>Qué</TableHead>
                <TableHead className={head}>Cuándo</TableHead>
                <TableHead className={cn(head, "text-right")}>Puntos</TableHead>
                <TableHead className={cn(head, "pr-4 text-right")}>
                  Monedas VIP
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((x) => (
                <TableRow key={x.what} className={cn(x.off && "opacity-50")}>
                  <TableCell className="pl-4 font-medium">
                    <span className="inline-flex items-center gap-2">
                      <x.icon className="size-4 text-muted-foreground" />
                      {x.what}
                      {x.off && (
                        <Badge variant="muted" shape="tag" size="xs">
                          Pronto
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {x.when}
                  </TableCell>
                  <TableCell className="text-right">
                    {x.points ? (
                      <Amount value={x.points} currency="points" />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {x.vip ? <Amount value={x.vip} currency="vip" /> : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          variant="outline"
          className="overflow-hidden bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]"
        >
          <h2 className="flex items-center gap-2 border-b p-4 text-sm font-semibold">
            <AwardIcon className="size-4 text-muted-foreground" /> Medallas,
            según el metal
          </h2>
          <ul className="divide-y text-sm">
            {METALS.map((m) => (
              <li
                key={m}
                className="flex items-center justify-between gap-2 px-4 py-2.5"
              >
                <span className="inline-flex items-center gap-2 capitalize">
                  <i className={cn("size-2.5 rounded-full", METAL_DOT[m])} />
                  {m}
                </span>
                <span className="flex gap-3">
                  <Amount value={c.medal[m].points} currency="points" />
                  <Amount value={c.medal[m].vip} currency="vip" />
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card
          variant="outline"
          className="overflow-hidden bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]"
        >
          <h2 className="flex items-center gap-2 border-b p-4 text-sm font-semibold">
            <CrownIcon className="size-4 text-muted-foreground" /> Fin de
            temporada, según el puesto
          </h2>
          <ul className="divide-y text-sm">
            {c.season.map((s, k) => {
              const from = k === 0 ? 1 : c.season[k - 1]!.upTo + 1
              return (
                <li
                  key={s.upTo}
                  className="flex items-center justify-between gap-2 px-4 py-2.5"
                >
                  <span className="font-mono tabular-nums">
                    {from === s.upTo ? `${from}.º` : `${from}.º al ${s.upTo}.º`}
                  </span>
                  <span className="flex gap-3">
                    <Amount value={s.points} currency="points" />
                    <Amount value={s.vip} currency="vip" />
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
    </div>
  )
}

const METAL_DOT = {
  bronce: "bg-[#b0703a]",
  plata: "bg-[#b8c0cc]",
  oro: "bg-[#e8b53a]",
  platino: "bg-[#8fd6e0]",
  diamante: "bg-[#7aa8ff]",
} as const

/** Historial: cada fila del registro, lo más nuevo primero. */
export function LedgerTab({ shop }: { shop: ShopDemo }) {
  const [cur, setCur] = useState<Currency | undefined>(undefined)
  const [kind, setKind] = useState<"earn" | "spend" | undefined>(undefined)
  const rows = useMemo(
    () =>
      shop.ledger.filter(
        (x) =>
          (!cur || x.currency === cur) &&
          (!kind || (kind === "earn" ? x.amount > 0 : x.amount < 0))
      ),
    [shop.ledger, cur, kind]
  )
  // Agrupado por día.
  const days = useMemo(() => {
    const m = new Map<string, typeof rows>()
    for (const x of rows) {
      const k = new Date(x.at).toLocaleDateString("es", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
      m.set(k, [...(m.get(k) ?? []), x])
    }
    return [...m]
  }, [rows])
  return (
    <Card
      variant="outline"
      className="overflow-hidden bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]"
    >
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <FilterChips
          label="Moneda"
          size="sm"
          value={cur}
          onChange={setCur}
          options={[
            { value: undefined, label: "Todo" },
            { value: "points", label: "Puntos" },
            { value: "vip", label: "Monedas VIP" },
          ]}
        />
        <FilterChips
          label="Movimiento"
          size="sm"
          value={kind}
          onChange={setKind}
          options={[
            { value: undefined, label: "Todos" },
            { value: "earn", label: "Ganado" },
            { value: "spend", label: "Gastado" },
          ]}
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} movimientos
        </span>
      </div>
      <div className="max-h-[640px] overflow-y-auto">
        {days.map(([day, list]) => (
          <section key={day}>
            <h3 className="sticky top-0 z-[1] border-b bg-muted/80 px-4 py-1.5 text-xs font-medium text-muted-foreground capitalize backdrop-blur">
              {day}
            </h3>
            <ul className="divide-y">
              {list.map((x) => {
                const Icon = SOURCE_ICON[x.source]
                return (
                  <li
                    key={x.id}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground",
                        x.amount < 0 && "bg-destructive/10 text-destructive"
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">
                        {SOURCE_LABEL[x.source]}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {x.label}
                      </span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {new Date(x.at).toLocaleTimeString("es", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <b
                      className={cn(
                        "w-24 text-right font-mono tabular-nums",
                        x.amount < 0
                          ? "text-destructive"
                          : x.currency === "vip"
                            ? GOLD
                            : "text-win"
                      )}
                    >
                      {x.amount > 0 ? "+" : ""}
                      {num(x.amount)} {x.currency === "vip" ? "VIP" : "pts"}
                    </b>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  )
}
