import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { CheckIcon, CrownIcon, MinusIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { VipBadge } from "@/features/shop/cosmetics"

import {
  ars,
  BENEFITS,
  GRACE_DAYS,
  GROUP_LABEL,
  MONTH_PRICE,
  ON_EXPIRY,
  PLANS,
  type Group,
  type Plan,
} from "./plans"

// "Hacete VIP" (docs/bitacora/2026-10-29-hacete-vip en kyan/pruebas): planes, qué tenés con y sin VIP, y el
// estado de tu VIP con lo que pasa cuando se vence. El prototipo no cobra.

export type VipState =
  | { kind: "none" }
  | { kind: "active"; daysLeft: number }
  | { kind: "grace"; daysLeft: number }
  | { kind: "expired"; daysAgo: number }

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

function StatusCard({ state }: { state: VipState }) {
  if (state.kind === "none") return null
  const tone =
    state.kind === "active" && state.daysLeft > 5
      ? "border-amber-400/50 bg-amber-400/5"
      : state.kind === "expired"
        ? "bg-muted/40"
        : "border-destructive/50 bg-destructive/5"
  const text =
    state.kind === "active"
      ? state.daysLeft > 5
        ? `Sos VIP. Se vence en ${plural(state.daysLeft, "día", "días")}.`
        : `Tu VIP se vence en ${plural(state.daysLeft, "día", "días")}. Renovalo para no cortar nada.`
      : state.kind === "grace"
        ? `Tu VIP se venció. Te quedan ${plural(state.daysLeft, "día", "días")} de gracia con todo andando.`
        : `Tu VIP se venció hace ${plural(state.daysAgo, "día", "días")}. Lo que ganaste quedó congelado: vuelve si renovás.`
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm",
        tone
      )}
    >
      <VipBadge className="h-[1.6em]" />
      <span className="flex-1">{text}</span>
      <a
        href="#planes"
        className="text-sm font-semibold text-primary hover:underline"
      >
        {state.kind === "active" && state.daysLeft > 5
          ? "Sumar meses"
          : "Renovar"}
      </a>
    </div>
  )
}

function PlanCard({ p, onPick }: { p: Plan; onPick: (p: Plan) => void }) {
  const perMonth = Math.round(p.price / p.months)
  return (
    <li
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/.04)]",
        p.highlight && "border-amber-400"
      )}
    >
      {p.highlight && (
        <span className="absolute -top-2.5 left-5 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-black">
          El más elegido
        </span>
      )}
      <span className="text-sm font-semibold text-muted-foreground">
        {plural(p.months, "mes", "meses")}
      </span>
      <span className="flex items-baseline gap-2">
        <span className="font-heading text-3xl font-semibold tabular-nums">
          {ars(p.price)}
        </span>
        {p.discount > 0 && (
          <span className="rounded bg-win/15 px-1.5 py-0.5 text-xs font-semibold text-win">
            −{p.discount}%
          </span>
        )}
      </span>
      <span className="text-xs text-muted-foreground">
        {p.months > 1 ? (
          <>
            {ars(perMonth)} por mes · <s>{ars(MONTH_PRICE * p.months)}</s>
          </>
        ) : (
          "Pagás mes a mes"
        )}
      </span>
      <Button
        className={cn(
          "mt-auto",
          p.highlight && "bg-amber-400 text-black hover:bg-amber-300"
        )}
        variant={p.highlight ? "default" : "outline"}
        onClick={() => onPick(p)}
      >
        Elegir
      </Button>
    </li>
  )
}

function Cell({ v }: { v: string | false }) {
  if (v === false)
    return (
      <MinusIcon
        aria-label="No incluido"
        className="mx-auto size-4 text-muted-foreground"
      />
    )
  return <span>{v}</span>
}

function BenefitsTable() {
  const groups = Object.keys(GROUP_LABEL) as Group[]
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="px-4 py-3 text-left font-medium">Beneficio</th>
            <th className="w-[26%] px-4 py-3 text-center font-medium">
              Sin VIP
            </th>
            <th className="w-[30%] px-4 py-3 text-center font-semibold text-amber-500 dark:text-amber-400">
              <span className="inline-flex items-center gap-1.5">
                <VipBadge className="h-[1.4em]" /> VIP
              </span>
            </th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g}>
            <tr>
              <th
                colSpan={3}
                className="bg-muted/40 px-4 py-2 text-left text-xs font-semibold tracking-[0.4px] uppercase"
              >
                {GROUP_LABEL[g]}
              </th>
            </tr>
            {BENEFITS.filter((b) => b.group === g).map((b) => (
              <tr
                key={b.name}
                className={cn("border-t", b.soon && "text-muted-foreground")}
              >
                <td className="px-4 py-2.5">
                  {b.demo ? (
                    <Link
                      to={b.demo}
                      className="hover:text-primary hover:underline"
                    >
                      {b.name}
                    </Link>
                  ) : (
                    b.name
                  )}
                </td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  <Cell v={b.free} />
                </td>
                <td className="px-4 py-2.5 text-center font-medium">
                  {b.soon ? (
                    <span className="text-xs">Próximamente</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <CheckIcon
                        aria-hidden
                        className="size-3.5 text-amber-500"
                      />
                      {b.vip}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}

function Expiry() {
  return (
    <ul className="divide-y rounded-xl border bg-card text-sm">
      {ON_EXPIRY.map((e) => (
        <li
          key={e.name}
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5"
        >
          <span className="w-56 font-medium">{e.name}</span>
          <span className="flex-1 text-muted-foreground">{e.what}</span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[11px] font-semibold",
              e.status === "decidido"
                ? "bg-win/15 text-win"
                : "bg-muted text-muted-foreground"
            )}
          >
            {e.status === "decidido" ? "Decidido" : "Propuesto"}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function VipPage({ state }: { state: VipState }) {
  const [picked, setPicked] = useState<Plan | null>(null)
  const isVip = state.kind === "active" || state.kind === "grace"
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col items-start gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-500 dark:text-amber-400">
          <CrownIcon aria-hidden className="size-4" /> CM League VIP
        </span>
        <h1 className="max-w-[24ch] text-3xl font-semibold tracking-[-0.6px]">
          {isVip
            ? "Gracias por bancar CM League"
            : "Sacale más jugo a cada mix"}
        </h1>
        <p className="max-w-[60ch] text-sm text-muted-foreground">
          Stats y herramientas que no tiene nadie más, misiones y monedas VIP
          para los cosméticos, y las stats de los torneos antes que nadie. Con
          lo que pagás se mantienen los servidores prendidos.
        </p>
      </section>

      <StatusCard state={state} />

      <section id="planes" className="flex scroll-mt-6 flex-col gap-4">
        <h2 className="text-lg font-semibold">Planes</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <PlanCard key={p.id} p={p} onPick={setPicked} />
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Precios de ejemplo. Si ya sos VIP, los meses se suman a los que te
          quedan.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Qué tenés con VIP</h2>
        <BenefitsTable />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Si se vence</h2>
          <p className="text-sm text-muted-foreground">
            Durante {plural(GRACE_DAYS, "día", "días")} de gracia todo sigue
            andando. Después:
          </p>
        </div>
        <Expiry />
      </section>

      <Dialog
        open={picked !== null}
        onOpenChange={(o) => !o && setPicked(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              VIP por {picked && plural(picked.months, "mes", "meses")}
            </DialogTitle>
            <DialogDescription>
              {picked && ars(picked.price)}
              {picked &&
                picked.discount > 0 &&
                ` (${picked.discount}% de descuento)`}
              .{" "}
              {state.kind === "active"
                ? "Se suma a los días que te quedan."
                : "Empieza apenas se acredita el pago."}
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            El medio de pago todavía no está definido. En este prototipo no se
            cobra nada.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPicked(null)}>
              Cancelar
            </Button>
            <Button disabled>Pagar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
