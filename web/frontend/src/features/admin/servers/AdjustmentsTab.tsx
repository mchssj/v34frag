import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { SearchIcon, XIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { ConfirmDialog } from "../dialogs"
import { fmtDateTime, signed } from "../format"
import { EmptyState, Pager, QueryError, TableBox, headCell } from "../ui"
import {
  ADJ_PER,
  adjustmentsOptions,
  eloConfigOptions,
  playerSearchOptions,
  useAdjustElo,
  useUndoAdjustment,
  type EloAdjustment,
  type PlayerSummary,
} from "./queries"

type Mode = "delta" | "set"
const MAX_PLAYERS = 10

/** Valida el valor según el modo (contrato: −500 a +500 sin 0, o fijar de 0 a 10000). */
export function adjustValueError(mode: Mode, raw: string): string | null {
  const t = raw.trim()
  const v = Number(t)
  if (!t || !Number.isInteger(v)) return "Un número entero."
  if (mode === "delta" && (v === 0 || v < -500 || v > 500))
    return "De −500 a +500, sin 0."
  if (mode === "set" && (v < 0 || v > 10000)) return "De 0 a 10000."
  return null
}

/** Cómo queda el ELO (se calcula en el navegador; la API devuelve el real). */
export function adjustedElo(
  elo: number,
  mode: Mode,
  value: number,
  floor: number
): number {
  return Math.max(floor, mode === "delta" ? elo + value : value)
}

export function AdjustmentsTab() {
  return (
    <div className="flex flex-col gap-5">
      <NewAdjustment />
      <History />
    </div>
  )
}

function NewAdjustment() {
  const id = useId()
  const config = useQuery(eloConfigOptions)
  const [q, setQ] = useState("")
  const debounced = useDebouncedValue(q.trim(), 250)
  const search = useQuery(playerSearchOptions(debounced))
  const [picked, setPicked] = useState<PlayerSummary[]>([])
  const [mode, setMode] = useState<Mode>("delta")
  const [value, setValue] = useState("20")
  const [reason, setReason] = useState("")
  const adjust = useAdjustElo()

  const floor = config.data?.config.elo_floor ?? 0
  const valueErr = adjustValueError(mode, value)
  const v = Number(value)
  const suggestions = (search.data?.items ?? []).filter(
    (p) => !picked.some((x) => x.id === p.id)
  )
  const disabled =
    picked.length === 0 || !!valueErr || !reason.trim() || adjust.isPending

  function apply() {
    adjust.mutate(
      {
        player_ids: picked.map((p) => p.id),
        reason: reason.trim(),
        ...(mode === "delta" ? { delta: v } : { set_elo: v }),
      },
      {
        onSuccess: (res) => {
          const n = res.items.filter((i) => i.adjustment_id !== null).length
          toast.success(
            n === 0
              ? "Ya tenían ese ELO: no se ajustó a nadie."
              : n === 1
                ? "Ajuste aplicado."
                : `Ajuste aplicado a ${n} jugadores.`
          )
          setPicked([])
          setReason("")
        },
      }
    )
  }

  const seg = (on: boolean) =>
    cn(
      "h-9 rounded-md px-3.5 text-[13px] transition-colors",
      on
        ? "bg-card font-semibold text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    )

  return (
    <section
      aria-label="Nuevo ajuste"
      className="flex flex-wrap gap-6 rounded-xl border bg-card p-4"
    >
      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-bold">Nuevo ajuste</h2>
          <span className="text-[13px] leading-relaxed text-muted-foreground">
            Para un mix caído, un abandono o un error. Cuenta desde ahora: no
            toca partidas ni stats.
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-q`}>
            Jugadores{" "}
            <span className="font-normal text-muted-foreground">
              ({picked.length} de {MAX_PLAYERS})
            </span>
          </Label>
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              id={`${id}-q`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por alias"
              disabled={picked.length >= MAX_PLAYERS}
            />
          </InputGroup>
          {debounced && suggestions.length > 0 && (
            <ul className="flex flex-col overflow-hidden rounded-lg border">
              {suggestions.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex h-10 w-full items-center justify-between px-3 text-left hover:bg-muted"
                    onClick={() => {
                      setPicked((x) => [...x, p])
                      setQ("")
                    }}
                  >
                    <span>{p.alias}</span>
                    <span className="font-mono text-muted-foreground">
                      {p.elo ?? "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {debounced && search.data && suggestions.length === 0 && (
            <span className="text-xs text-muted-foreground">
              Ninguna ficha con SteamID coincide.
            </span>
          )}
        </div>
        {picked.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {picked.map((p) => (
              <li
                key={p.id}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border pr-1 pl-2.5 text-[13px]"
              >
                {p.alias}
                <span className="font-mono text-muted-foreground">{p.elo}</span>
                <button
                  type="button"
                  aria-label={`Quitar a ${p.alias}`}
                  className="grid size-6 place-items-center rounded-full bg-muted"
                  onClick={() =>
                    setPicked((x) => x.filter((y) => y.id !== p.id))
                  }
                >
                  <XIcon aria-hidden className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div
          role="radiogroup"
          aria-label="Tipo de ajuste"
          className="inline-flex gap-1 self-start rounded-lg bg-muted p-1"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === "delta"}
            className={seg(mode === "delta")}
            onClick={() => {
              setMode("delta")
              setValue("20")
            }}
          >
            Sumar o restar
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "set"}
            className={seg(mode === "set")}
            onClick={() => {
              setMode("set")
              setValue(String(config.data?.config.start_elo ?? 1000))
            }}
          >
            Fijar en
          </button>
        </div>
        <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-v`}>
              {mode === "delta" ? "Cambio" : "ELO final"}
            </Label>
            <Input
              id={`${id}-v`}
              inputMode="numeric"
              value={value}
              aria-invalid={!!valueErr}
              onChange={(e) => setValue(e.target.value)}
              className="h-10 font-mono"
            />
            <span
              className={cn(
                "text-xs",
                valueErr ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {valueErr ??
                (mode === "delta"
                  ? "Negativo para restar."
                  : "El jugador queda en este valor.")}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-r`} className="flex justify-between">
              <span>Motivo</span>
              <span className="font-mono font-normal text-muted-foreground">
                {reason.length}/200
              </span>
            </Label>
            <Textarea
              id={`${id}-r`}
              rows={3}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: el mix del 27/10 se cayó con 13–5 a favor"
            />
            <span className="text-xs text-muted-foreground">
              Lo ve el jugador en su historial de ELO.
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-xl bg-muted p-3.5">
        <span className="text-[13px] font-semibold">Así quedan</span>
        {picked.length === 0 ? (
          <span className="text-[13px] text-muted-foreground">
            Elige al menos un jugador.
          </span>
        ) : (
          picked.map((p) => {
            const before = p.elo ?? config.data?.config.start_elo ?? 0
            const after = valueErr
              ? before
              : adjustedElo(before, mode, v, floor)
            const d = after - before
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="font-medium">{p.alias}</span>
                <span className="flex items-center gap-2 font-mono">
                  <span className="text-muted-foreground">{before}</span>
                  <span aria-hidden>→</span>
                  <span className="font-semibold">{after}</span>
                  <span
                    className={cn(
                      "text-xs",
                      d >= 0 ? "text-win" : "text-destructive"
                    )}
                  >
                    ({signed(d)})
                  </span>
                </span>
              </div>
            )
          })
        )}
        <span className="text-xs leading-snug text-muted-foreground">
          Calculado con el ELO actual y el mínimo de {floor}. La respuesta trae
          el valor real.
        </span>
        {adjust.isError && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(adjust.error)}
          </p>
        )}
        <span className="flex-1" />
        <Button size="xl" disabled={disabled} onClick={apply}>
          {picked.length > 1
            ? `Aplicar a ${picked.length} jugadores`
            : "Aplicar ajuste"}
        </Button>
      </div>
    </section>
  )
}

function History() {
  const [page, setPage] = useState(1)
  const list = useQuery(adjustmentsOptions(page))
  const undo = useUndoAdjustment()
  const [target, setTarget] = useState<EloAdjustment | null>(null)

  return (
    <section
      aria-label="Historial de ajustes"
      className="flex flex-col gap-2.5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-bold">Historial</h2>
        <span className="text-xs text-muted-foreground">
          Más recientes primero · deshacer pide escribir «estoy seguro»
        </span>
      </div>
      {list.isError ? (
        <QueryError error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : list.data.items.length === 0 ? (
        <EmptyState>Todavía no hay ajustes manuales.</EmptyState>
      ) : (
        <TableBox>
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={cn(headCell, "pl-4")}>Fecha</TableHead>
                <TableHead className={headCell}>Jugador</TableHead>
                <TableHead className={headCell}>Cambio</TableHead>
                <TableHead className={headCell}>Motivo</TableHead>
                <TableHead className={headCell}>Por</TableHead>
                <TableHead className={headCell}>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="pl-4 whitespace-nowrap text-muted-foreground">
                    {fmtDateTime(a.applied_at)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {a.player?.alias ?? a.steam_id}
                  </TableCell>
                  <TableCell className="font-mono whitespace-nowrap">
                    <span
                      className={cn(
                        "font-semibold",
                        a.delta >= 0 ? "text-win" : "text-destructive"
                      )}
                    >
                      {a.kind === "set"
                        ? `Fijar en ${a.set_elo} (${signed(a.delta)})`
                        : signed(a.delta)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[360px] whitespace-normal">
                    {a.reason}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.created_by?.alias ?? "—"}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTarget(a)}
                    >
                      Deshacer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager
            page={page}
            total={list.data.total}
            per={ADJ_PER}
            onPage={setPage}
          />
        </TableBox>
      )}
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title="¿Deshacer este ajuste?"
        description={
          target && (
            <>
              <span>
                {target.player?.alias ?? target.steam_id}:{" "}
                {target.kind === "set"
                  ? `fijado en ${target.set_elo}`
                  : `${signed(target.delta)} ELO`}
                . Motivo: «{target.reason}»
              </span>
              <span>
                {target.kind === "set"
                  ? "Al deshacer un «fijar» se recalcula el ELO de todos para que quede como si el ajuste no hubiera existido."
                  : "Se le resta el cambio. Si después hubo un cierre o comienzo de temporada o un «fijar» del mismo jugador, se recalcula el ELO de todos."}
              </span>
            </>
          )
        }
        confirmLabel="Deshacer ajuste"
        danger
        typed
        pending={undo.isPending}
        error={undo.error}
        onConfirm={() =>
          target &&
          undo.mutate(target.id, {
            onSuccess: () => {
              setTarget(null)
              toast.success("Ajuste deshecho.")
            },
          })
        }
      />
    </section>
  )
}
