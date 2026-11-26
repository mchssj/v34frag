import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { ChartNoAxesColumnIcon, LockIcon } from "lucide-react"
import { useState } from "react"

import { BackButton } from "@/components/brand/BackButton"
import { EmptyState } from "@/components/brand/EmptyState"
import { QueryErrorMessage } from "@/components/brand/QueryState"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { fmtDay } from "@/features/mixes/lib/labels"
import { VipLock } from "@/features/vip/VipLock"
import { eloBreakdownOptions, PER } from "../api/queries"
import { Simulator } from "../components/Simulator"
import { Ticket } from "../components/Ticket"
import { deltaClass, OUTCOME, signed } from "../lib/labels"
import type { EloBreakdown, EloMix } from "../types"

// Desglose de tu ELO (/elo, bitácora 2026-11-24-desglose-elo-vip): el cambio de cada mix para todos; la cuenta paso a paso
// y el simulador, con VIP.

export function EloPage({
  page,
  onPage,
}: {
  page: number
  onPage: (page: number) => void
}) {
  const q = useQuery(eloBreakdownOptions(page))
  return (
    <section className="flex flex-col gap-5">
      <BackButton
        fallback={{ to: "/home" }}
        label="Volver"
        className="inline-flex w-fit items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
        iconClassName="size-3.5"
      />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.4px]">
          Desglose de tu ELO
        </h1>
        <p className="max-w-[72ch] text-sm text-pretty text-muted-foreground">
          Por qué ganaste o perdiste cada punto en tus mixes.
        </p>
      </div>
      {q.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[480px] rounded-xl" />
          <Skeleton className="h-[480px] rounded-xl" />
        </div>
      ) : q.isError ? (
        <div className="rounded-xl border px-4 py-10 text-center">
          <QueryErrorMessage error={q.error} onRetry={q.refetch} />
        </div>
      ) : q.data.total === 0 ? (
        <EmptyState
          icon={ChartNoAxesColumnIcon}
          title="Todavía no tienes mixes con ELO"
          action={
            <Link
              to="/play"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Ir a Jugar
            </Link>
          }
        >
          Aparecen acá después de tu primer mix en el servidor.
        </EmptyState>
      ) : (
        <Breakdown data={q.data} onPage={onPage} />
      )}
    </section>
  )
}

function Breakdown({
  data,
  onPage,
}: {
  data: EloBreakdown
  onPage: (page: number) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const mix = data.items.find((m) => m.match_id === selected) ?? data.items[0]
  const pages = Math.max(1, Math.ceil(data.total / PER))

  return (
    <>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card variant="outline" className="flex flex-col overflow-hidden">
          <h2 className="border-b px-4 py-3 text-sm font-semibold">
            Tus mixes
          </h2>
          <ul className="flex flex-col divide-y">
            {data.items.map((m) => (
              <li key={m.match_id}>
                <MixRow
                  mix={m}
                  on={m.match_id === mix?.match_id}
                  onSelect={() => setSelected(m.match_id)}
                />
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
            <span>
              {data.total} {data.total === 1 ? "mix" : "mixes"}
            </span>
            <span className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={data.page <= 1}
                onClick={() => onPage(data.page - 1)}
              >
                Anterior
              </Button>
              {data.page} de {pages}
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={data.page >= pages}
                onClick={() => onPage(data.page + 1)}
              >
                Siguiente
              </Button>
            </span>
          </div>
        </Card>

        <Card variant="outline" className="flex flex-col gap-3 p-5">
          {mix && (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">
                <span className="font-mono">{mix.map ?? "Mix"}</span>
                {mix.at && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {fmtDay(mix.at)}
                  </span>
                )}
              </h2>
              <Link
                to="/match/$id"
                params={{ id: mix.match_id }}
                className="text-[13px] text-muted-foreground hover:text-foreground hover:underline"
              >
                Ver la partida
              </Link>
            </div>
          )}
          {data.vip && data.config ? (
            mix && <Ticket mix={mix} config={data.config} />
          ) : (
            <>
              <VipLock>
                Con VIP ves la cuenta paso a paso: la probabilidad de ganar, tu
                rating, las rondas que jugaste, los topes y un simulador.
              </VipLock>
              {/* La API no manda los pasos sin VIP: esto es solo el lugar que ocupan. */}
              <ol aria-hidden className="flex flex-col divide-y opacity-50">
                {[70, 55, 62, 48, 58].map((w, i) => (
                  <li key={i} className="flex items-center gap-3 py-3">
                    <span className="size-6 rounded-full bg-muted" />
                    <span
                      className="h-3 rounded bg-muted"
                      style={{ width: `${w}%` }}
                    />
                    <LockIcon className="ml-auto size-3.5 text-muted-foreground" />
                  </li>
                ))}
              </ol>
            </>
          )}
        </Card>
      </div>
      {data.vip && data.config && <Simulator config={data.config} />}
    </>
  )
}

function MixRow({
  mix,
  on,
  onSelect,
}: {
  mix: EloMix
  on: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onSelect}
      className={cn(
        "grid w-full grid-cols-[1fr_auto_52px] items-center gap-3 px-4 py-2 text-left outline-none hover:bg-muted/60 focus-visible:bg-muted",
        on && "bg-muted"
      )}
    >
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-mono text-[13px] font-medium">
          {mix.map ?? "Mix"}
        </span>
        <span className="text-xs text-muted-foreground">
          {mix.at ? fmtDay(mix.at) : "—"} · {OUTCOME[mix.result]}
        </span>
      </span>
      <span className="font-mono text-xs text-muted-foreground tabular-nums">
        {mix.own_score ?? 0}–{mix.other_score ?? 0}
      </span>
      <span
        className={cn(
          "text-right font-mono text-sm font-semibold tabular-nums",
          deltaClass(mix.elo_delta)
        )}
      >
        {signed(mix.elo_delta)}
      </span>
    </button>
  )
}
