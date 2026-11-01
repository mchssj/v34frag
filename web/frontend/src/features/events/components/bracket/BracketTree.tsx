import { TrophyIcon } from "lucide-react"
import { useMemo } from "react"

import type { BracketColumn, BracketSection } from "../../lib/model"
import type { EventMatch } from "../../types"
import { Connectors, type Connector } from "./Connectors"
import { useBracket } from "./context"
import { MatchCard } from "./MatchCard"

const teamsOf = (m: EventMatch) =>
  [m.side1.team?.id, m.side2.team?.id].filter(Boolean)

/**
 * Líneas de cada partida a la de la ronda siguiente: si la ronda tiene la mitad de partidas, la
 * posición (pos + 1) / 2; si tiene las mismas (rondas del lower), la misma fila.
 */
function treeLinks(
  sections: BracketSection[],
  hover: string | null
): Connector[] {
  const out: Connector[] = []
  const link = (a: EventMatch, b: EventMatch) =>
    out.push({
      from: a.id,
      to: b.id,
      hot: !!hover && teamsOf(a).includes(hover) && teamsOf(b).includes(hover),
    })
  for (const s of sections)
    s.columns.forEach((col, i) => {
      const next = s.columns[i + 1]
      if (!next) return
      const ratio = col.games.length / next.games.length
      if (ratio < 1) return
      col.games.forEach((g, k) => link(g, next.games[Math.floor(k / ratio)]))
    })
  // Doble eliminación: las finales del upper y del lower van a la gran final.
  const grand = sections.find((s) => s.stage === "grand" && !s.grp)
  if (grand)
    for (const s of sections)
      if (!s.grp && (s.stage === "upper" || s.stage === "lower")) {
        const last = s.columns.at(-1)?.games.at(-1)
        const gf = grand.columns[0]?.games[0]
        if (last && gf) link(last, gf)
      }
  return out
}

/**
 * Llaves de eliminación: secciones apiladas (upper, lower…) y, a la derecha, la que termina en el
 * campeón con el 3.er puesto debajo.
 */
export function BracketTree({
  sections,
  champion,
}: {
  sections: BracketSection[]
  /** undefined: ninguna sección termina en el campeón. null: todavía por definir. */
  champion?: string | null
}) {
  const { hover } = useBracket()
  const links = useMemo(() => treeLinks(sections, hover), [sections, hover])
  const ending = (s: BracketSection) => s.final || s.stage === "third"
  const before = sections.filter((s) => !ending(s))
  const after = sections.filter(ending)

  return (
    <div className="relative flex w-max items-center gap-14">
      <Connectors links={links} />
      {[before, after].map(
        (list, i) =>
          list.length > 0 && (
            <div key={i} className="flex flex-col gap-10">
              {list.map((s) => (
                <Section
                  key={s.key}
                  section={s}
                  champion={s.final ? champion : undefined}
                />
              ))}
            </div>
          )
      )}
    </div>
  )
}

function Section({
  section,
  champion,
}: {
  section: BracketSection
  champion: string | null | undefined
}) {
  return (
    <div className="flex flex-col gap-3">
      {section.title && (
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {section.title}
        </h3>
      )}
      <div className="flex gap-14">
        {section.columns.map((c) => (
          <Column key={c.round} column={c} />
        ))}
        {champion !== undefined && (
          <div className="flex w-[180px] flex-col justify-center pt-[26px]">
            <div className="flex flex-col items-center gap-2 rounded-[calc(var(--radius)+4px)] border border-dashed bg-background p-5">
              <TrophyIcon className="size-7 text-primary" aria-hidden />
              <span className="text-xs text-muted-foreground">Campeón</span>
              <span className="text-center text-[15px] font-semibold">
                {champion ?? "Por definir"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Column({ column }: { column: BracketColumn }) {
  return (
    <div className="flex w-[232px] flex-col">
      <div className="flex justify-between gap-2 pb-2.5 text-xs font-medium text-muted-foreground">
        <span className="truncate">{column.title}</span>
        <span className="font-mono">BO{column.bo}</span>
      </div>
      <div className="flex flex-1 flex-col justify-around gap-4">
        {column.games.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  )
}
