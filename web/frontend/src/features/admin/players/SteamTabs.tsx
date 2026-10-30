import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SearchBox } from "@/features/ranking/SearchBox"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { ConfirmDialog } from "../dialogs"
import { fmtDate, fmtDateTime, type Tone } from "../format"
import {
  Card,
  Chip,
  EmptyState,
  FilterChips,
  Pager,
  QueryError,
  TableBox,
  headCell,
  warnText,
} from "../ui"
import {
  UNLINKED_PER,
  pickPlayerOptions,
  steamConfigOptions,
  steamRequestsOptions,
  unlinkedOptions,
  useApproveSteamRequest,
  useCreatePlayer,
  useLinkSteam,
  useRejectSteamRequest,
  useSaveSteamConfig,
  type SteamRequest,
  type SteamUnlinked,
} from "./queries"

const CLOSED: Record<string, { label: string; tone: Tone }> = {
  approved: { label: "Aprobado", tone: "win" },
  rejected: { label: "Rechazado", tone: "neutral" },
  cancelled: { label: "Cancelado por el jugador", tone: "neutral" },
  expired: { label: "Venció sin resolverse", tone: "neutral" },
}

/** Por qué no se puede aprobar un pedido pendiente (null si se puede). */
export function requestBlock(r: SteamRequest): string | null {
  if (r.status !== "pending") return null
  if (r.kind === "add" && r.shares_match)
    return "Comparte partidas con otro SteamID de la ficha: no se puede aprobar (jugó con los dos a la vez)."
  if (r.kind === "remove" && r.player_steam_count <= 1)
    return "Es el único SteamID de la ficha: no se puede quitar."
  return null
}

export function SteamRequestsTab() {
  const [pendingOnly, setPendingOnly] = useState(true)
  const list = useQuery(steamRequestsOptions(pendingOnly))

  return (
    <div className="flex flex-wrap items-start gap-5">
      <section
        aria-label="Pedidos de SteamID"
        className="flex min-w-0 flex-[999_1_560px] flex-col gap-3"
      >
        <FilterChips
          label="Filtrar pedidos"
          value={pendingOnly ? "pending" : "all"}
          onChange={(v) => setPendingOnly(v === "pending")}
          options={[
            { value: "pending", label: "Pendientes" },
            { value: "all", label: "Todos" },
          ]}
        />
        {list.isError ? (
          <QueryError error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isPending ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : list.data.items.length === 0 ? (
          <EmptyState>
            {pendingOnly ? "No hay pedidos pendientes." : "No hay pedidos."}
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.data.items.map((r) => (
              <li key={r.id}>
                <RequestCard r={r} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <aside
        aria-label="Tope de SteamID"
        className="flex min-w-0 flex-[1_1_300px] flex-col gap-3"
      >
        <MaxSteam />
        <Card>
          <h2 className="text-[15px] font-semibold">Antes de aprobar</h2>
          <span className="text-[13px] leading-relaxed text-muted-foreground">
            Aprobar un SteamID adicional o quitar uno de una ficha con varios
            recalcula el ELO de esa ficha; los demás no cambian. Los pedidos
            reservan el SteamID y vencen a los 30 días.
          </span>
        </Card>
      </aside>
    </div>
  )
}

function RequestCard({ r }: { r: SteamRequest }) {
  const approve = useApproveSteamRequest()
  const reject = useRejectSteamRequest()
  const [confirm, setConfirm] = useState<"approve" | "reject" | null>(null)
  const block = requestBlock(r)
  const closed = CLOSED[r.status]

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <Chip tone={r.kind === "add" ? "primary" : "warn"}>
            {r.kind === "add" ? "SteamID adicional" : "Quiere desvincular"}
          </Chip>
          <span className="font-semibold">{r.player.nick}</span>
          <span className="text-xs text-muted-foreground">
            {r.user?.alias ? `cuenta ${r.user.alias} · ` : ""}
            {r.player_steam_count} SteamID hoy
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          {fmtDateTime(r.created_at)}
        </span>
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5 text-[13px]">
        <Info label="SteamID" mono>
          {r.steam_id}
        </Info>
        <Info label="Nick que usó">{r.nick ?? "—"}</Info>
        <Info label="Servidor">{r.server?.name ?? "—"}</Info>
        <Info label="Partidas con ese SteamID" mono>
          {r.matches}
        </Info>
      </dl>
      {r.note && (
        <p className="rounded-lg bg-muted px-3 py-2.5 text-[13px] leading-relaxed">
          «{r.note}»
        </p>
      )}
      {block && <span className={cn("text-[13px]", warnText)}>{block}</span>}
      {r.status === "pending" ? (
        <div className="flex flex-wrap gap-2">
          {!block && (
            <Button size="md" onClick={() => setConfirm("approve")}>
              {r.kind === "add" ? "Aprobar" : "Aprobar y quitar"}
            </Button>
          )}
          <Button
            variant="outline"
            size="md"
            onClick={() => setConfirm("reject")}
          >
            Rechazar
          </Button>
        </div>
      ) : (
        closed && (
          <span className="flex flex-col gap-1">
            <Chip tone={closed.tone}>{closed.label}</Chip>
            {r.reason && (
              <span className="text-xs text-muted-foreground">
                Motivo: {r.reason}
              </span>
            )}
          </span>
        )
      )}
      <ConfirmDialog
        open={confirm === "approve"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          r.kind === "add"
            ? `¿Sumar este SteamID a ${r.player.nick}?`
            : `¿Quitar este SteamID de ${r.player.nick}?`
        }
        description={
          r.kind === "add"
            ? `Le pasa sus ${r.matches} partidas y recalcula el ELO de esta ficha; los demás no cambian.`
            : `Sus ${r.matches} partidas vuelven a quedar sin ficha y se recalcula el ELO de esta ficha; los demás no cambian.`
        }
        confirmLabel="Aprobar"
        pending={approve.isPending}
        error={approve.error}
        onConfirm={() =>
          approve.mutate(r, {
            onSuccess: () => {
              setConfirm(null)
              toast.success("Pedido aprobado.")
            },
          })
        }
      />
      <ConfirmDialog
        open={confirm === "reject"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Rechazar el pedido de ${r.player.nick}?`}
        confirmLabel="Rechazar"
        danger
        reason={{
          label: "Motivo (opcional)",
          help: "Lo ve el jugador.",
          required: false,
        }}
        pending={reject.isPending}
        error={reject.error}
        onConfirm={(reason) =>
          reject.mutate(
            { id: r.id, reason },
            {
              onSuccess: () => {
                setConfirm(null)
                toast.success("Pedido rechazado.")
              },
            }
          )
        }
      />
    </article>
  )
}

function Info({
  label,
  mono,
  children,
}: {
  label: string
  mono?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn(mono && "font-mono break-all")}>{children}</dd>
    </div>
  )
}

function MaxSteam() {
  const config = useQuery(steamConfigOptions)
  const save = useSaveSteamConfig()
  const current = config.data?.max_steam_ids
  return (
    <Card>
      <h2 className="text-[15px] font-semibold">SteamID por ficha</h2>
      <span className="text-[13px] leading-relaxed text-muted-foreground">
        Cuántos puede pedir un jugador con !claim. Un admin puede sumar hasta 4.
      </span>
      <div
        role="radiogroup"
        aria-label="Tope de SteamID por ficha"
        className="inline-flex gap-1 self-start rounded-lg bg-muted p-1"
      >
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={current === n}
            disabled={config.isPending || save.isPending}
            onClick={() =>
              current !== n &&
              save.mutate(n, {
                onSuccess: () =>
                  toast.success(`Tope de SteamID por ficha: ${n}.`),
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
            className={cn(
              "h-8 min-w-10 rounded-md px-3 font-mono text-[13px] transition-colors",
              current === n
                ? "bg-card font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </Card>
  )
}

export function UnlinkedTab({
  onOpenFicha,
}: {
  onOpenFicha: (id: string) => void
}) {
  const [q, setQ] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const list = useQuery(unlinkedOptions(q ?? "", page))
  const [linking, setLinking] = useState<SteamUnlinked | null>(null)
  const create = useCreatePlayer()
  const link = useLinkSteam()

  async function newFicha(u: SteamUnlinked) {
    try {
      const p = await create.mutateAsync({
        nick: u.last_nick?.trim() || `Jugador ${u.steam_id.slice(-4)}`,
      })
      await link.mutateAsync({ steam_id: u.steam_id, player_id: p.id })
      toast.success("Ficha creada con ese SteamID.")
      onOpenFicha(p.id)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <section aria-label="SteamID sin vincular" className="flex flex-col gap-3">
      <p className="max-w-[720px] text-sm leading-relaxed text-muted-foreground">
        SteamID que jugaron en los servidores y no son de ninguna ficha. Sumarlo
        a una ficha le pasa esas partidas: queda como principal si no tenía, o
        como adicional.
      </p>
      <SearchBox
        value={q}
        label="Buscar SteamID sin vincular"
        placeholder="Nick o SteamID"
        onChange={(v) => {
          setQ(v)
          setPage(1)
        }}
      />
      {list.isError ? (
        <QueryError error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : list.data.items.length === 0 ? (
        <EmptyState>No hay SteamID sin vincular.</EmptyState>
      ) : (
        <TableBox>
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={cn(headCell, "pl-4")}>SteamID</TableHead>
                <TableHead className={headCell}>Último nick</TableHead>
                <TableHead className={cn(headCell, "text-right")}>
                  Partidas
                </TableHead>
                <TableHead className={headCell}>Última vez</TableHead>
                <TableHead className={headCell}>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((u) => (
                <TableRow key={u.steam_id}>
                  <TableCell className="pl-4 font-mono text-[13px]">
                    {u.steam_id}
                  </TableCell>
                  <TableCell className="font-medium">
                    {u.last_nick ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {u.matches}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtDate(u.last_played)}
                  </TableCell>
                  <TableCell className="pr-4 text-right whitespace-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLinking(u)}
                    >
                      Sumar a una ficha
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary"
                      disabled={create.isPending || link.isPending}
                      onClick={() => void newFicha(u)}
                    >
                      Ficha nueva
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager
            page={page}
            total={list.data.total}
            per={UNLINKED_PER}
            onPage={setPage}
          />
        </TableBox>
      )}
      {linking && (
        <LinkDialog
          key={linking.steam_id}
          u={linking}
          onClose={() => setLinking(null)}
        />
      )}
    </section>
  )
}

function LinkDialog({ u, onClose }: { u: SteamUnlinked; onClose: () => void }) {
  const [q, setQ] = useState(u.last_nick ?? "")
  const debounced = useDebouncedValue(q.trim(), 250)
  const players = useQuery(pickPlayerOptions(debounced))
  const [pick, setPick] = useState<string | null>(null)
  const link = useLinkSteam()

  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Sumar ${u.steam_id} a una ficha`}
      description={`Último nick: ${u.last_nick ?? "—"} · ${u.matches} partidas. Si la ficha ya tiene SteamID, queda como adicional (hasta 4) y se recalcula el ELO de esa ficha; los demás no cambian.`}
      confirmLabel="Sumar a la ficha"
      incomplete={!pick}
      pending={link.isPending}
      error={link.error}
      onConfirm={() =>
        pick &&
        link.mutate(
          { steam_id: u.steam_id, player_id: pick },
          {
            onSuccess: () => {
              toast.success("SteamID sumado a la ficha.")
              onClose()
            },
          }
        )
      }
    >
      <Input
        aria-label="Buscar ficha"
        placeholder="Buscar ficha por nick"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div
        role="radiogroup"
        aria-label="Ficha"
        className="flex max-h-60 flex-col gap-1.5 overflow-y-auto"
      >
        {players.data?.items.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={pick === p.id}
            onClick={() => setPick(p.id)}
            className={cn(
              "flex min-h-11 items-center justify-between rounded-lg border px-3 text-left",
              pick === p.id ? "border-primary bg-primary/10" : "hover:bg-muted"
            )}
          >
            <span className="font-medium">{p.alias}</span>
            <span className="text-xs text-muted-foreground">
              {p.has_steam ? "Con SteamID" : "Sin SteamID"} · ELO {p.elo ?? "—"}
            </span>
          </button>
        ))}
        {debounced && players.data?.items.length === 0 && (
          <span className="text-[13px] text-muted-foreground">
            Ninguna ficha coincide.
          </span>
        )}
      </div>
      {!pick && (
        <span className="text-xs text-muted-foreground">Elige una ficha.</span>
      )}
    </ConfirmDialog>
  )
}
