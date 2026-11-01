import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import type { Schemas } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "../dialogs"
import { ago, fmtDateTime } from "../format"
import { EmptyState, QueryError, warnText } from "../ui"
import {
  pendingMixOptions,
  pendingMixesOptions,
  staleMixesOptions,
  useApplyMixElo,
  useCloseStaleMix,
  useDiscardMix,
} from "./queries"

type Side = { name: string | null; score: number | null }
/** Lo que usa la tarjeta de un mix interrumpido (sale del listado de partidas). */
type MatchSummary = {
  id: string
  map: string | null
  played_at: string | null
  starts_at: string | null
  side1: Side
  side2: Side
}
type LiveMix = Schemas["LiveMixSummary"]

const score = (a: number | null, b: number | null) => `${a ?? 0}–${b ?? 0}`

/** Bando que iba adelante (el que gana si se aplica el ELO). Null si iban empatados. */
export function leadingSide(m: MatchSummary): string | null {
  const a = m.side1.score ?? 0
  const b = m.side2.score ?? 0
  if (a === b) return null
  return (
    (a > b ? m.side1.name : m.side2.name) ?? (a > b ? "Bando 1" : "Bando 2")
  )
}

export function ReviewTab() {
  const pending = useQuery(pendingMixesOptions)
  const stale = useQuery(staleMixesOptions)

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Mixes interrumpidos"
        className="flex flex-col gap-2.5"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-bold">Mixes interrumpidos</h2>
          <span className="text-[13px] text-muted-foreground">
            Se cortaron antes de terminar. Aplica el ELO si se jugó lo
            suficiente o descártalos.
          </span>
        </div>
        {pending.isError ? (
          <QueryError
            error={pending.error}
            onRetry={() => void pending.refetch()}
          />
        ) : pending.isPending ? (
          <Skeleton className="h-44 rounded-xl" />
        ) : pending.data.items.length === 0 ? (
          <EmptyState>No hay mixes para revisar.</EmptyState>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
            {pending.data.items.map((m) => (
              <li key={m.id}>
                <PendingCard match={m} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label="Mixes en vivo sin señal"
        className="flex flex-col gap-2.5"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-bold">En vivo sin señal</h2>
          <span className="text-[13px] text-muted-foreground">
            El servidor dejó de mandar el marcador hace más de 10 minutos y no
            volvió.
          </span>
        </div>
        {stale.isError ? (
          <QueryError
            error={stale.error}
            onRetry={() => void stale.refetch()}
          />
        ) : stale.isPending ? (
          <Skeleton className="h-20 rounded-xl" />
        ) : stale.data.items.length === 0 ? (
          <EmptyState>Todos los mixes en vivo están mandando datos.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {stale.data.items.map((l) => (
              <li key={l.uid}>
                <StaleRow live={l} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function PendingCard({ match: m }: { match: MatchSummary }) {
  const detail = useQuery(pendingMixOptions(m.id))
  const apply = useApplyMixElo()
  const discard = useDiscardMix()
  const [confirm, setConfirm] = useState<"apply" | "discard" | null>(null)
  const r = detail.data?.review_detail
  const pct =
    r && r.max_rounds ? Math.round((r.rounds_played * 100) / r.max_rounds) : 0
  const minPct =
    r && r.max_rounds ? Math.round((r.min_rounds * 100) / r.max_rounds) : 0
  const leader = leadingSide(m)

  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex justify-between gap-2">
        <span className="flex flex-col gap-0.5">
          <Link
            to="/match/$id"
            params={{ id: m.id }}
            className="font-mono font-semibold hover:underline"
          >
            {m.map ?? "Mix"}
          </Link>
          <span className="text-xs text-muted-foreground">
            {fmtDateTime(m.played_at ?? m.starts_at)}
          </span>
        </span>
        <span className="font-mono text-[22px] font-bold">
          {score(m.side1.score, m.side2.score)}
        </span>
      </div>
      {!r ? (
        <Skeleton className="h-12 rounded-lg" />
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Rondas jugadas</span>
              <span className="font-mono">
                {r.rounds_played} / {r.max_rounds} ({pct} %)
              </span>
            </div>
            <div aria-hidden className="relative h-2 rounded-full bg-muted">
              <span
                className={
                  r.can_apply
                    ? "absolute inset-y-0 left-0 rounded-full bg-primary"
                    : "absolute inset-y-0 left-0 rounded-full bg-muted-foreground"
                }
                style={{ width: `${Math.min(100, pct)}%` }}
              />
              <span
                className="absolute -inset-y-[3px] w-0.5 bg-foreground"
                style={{ left: `${minPct}%` }}
              />
            </div>
          </div>
          {r.can_apply ? (
            <span className="text-[13px]">
              {leader
                ? `Gana ${leader} con ${r.rounds_played} rondas jugadas.`
                : `${r.rounds_played} rondas jugadas.`}
            </span>
          ) : (
            <span className={`text-[13px] ${warnText}`}>
              {r.blocked_reason ?? "No se puede aplicar el ELO."}
            </span>
          )}
        </>
      )}
      <div className="mt-auto flex gap-2">
        {r?.can_apply && (
          <Button
            size="md"
            className="flex-1"
            onClick={() => setConfirm("apply")}
          >
            Aplicar ELO
          </Button>
        )}
        <Button
          variant="outline"
          size="md"
          className="flex-1"
          onClick={() => setConfirm("discard")}
        >
          Descartar
        </Button>
      </div>
      <ConfirmDialog
        open={confirm === "apply"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Aplicar el ELO de este mix?"
        description={
          <>
            <span>
              {m.map ?? "Mix"} · {score(m.side1.score, m.side2.score)}.{" "}
              {leader
                ? `Gana ${leader} con ${r?.rounds_played ?? 0} rondas jugadas.`
                : ""}
            </span>
            <span>
              El ELO se mueve según la participación de cada uno. No se deshace
              desde acá.
            </span>
          </>
        }
        confirmLabel="Aplicar ELO"
        typed
        pending={apply.isPending}
        error={apply.error}
        onConfirm={() =>
          apply.mutate(m.id, {
            onSuccess: () => {
              setConfirm(null)
              toast.success("ELO aplicado.")
            },
          })
        }
      />
      <ConfirmDialog
        open={confirm === "discard"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Descartar este mix?"
        description="Queda cancelado y no mueve el ELO de nadie."
        confirmLabel="Descartar"
        danger
        pending={discard.isPending}
        error={discard.error}
        onConfirm={() =>
          discard.mutate(m.id, {
            onSuccess: () => {
              setConfirm(null)
              toast.success("Mix descartado.")
            },
          })
        }
      />
    </article>
  )
}

function StaleRow({ live: l }: { live: LiveMix }) {
  const close = useCloseStaleMix()
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card px-4 py-3.5">
      <span aria-hidden className="size-2.5 rounded-full bg-amber-500" />
      <span className="flex flex-1 flex-col gap-0.5">
        <span>
          <span className="font-mono font-semibold">{l.map ?? "Mix"}</span> ·{" "}
          {l.server.name ?? "Servidor"}
        </span>
        <span className="text-xs text-muted-foreground">
          Última foto {ago(l.updated_at)}
        </span>
      </span>
      <span className="font-mono text-xl font-bold">
        {score(l.side1.score, l.side2.score)}
      </span>
      <Button variant="outline" size="md" onClick={() => setOpen(true)}>
        Cerrar como interrumpido
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Cerrar como interrumpido?"
        description={`Se guarda con la última foto (${score(l.side1.score, l.side2.score)}) y pasa a la lista de interrumpidos para decidir el ELO.`}
        confirmLabel="Cerrar mix"
        pending={close.isPending}
        error={close.error}
        onConfirm={() =>
          close.mutate(l.uid, {
            onSuccess: () => {
              setOpen(false)
              toast.success("Mix cerrado como interrumpido.")
            },
          })
        }
      />
    </div>
  )
}
