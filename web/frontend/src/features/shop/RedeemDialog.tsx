import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { CoinsIcon, GiftIcon, TicketIcon } from "lucide-react"
import { useEffect, useId, useState } from "react"

import { errorMessage, isApiError } from "@/api/errors"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { CardTitle, SectionCard } from "@/features/profile/components/ui"

import {
  codeReady,
  formatCode,
  prizeText,
  untilText,
  waitText,
  type CodePrize,
} from "./codeFormat"
import { configOptions, pointsOptions } from "./api"
import { myRedemptionsOptions, useRedeem } from "./codes"
import { VipBadge } from "./cosmetics"
import { ItemThumb } from "./ItemPreview"

// Canjear un código de sorteo (replanteo 126, bitácora 2026-11-16-codigos-canjeables). El código se escribe acá y
// viaja en el cuerpo del pedido: nunca va en la URL.

export function RedeemDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const id = useId()
  const redeem = useRedeem()
  const mine = useQuery({ ...myRedemptionsOptions, enabled: open })
  const [code, setCode] = useState("")
  const [won, setWon] = useState<(CodePrize & { until: string | null }) | null>(
    null
  )
  // Bloqueo por intentos: hasta cuándo (ms), para mostrar cuánto falta sin el botón.
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!blockedUntil) return
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [blockedUntil])
  const blocked = blockedUntil !== null && blockedUntil > now

  function change(next: boolean) {
    if (!next) {
      setCode("")
      setWon(null)
      redeem.reset()
    }
    onOpenChange(next)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!codeReady(code) || blocked || redeem.isPending) return
    setWon(null)
    try {
      const r = await redeem.mutateAsync(code)
      setWon(r)
      setCode("")
    } catch (err) {
      if (isApiError(err, "RATE_LIMITED") && err.retryAfter) {
        setNow(Date.now())
        setBlockedUntil(Date.now() + err.retryAfter * 1000)
      }
    }
  }

  const error = redeem.error
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Canjear un código</DialogTitle>
          <DialogDescription>
            ¿Ganaste un sorteo? Escribe el código que te pasaron para recibir tu
            premio. Cada código se canjea una vez por cuenta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
          <label htmlFor={`${id}-code`} className="text-[13px] font-medium">
            Código
          </label>
          <div className="flex gap-2">
            <Input
              id={`${id}-code`}
              value={code}
              autoComplete="off"
              spellCheck={false}
              placeholder="CML-XXXX-XXXX-XXXX"
              className="font-mono tracking-wide uppercase"
              maxLength={30}
              onChange={(e) => setCode(formatCode(e.target.value))}
            />
            <Button
              type="submit"
              disabled={!codeReady(code) || blocked || redeem.isPending}
            >
              Canjear
            </Button>
          </div>
          {blocked ? (
            <p role="alert" className="text-sm text-destructive">
              Probaste demasiados códigos que no existen. Podrás volver a
              intentar en {waitText((blockedUntil - now) / 1000)}.
            </p>
          ) : (
            !!error &&
            !isApiError(error, "RATE_LIMITED") && (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage(error)}
              </p>
            )
          )}
        </form>

        {won && <Prize prize={won} until={won.until} />}

        <div className="flex flex-col gap-2 border-t pt-3">
          <h3 className="text-[13px] font-semibold">Tus canjes</h3>
          {mine.isError ? (
            <p className="text-sm text-destructive">
              {errorMessage(mine.error)}
            </p>
          ) : !mine.data?.items.length ? (
            <p className="text-sm text-muted-foreground">
              {mine.isPending ? "Cargando..." : "Todavía no canjeaste ninguno."}
            </p>
          ) : (
            <ul className="max-h-[30vh] divide-y overflow-y-auto text-sm">
              {mine.data.items.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2">
                  <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {new Date(r.redeemed_at).toLocaleDateString("es", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={cn(
                        "truncate",
                        r.reverted_at && "text-muted-foreground line-through"
                      )}
                    >
                      {prizeText(r)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {r.label ?? "Código"} · …{r.code_tail}
                      {r.reverted_at
                        ? " · revertido"
                        : r.until
                          ? ` · ${untilText(r.until)}`
                          : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Prize({ prize, until }: { prize: CodePrize; until: string | null }) {
  const vipFree = useQuery(configOptions).data?.code_vip_free ?? true
  const vip = useQuery(pointsOptions).data?.vip ?? false
  // Un artículo VIP de un código se usa sin VIP si así está configurado (replanteo 126); si no, queda congelado.
  const frozen =
    prize.reward === "item" && !!prize.item?.vip_only && !vipFree && !vip
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-lg border border-[color-mix(in_oklch,var(--win)_40%,var(--border))] bg-[color-mix(in_oklch,var(--win)_8%,var(--card))] p-3"
    >
      {prize.reward === "item" && prize.item ? (
        <ItemThumb
          size={48}
          item={{
            ...prize.item,
            description: null,
            collection: "",
          }}
        />
      ) : (
        <span className="grid size-12 shrink-0 place-items-center rounded-md border bg-muted/50">
          {prize.reward === "vip" ? (
            <VipBadge className="h-6" />
          ) : prize.reward === "vip_coins" ? (
            <CoinsIcon className="size-6 text-[#e8b53a]" />
          ) : (
            <CoinsIcon className="size-6 text-primary" />
          )}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-sm">¡Canjeaste {prizeText(prize)}!</b>
        <span className="text-xs text-muted-foreground">
          {until
            ? `${untilText(until)} (${new Date(until).toLocaleDateString("es", { day: "numeric", month: "long" })}).`
            : prize.reward === "item"
              ? "Ya está en tu inventario: póntelo desde la tienda."
              : "Ya está en tu saldo."}
          {frozen &&
            " Es un artículo VIP: lo vas a poder usar cuando seas VIP."}
        </span>
      </span>
      <GiftIcon className="size-5 shrink-0 text-win" aria-hidden />
    </div>
  )
}

/** Acceso desde Mi perfil: abre la ventana de canje en la tienda. */
export function RedeemShortcut() {
  return (
    <SectionCard className="flex flex-wrap items-center gap-3 p-5">
      <TicketIcon className="size-5 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <CardTitle
          title="¿Ganaste un sorteo?"
          description="Canjea el código que te pasaron para recibir tu premio."
        />
      </div>
      <Link
        to="/shop"
        search={{ canjear: true }}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Canjear un código
      </Link>
    </SectionCard>
  )
}
