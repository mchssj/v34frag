import { cn } from "cn"
import { ChevronDownIcon } from "lucide-react"
import { useState } from "react"

import { Card } from "@/components/ui/card"
import { groupLetter, STAGE_TITLE, type BracketSection } from "../../lib/model"
import type { Standing } from "../../types"
import { BracketTree } from "./BracketTree"

/** Grupos de doble eliminación: una tarjeta por grupo con su upper y su lower. */
export function GroupsDoublePhase({
  sections,
  standings,
  advance,
}: {
  sections: BracketSection[]
  standings: Standing[]
  advance: number
}) {
  const groups = new Map<number, BracketSection[]>()
  for (const s of sections)
    if (s.grp) groups.set(s.grp, [...(groups.get(s.grp) ?? []), s])
  return (
    <div className="flex w-max flex-col gap-5">
      {[...groups.entries()]
        .sort(([a], [b]) => a - b)
        .map(([grp, list]) => (
          <GroupCard
            key={grp}
            grp={grp}
            sections={list}
            teams={
              standings.filter(
                (r) => r.stage === "group_double" && r.grp === grp
              ).length
            }
            advance={advance}
          />
        ))}
    </div>
  )
}

function GroupCard({
  grp,
  sections,
  teams,
  advance,
}: {
  grp: number
  sections: BracketSection[]
  teams: number
  advance: number
}) {
  const [open, setOpen] = useState(true)
  const title = `Grupo ${groupLetter(grp)}`
  const bo = sections[0]?.columns[0]?.bo
  const info = [
    teams > 0 && `${teams} equipos`,
    `clasifican ${advance}`,
    bo && `BO${bo}`,
  ]
    .filter(Boolean)
    .join(" · ")
  // Dentro de la tarjeta, cada sección se titula solo "Upper" o "Lower".
  const titled = sections.map((s) => ({
    ...s,
    title: STAGE_TITLE[s.stage],
    // "Upper · ronda 1" → "Ronda 1"; "Final del upper" queda igual.
    columns: s.columns.map((c) => ({
      ...c,
      title: c.title.replace(/^(Upper|Lower) · r/, "R"),
    })),
  }))

  return (
    <Card variant="outline" asChild className="bg-card">
      <section aria-label={title}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            open && "border-b"
          )}
        >
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground">{info}</span>
          <ChevronDownIcon
            aria-hidden
            className={cn(
              "ml-auto size-4 text-muted-foreground transition-transform",
              !open && "-rotate-90"
            )}
          />
        </button>
        {open && (
          <div className="p-4">
            <BracketTree sections={titled} />
          </div>
        )}
      </section>
    </Card>
  )
}
