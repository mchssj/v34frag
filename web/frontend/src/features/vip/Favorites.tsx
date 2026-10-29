import { cn } from "cn"
import { FilmIcon, LockIcon, StarIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { SearchMatch } from "@/features/search/demo"

import { MATCHES } from "./demo"

// Partidas favoritas para VIP (docs/bitacora/2026-10-29-partidas-favoritas en kyan/pruebas). La tabla sigue a
// MixesList; la estrella marca o desmarca y el filtro muestra solo las favoritas.

const KEY = "demo-partidas-favoritas"
const head = "h-auto py-2.5 text-xs font-medium text-muted-foreground"
const ME = MATCHES[0]!.team_a[0]!

function load(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]
  } catch {
    return []
  }
}
function store(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // Sin almacenamiento: las favoritas duran lo que dura la página.
  }
}

/** Mis mixes: en los que jugó el jugador de la demo. */
const MINE = MATCHES.filter(
  (m) => !m.cancelled && (m.team_a.includes(ME) || m.team_b.includes(ME))
).slice(0, 40)

function Side({ nicks, right }: { nicks: string[]; right?: boolean }) {
  return (
    <span className={cn("block max-w-48 truncate", right && "text-right")}>
      {nicks.map((n, i) => (
        <span
          key={n}
          className={cn(n === ME && "font-semibold text-foreground")}
        >
          {i > 0 && ", "}
          {n === ME ? "vos" : n}
        </span>
      ))}
    </span>
  )
}

export function Favorites({ vip }: { vip: boolean }) {
  const [favs, setFavs] = useState<string[]>(load)
  const [only, setOnly] = useState(false)

  const toggle = (m: SearchMatch) => {
    if (!vip)
      return toast.error("Marcar partidas como favoritas es un beneficio VIP.")
    // Con la función de setState: dos clics seguidos no se pisan.
    setFavs((prev) => {
      const next = prev.includes(m.id)
        ? prev.filter((x) => x !== m.id)
        : [m.id, ...prev]
      store(next)
      return next
    })
    toast.success(
      favs.includes(m.id) ? "Sacada de favoritas." : "Guardada en favoritas."
    )
  }
  const rows = only ? MINE.filter((m) => favs.includes(m.id)) : MINE

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-9 gap-0.5 rounded-lg bg-muted p-[3px]">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={only === v}
              onClick={() =>
                v && !vip
                  ? toast.error("Las favoritas son para VIP.")
                  : setOnly(v)
              }
              className={cn(
                "inline-flex h-[30px] items-center gap-1.5 rounded-[calc(var(--radius)-4px)] px-3.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground",
                only === v &&
                  "bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/.1)]"
              )}
            >
              {v ? (
                <>
                  {vip ? (
                    <StarIcon aria-hidden className="size-3.5" />
                  ) : (
                    <LockIcon aria-hidden className="size-3.5" />
                  )}
                  Favoritas (
                  {vip
                    ? favs.filter((f) => MINE.some((m) => m.id === f)).length
                    : 0}
                  )
                </>
              ) : (
                "Todas mis partidas"
              )}
            </button>
          ))}
        </span>
        {vip && favs.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => (setFavs([]), store([]))}
          >
            Vaciar favoritas
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]">
        <Table className="min-w-[820px] text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(head, "w-10 pl-4")}>
                <span className="sr-only">Favorita</span>
              </TableHead>
              <TableHead className={head}>Fecha</TableHead>
              <TableHead className={head}>Mapa</TableHead>
              <TableHead className={cn(head, "text-right")}>Bando 1</TableHead>
              <TableHead className={cn(head, "text-center")}>Rondas</TableHead>
              <TableHead className={head}>Bando 2</TableHead>
              <TableHead className={head}>MVP</TableHead>
              <TableHead className={cn(head, "pr-4")}>Demo / TV</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={8}
                  className="px-4 py-10 text-center text-[13px] text-muted-foreground"
                >
                  Todavía no marcaste ninguna. Tocá la estrella de un mix para
                  guardarlo acá.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => {
                const fav = vip && favs.includes(m.id)
                return (
                  <TableRow key={m.id} className="hover:bg-muted">
                    <TableCell className="pl-4">
                      <button
                        type="button"
                        aria-pressed={fav}
                        aria-label={
                          fav ? "Sacar de favoritas" : "Marcar como favorita"
                        }
                        onClick={() => toggle(m)}
                        className="rounded p-1 text-muted-foreground hover:text-amber-400"
                      >
                        <StarIcon
                          className={cn(
                            "size-4",
                            fav && "fill-amber-400 text-amber-400"
                          )}
                        />
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {m.date}
                    </TableCell>
                    <TableCell className="font-medium">{m.map}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <Side nicks={m.team_a} right />
                    </TableCell>
                    <TableCell className="text-center font-mono font-semibold tabular-nums">
                      {m.score[0]} : {m.score[1]}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <Side nicks={m.team_b} />
                    </TableCell>
                    <TableCell>{m.mvp === ME ? "vos" : m.mvp}</TableCell>
                    <TableCell className="pr-4">
                      {m.has_demo ? (
                        <FilmIcon aria-label="Tiene demo" className="size-4" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
