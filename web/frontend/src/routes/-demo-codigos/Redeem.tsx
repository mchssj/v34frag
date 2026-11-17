import { cn } from "cn"
import {
  CheckCircle2Icon,
  ClockIcon,
  GiftIcon,
  HistoryIcon,
  LockIcon,
  TicketIcon,
} from "lucide-react"
import { useState, type FormEvent } from "react"

import { Eyebrow } from "@/components/brand/SectionHeading"
import { EmptyState } from "@/components/brand/EmptyState"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { VipBadge } from "@/features/shop/cosmetics"
import { Amount } from "@/features/shop/parts"

import {
  PrizeAmount,
  PrizeArt,
  fmtDate,
  itemName,
  prizeText,
  span,
  type Items,
} from "./parts"
import {
  SHORT_FAILS,
  blockedUntil,
  failsLeft,
  formatTyping,
  vipOf,
  type Redemption,
  type RedeemError,
  type Sim,
} from "./sim"

// Textos según el código de error, como haría la web con error.code de la API.
const ERRORS: Record<Exclude<RedeemError, "code_rate_limited">, string> = {
  code_invalid: "Ese código no es válido. Revisá que esté bien escrito.",
  code_expired: "Ese código ya venció.",
  code_used_up: "Ese código ya se usó todas las veces que se podía.",
  code_already_redeemed: "Ya canjeaste este código.",
  code_not_for_you: "Este código es para otra cuenta.",
  code_already_owned:
    "Ya tenés ese artículo para siempre. El código no se gastó: podés regalárselo a alguien.",
  code_vip_lifetime: "Ya tenés VIP de por vida. El código no se gastó.",
  account_banned: "Tu cuenta está suspendida y no puede canjear códigos.",
}

export function RedeemView({
  sim,
  user,
  items,
  typed,
  setTyped,
  onRedeem,
  last,
}: {
  sim: Sim
  user: string
  items: Items
  typed: string
  setTyped: (v: string) => void
  onRedeem: (code: string) => { error?: RedeemError; retryAt?: number } | void
  last: Redemption | null
}) {
  const acc = sim.accounts.find((a) => a.id === user)!
  const vip = vipOf(sim, user)
  const block = blockedUntil(sim, user)
  const left = failsLeft(sim, user)
  const [error, setError] = useState<string | null>(null)

  const mine = sim.redemptions.filter((r) => r.user === user)
  const timed = sim.owned
    .filter((o) => o.user === user && o.expiresAt !== null)
    .sort((a, b) => a.expiresAt! - b.expiresAt!)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!typed.trim()) return
    const r = onRedeem(typed)
    if (!r?.error) {
      setError(null)
      setTyped("")
      return
    }
    setError(r.error === "code_rate_limited" ? null : ERRORS[r.error])
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Billetera, como la cabecera de la tienda */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Tienda › Canjear código</Eyebrow>
          <h1 className="text-[28px] leading-tight font-bold tracking-[-0.8px]">
            Canjear un código
          </h1>
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            ¿Ganaste un sorteo en Discord, en un stream o en un torneo? Escribí
            el código acá y el premio va directo a tu cuenta.
          </p>
        </div>
        <Card variant="outline" className="flex items-center gap-5 px-4 py-2.5">
          <span className="flex flex-col">
            <span className="text-[11px] text-muted-foreground">Puntos</span>
            <Amount value={acc.points} currency="points" className="text-lg" />
          </span>
          <span className="flex flex-col">
            <span className="text-[11px] text-muted-foreground">
              Monedas VIP
            </span>
            <Amount value={acc.coins} currency="vip" className="text-lg" />
          </span>
          <span className="flex flex-col">
            <span className="text-[11px] text-muted-foreground">VIP</span>
            {vip.lifetime ? (
              <span className="text-sm font-semibold">De por vida</span>
            ) : vip.until ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                <VipBadge className="h-4" /> hasta{" "}
                {fmtDate(vip.until).split(",")[0]}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">No</span>
            )}
          </span>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card
            variant="outline"
            radius="tile"
            className="flex flex-col gap-4 p-5"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <TicketIcon aria-hidden className="size-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold">Tu código</h2>
                <p className="text-xs text-muted-foreground">
                  Mayúsculas, espacios y guiones dan igual. Se canjea una vez
                  por cuenta.
                </p>
              </div>
            </div>
            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
              <Input
                aria-label="Código"
                value={typed}
                disabled={!!block}
                onChange={(e) => {
                  setTyped(formatTyping(e.target.value))
                  setError(null)
                }}
                placeholder="CML-XXXX-XXXX-XXXX"
                autoComplete="off"
                spellCheck={false}
                maxLength={24}
                className="h-11 font-mono text-lg tracking-[2px] uppercase placeholder:tracking-[2px]"
              />
              <Button
                type="submit"
                size="lg"
                className="h-11 px-6"
                disabled={!!block || !typed.trim()}
              >
                <GiftIcon /> Canjear
              </Button>
            </form>
            {block ? (
              <Alert variant="destructive">
                <LockIcon />
                <AlertTitle>Demasiados intentos</AlertTitle>
                <AlertDescription>
                  Por seguridad, pausamos el canje en tu cuenta. Probá de nuevo
                  en {span(block - sim.now)} ({fmtDate(block)}).
                </AlertDescription>
              </Alert>
            ) : error ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {error}
                  {left < SHORT_FAILS && (
                    <span className="block text-xs">
                      {left === 1
                        ? "Te queda 1 intento antes de una pausa de 15 minutos."
                        : `Te quedan ${left} intentos antes de una pausa de 15 minutos.`}
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            ) : null}
          </Card>

          {last && (
            <Card
              variant="outline"
              radius="tile"
              className="relative flex items-center gap-5 overflow-hidden border-primary/40 bg-primary/5 p-5"
            >
              <PrizeArt
                p={{ ...last, days: daysOf(last, sim) }}
                items={items}
                alias={acc.alias}
              />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <CheckCircle2Icon aria-hidden className="size-4" /> ¡Código
                  canjeado!
                </span>
                <span className="text-lg font-bold">
                  {prizeText({ ...last, days: daysOf(last, sim) }, items)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {last.until
                    ? `Te dura hasta el ${fmtDate(last.until)}.`
                    : last.reward === "item"
                      ? "Es tuyo para siempre."
                      : "Ya está en tu billetera."}
                </span>
                {last.reward === "item" && (
                  <div className="mt-1 flex gap-2">
                    <Button size="sm">Equipar</Button>
                    <Button size="sm" variant="outline">
                      Ver en el inventario
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card
            variant="outline"
            radius="tile"
            className="flex flex-col gap-2 p-5 text-sm"
          >
            <h2 className="font-semibold">Cómo funciona</h2>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
              <li>
                Los códigos los generan los admins para sorteos. Son gratis: no
                se venden ni se cambian por plata.
              </li>
              <li>
                Pueden dar un artículo de la tienda, puntos, monedas VIP o días
                de VIP.
              </li>
              <li>
                Algunos premios duran un tiempo (por ejemplo, VIP por 1 semana);
                lo ves al canjearlo.
              </li>
              <li>
                Si ya tenés el VIP, los días se suman al final del que tenés.
              </li>
              <li>
                Los códigos pueden vencer. Si escribís muchos códigos que no
                existen, el canje se pausa un rato.
              </li>
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card variant="outline" radius="tile" className="flex flex-col p-0">
            <h2 className="flex items-center gap-2 border-b px-5 py-3 text-sm font-semibold">
              <HistoryIcon
                aria-hidden
                className="size-4 text-muted-foreground"
              />{" "}
              Tus canjes
            </h2>
            {mine.length === 0 ? (
              <EmptyState
                icon={TicketIcon}
                title="Todavía no canjeaste códigos"
              >
                Cuando ganes un sorteo, el premio aparece acá.
              </EmptyState>
            ) : (
              <ul className="divide-y">
                {mine.map((r) => {
                  const c = sim.codes.find((x) => x.id === r.codeId)!
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        "flex items-center gap-3 px-5 py-3",
                        r.revertedAt && "opacity-60"
                      )}
                    >
                      <PrizeArt
                        p={{ ...r, days: c.days }}
                        items={items}
                        alias={acc.alias}
                        small
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {prizeText({ ...r, days: c.days }, items)}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {c.label} · {fmtDate(r.at)}
                        </span>
                      </div>
                      {r.revertedAt ? (
                        <Badge variant="danger" size="sm">
                          Revertido
                        </Badge>
                      ) : r.until ? (
                        r.until > sim.now ? (
                          <Badge variant="soft" size="sm">
                            <ClockIcon /> {span(r.until - sim.now)}
                          </Badge>
                        ) : (
                          <Badge variant="muted" size="sm">
                            Terminó
                          </Badge>
                        )
                      ) : (
                        <PrizeAmount p={r} />
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card variant="outline" radius="tile" className="flex flex-col p-0">
            <h2 className="flex items-center gap-2 border-b px-5 py-3 text-sm font-semibold">
              <ClockIcon aria-hidden className="size-4 text-muted-foreground" />{" "}
              En tu inventario por tiempo
            </h2>
            {timed.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">
                Nada por tiempo: todo lo que tenés es para siempre.
              </p>
            ) : (
              <ul className="divide-y">
                {timed.map((o) => {
                  const it = items.get(o.itemId)
                  const over = o.expiresAt! <= sim.now
                  return (
                    <li
                      key={o.itemId}
                      className="flex items-center gap-3 px-5 py-3"
                    >
                      <PrizeArt
                        p={{ reward: "item", itemId: o.itemId, amount: null }}
                        items={items}
                        alias={acc.alias}
                        small
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {it ? itemName(it) : o.itemId}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {over
                            ? `Venció el ${fmtDate(o.expiresAt!)}`
                            : `Vence el ${fmtDate(o.expiresAt!)}`}
                        </span>
                      </div>
                      {over ? (
                        it?.price ? (
                          <Button size="sm" variant="outline">
                            Comprarlo
                          </Button>
                        ) : (
                          <Badge variant="muted" size="sm">
                            Venció
                          </Badge>
                        )
                      ) : (
                        <Badge variant="soft" size="sm">
                          <ClockIcon /> {span(o.expiresAt! - sim.now)}
                        </Badge>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
          <p className="px-1 text-xs text-muted-foreground">
            Lo que dura un tiempo se saca solo de tu perfil cuando vence. Si lo
            comprás, pasa a ser tuyo para siempre.
          </p>
        </div>
      </div>
    </div>
  )
}

const daysOf = (r: Redemption, sim: Sim) =>
  sim.codes.find((c) => c.id === r.codeId)?.days ?? null
