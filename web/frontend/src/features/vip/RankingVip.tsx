import { cn } from "cn"
import { CrownIcon } from "lucide-react"
import { useState } from "react"

import { LevelBadge } from "@/components/brand/LevelBadge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fmt2 } from "@/features/ranking/labels"
import { Podium, Sparkline, coverLink } from "@/features/ranking/parts"

import { RANK_PLAYERS, type RankPlayer } from "./demo"
import { VipAvatar, VipName } from "./VipName"

// El ranking con las marcas VIP y el mini-ranking "Top VIP del mes"
// (docs/bitacora/2026-10-29-ranking-vip en kyan/pruebas). La tabla sigue a HistoricRow de PlayersRanking.

const head = "h-auto py-2.5 text-xs font-medium text-muted-foreground"
const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

/** Top VIP del mes: los VIP que más ELO ganaron en el mes, con al menos 10 mixes. */
export function topVip(list: RankPlayer[], min = 10) {
  return list
    .filter((p) => p.vip && p.month_matches >= min)
    .sort(
      (a, b) => b.month_gain - a.month_gain || b.month_matches - a.month_matches
    )
}

function TopVip({ list }: { list: RankPlayer[] }) {
  const top = topVip(list)
  const rest = top.slice(3, 10)
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-semibold">
            <CrownIcon aria-hidden className="size-4 text-amber-400" />
            Top VIP de octubre
          </h2>
          <p className="text-xs text-muted-foreground">
            Los VIP que más ELO ganaron en el mes, con al menos 10 mixes. Se
            reinicia el 1 de cada mes.
          </p>
        </div>
      </div>
      <Podium
        loading={false}
        items={top.slice(0, 3).map((p) => ({
          key: p.id,
          name: p.nick,
          sub: `${p.month_matches} mixes en el mes`,
          value: p.month_gain,
          badge: (
            <VipAvatar
              alias={p.nick}
              photo={null}
              vip
              className="size-[42px]"
            />
          ),
          link: (
            <a
              href="#"
              className={coverLink}
              onClick={(e) => e.preventDefault()}
            >
              <VipName alias={p.nick} vip verified={p.verified} />
            </a>
          ),
        }))}
      />
      {rest.length > 0 && (
        <ol
          start={4}
          className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3"
        >
          {rest.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted"
            >
              <span className="w-5 font-mono text-xs text-muted-foreground">
                {i + 4}
              </span>
              <VipName
                alias={p.nick}
                vip
                verified={p.verified}
                className="flex-1"
              />
              <span className="font-mono text-xs font-semibold text-win tabular-nums">
                {signed(p.month_gain)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export function RankingVip({ onlyVip }: { onlyVip: boolean }) {
  const [rows] = useState(() => RANK_PLAYERS)
  const shown = (onlyVip ? rows.filter((p) => p.vip) : rows).slice(0, 25)
  return (
    <div className="flex flex-col gap-6">
      <TopVip list={rows} />
      <div className="overflow-x-auto rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]">
        <Table className="min-w-[860px] text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(head, "w-14 pl-4")}>#</TableHead>
              <TableHead className={head}>Jugador</TableHead>
              <TableHead className={cn(head, "text-center")}>Nivel</TableHead>
              <TableHead className={cn(head, "text-right")}>ELO</TableHead>
              <TableHead className={head}>Equipo</TableHead>
              <TableHead className={cn(head, "text-center")}>Rating</TableHead>
              <TableHead className={cn(head, "text-center")}>K/D</TableHead>
              <TableHead className={cn(head, "text-right")}>Partidas</TableHead>
              <TableHead className={cn(head, "pr-4 text-right")}>
                Últimos 30
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((p) => (
              <TableRow
                key={p.id}
                className={cn("hover:bg-muted", p.vip && "bg-amber-400/[0.04]")}
              >
                <TableCell className="pl-4 font-mono text-[13px] font-semibold text-muted-foreground">
                  {p.position}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2.5">
                    <VipAvatar alias={p.nick} photo={null} vip={p.vip} />
                    <span className="flex min-w-0 flex-col leading-tight">
                      <VipName
                        alias={p.nick}
                        vip={p.vip}
                        verified={p.verified}
                      />
                      <span className="text-xs text-muted-foreground">
                        {p.country}
                      </span>
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <LevelBadge level={p.level} size={24} className="mx-auto" />
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">
                  {p.elo}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.team_tag ?? "—"}
                </TableCell>
                <TableCell className="text-center font-mono tabular-nums">
                  {fmt2(p.rating)}
                </TableCell>
                <TableCell className="text-center font-mono tabular-nums">
                  {fmt2(p.kd)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                  {p.matches}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Sparkline values={p.trend} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
