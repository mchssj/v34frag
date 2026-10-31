import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { FilterXIcon, SwordsIcon, TriangleAlertIcon } from "lucide-react"
import { type KeyboardEvent, type ReactNode } from "react"
import { errorMessage } from "@/api/errors"
import { EmptyState } from "@/components/brand/EmptyState"
import { FilterChips } from "@/components/brand/FilterChips"
import { ListPagination } from "@/components/brand/ListPagination"
import { RetryButton } from "@/components/brand/QueryState"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  KIND_LABEL,
  fmtDay,
  matchTitle,
  resultOf,
  scoreOf,
} from "../../lib/labels"
import { playerMatchesOptions } from "../../api/queries"
import type { PlayerMatch } from "../../types"
import { DEFAULT_PER, PER_OPTIONS, type PlayerSearch } from "../../lib/search"
import { Delta, useOpenMatch } from "./shared"

// ---------- Partidas ----------

const KINDS = [
  { value: undefined, label: "Todas" },
  { value: "mix", label: "Mix" },
  { value: "pcw", label: "PCW" },
  { value: "official", label: "Torneo" },
] as const

const RESULTS = [
  { value: undefined, label: "Cualquier resultado" },
  { value: "won", label: "Victorias" },
  { value: "lost", label: "Derrotas" },
] as const

const MATCH_HEAD = "h-auto py-2.5 text-xs font-medium text-muted-foreground"

/** Cabecera de la tabla de partidas; el cuerpo lo pone quien la usa. */
function MatchTable({ children }: { children: ReactNode }) {
  return (
    <Table className="min-w-[700px] text-[13px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(MATCH_HEAD, "pl-4")}>Fecha</TableHead>
          <TableHead className={MATCH_HEAD}>Tipo</TableHead>
          <TableHead className={MATCH_HEAD}>Mapa</TableHead>
          <TableHead className={MATCH_HEAD}>Nombre en el juego</TableHead>
          <TableHead className={MATCH_HEAD}>Resultado</TableHead>
          <TableHead className={MATCH_HEAD}>K-D</TableHead>
          <TableHead className={MATCH_HEAD}>Rating</TableHead>
          <TableHead className={cn(MATCH_HEAD, "pr-4 text-right")}>
            ELO
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  )
}

export function Matches({
  nick,
  search,
  onChange,
}: {
  nick: string
  search: PlayerSearch
  onChange: (patch: Partial<PlayerSearch>) => void
}) {
  const q = useQuery(playerMatchesOptions(nick, search))
  // El total sin filtros (el mismo del contador de la pestaña) para el vacío con filtros.
  const all = useQuery(playerMatchesOptions(nick, {})).data?.total
  const filtered = !!(search.kind || search.result)
  const open = useOpenMatch()
  const onKey = (m: PlayerMatch) => (e: KeyboardEvent) => {
    if (e.key === "Enter") open(m)
  }

  return (
    <Card variant="outline" className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b p-3">
        <FilterChips
          size="sm"
          label="Tipo"
          options={KINDS}
          value={search.kind}
          onChange={(kind) => onChange({ kind, page: undefined })}
        />
        <Separator
          orientation="vertical"
          className="h-5 data-vertical:self-center"
        />
        <FilterChips
          size="sm"
          label="Resultado"
          options={RESULTS}
          value={search.result}
          onChange={(result) => onChange({ result, page: undefined })}
        />
      </div>
      {/* Alto de 8 filas haya las que haya: la tarjeta no salta al filtrar. */}
      <div className="flex min-h-[396px] flex-col">
        {q.isPending ? (
          <MatchTable>
            {Array.from({ length: 8 }, (_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell colSpan={8} className="px-4 py-2.5">
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ))}
          </MatchTable>
        ) : q.isError ? (
          <EmptyState
            icon={TriangleAlertIcon}
            title="No se pudieron cargar las partidas"
            action={<RetryButton error={q.error} onRetry={q.refetch} />}
          >
            {errorMessage(q.error)}
          </EmptyState>
        ) : !q.data.items.length ? (
          filtered ? (
            <EmptyState
              icon={FilterXIcon}
              title="Ninguna partida con esos filtros"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onChange({
                      kind: undefined,
                      result: undefined,
                      page: undefined,
                    })
                  }
                >
                  Quitar filtros
                </Button>
              }
            >
              {all
                ? `Tiene ${all} ${all === 1 ? "partida" : "partidas"}, pero ninguna con esos filtros.`
                : "Prueba con otro tipo o resultado."}
            </EmptyState>
          ) : (
            <EmptyState icon={SwordsIcon} title="Todavía no jugó partidas">
              Aparecen acá al jugar un mix, un PCW o un partido de torneo en el
              servidor.
            </EmptyState>
          )
        ) : (
          <MatchTable>
            {q.data.items.map((m) => {
              const r = resultOf(m.won)
              return (
                <TableRow
                  key={m.match_id}
                  role="link"
                  tabIndex={0}
                  aria-label={matchTitle(m).title}
                  onClick={() => open(m)}
                  onKeyDown={onKey(m)}
                  className="h-11 cursor-pointer hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <TableCell className="pl-4">
                    {m.played_at ? fmtDay(m.played_at) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="soft"
                      shape="tag"
                      size="sm"
                      className="text-inherit"
                    >
                      {KIND_LABEL[m.kind]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{m.map ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.game_nick ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-mono font-semibold tabular-nums",
                        r === "V"
                          ? "text-win"
                          : r === "D"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      )}
                    >
                      {r} {scoreOf(m) ?? ""}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {m.kills ?? 0}-{m.deaths ?? 0}
                  </TableCell>
                  <TableCell className="font-mono font-semibold tabular-nums">
                    {m.rating?.toFixed(2) ?? "—"}
                  </TableCell>
                  <TableCell className="pr-4 text-right font-mono text-xs font-semibold tabular-nums">
                    <Delta v={m.elo_delta} />
                  </TableCell>
                </TableRow>
              )
            })}
          </MatchTable>
        )}
      </div>
      {!!q.data?.total && (
        <div className="border-t">
          <ListPagination
            total={q.data.total}
            page={search.page ?? 1}
            per={search.per ?? DEFAULT_PER}
            perOptions={PER_OPTIONS}
            perLabel="Partidas por página"
            onPage={(p) => onChange({ page: p === 1 ? undefined : p })}
            onPer={(n) =>
              onChange({
                per: n === DEFAULT_PER ? undefined : (n as 50 | 100),
                page: undefined,
              })
            }
          />
        </div>
      )}
    </Card>
  )
}
