import { createFileRoute, notFound } from "@tanstack/react-router"
import { ChevronDownIcon, ClockIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { COSMETICS_BASE, type ShopItem } from "@/features/shop/types"

import { AdminCodes } from "./-demo-codigos/Admin"
import { fmtDate, prizeText, type Items } from "./-demo-codigos/parts"
import { RedeemView } from "./-demo-codigos/Redeem"
import {
  DAY,
  ME,
  MIN,
  codeState,
  createCodes,
  redeem,
  revertRedemption,
  revokeCode,
  seed,
  type Redemption,
  type Sim,
} from "./-demo-codigos/sim"

// Prototipo de los códigos canjeables (plan docs/bitacora/2026-11-17-codigos-canjeables), en memoria y sin API.
// Solo en `pnpm dev`: en producción la ruta no existe.
export const Route = createFileRoute("/demo/codigos")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoCodigos,
})

const VIEWS = {
  player: "Jugador › Canjear",
  admin: "Administración › Códigos",
} as const
type View = keyof typeof VIEWS

type CatalogFile = { items: Omit<ShopItem, "price" | "active">[] }

function DemoCodigos() {
  const [start] = useState(() => Date.now())
  const [sim, setSim] = useState<Sim>(() => seed(start))
  const [view, setView] = useState<View>("player")
  const [user, setUser] = useState(ME)
  const [typed, setTyped] = useState("")
  const [last, setLast] = useState<Redemption | null>(null)
  const [items, setItems] = useState<Items>(new Map())

  useEffect(() => {
    let alive = true
    fetch(COSMETICS_BASE + "catalogo.json")
      .then((r) => r.json() as Promise<CatalogFile>)
      .then((c) => {
        if (!alive) return
        // Precio aproximado para el "Comprarlo" de lo vencido: solo importa si está a la venta.
        setItems(
          new Map(
            c.items.map((i) => [
              i.id,
              { ...i, price: i.vip_only ? null : 1, active: true },
            ])
          )
        )
      })
      .catch(() => alive && setItems(new Map()))
    return () => {
      alive = false
    }
  }, [])

  const usable = useMemo(
    () => sim.codes.filter((c) => c.revokedAt === null).slice(0, 12),
    [sim.codes]
  )

  function pass(ms: number, what: string) {
    setSim((s) => ({ ...s, now: s.now + ms }))
    toast(`Pasaron ${what}.`)
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
        <span className="mr-2 font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
          Demo
        </span>
        <Select
          value={user}
          onValueChange={(v) => {
            setUser(v)
            setLast(null)
          }}
        >
          <SelectTrigger size="sm" className="w-44" aria-label="Cuenta">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sim.accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.alias}
                {a.banned ? " (baneada)" : a.id === ME ? " (vos)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              Códigos de ejemplo <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
            <DropdownMenuLabel>
              Escribirlo en el campo de canje
            </DropdownMenuLabel>
            {usable.map((c) => (
              <DropdownMenuItem
                key={c.id}
                className="flex flex-col items-start gap-0"
                onSelect={() => {
                  setView("player")
                  setTyped(c.display)
                }}
              >
                <code className="font-mono text-xs font-semibold">
                  {c.display}
                </code>
                <span className="text-[11px] text-muted-foreground">
                  {prizeText(c, items)} · {codeState(c, sim.now)}
                  {c.forUser &&
                    ` · solo ${sim.accounts.find((a) => a.id === c.forUser)?.alias}`}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => setTyped("CML-ABCD-EFGH-JKMN")}>
              <span className="text-xs">
                Uno que no existe (para los topes)
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="inline-flex items-center gap-1">
          <ClockIcon aria-hidden className="size-3.5 text-muted-foreground" />
          <span className="font-mono text-xs text-muted-foreground">
            {fmtDate(sim.now)}
          </span>
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => pass(15 * MIN, "15 minutos")}
        >
          +15 min
        </Button>
        <Button size="sm" variant="outline" onClick={() => pass(DAY, "un día")}>
          +1 día
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => pass(7 * DAY, "7 días")}
        >
          +1 semana
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setSim(seed(start))
            setLast(null)
            setTyped("")
          }}
        >
          Reiniciar
        </Button>
        <span className="ml-auto inline-flex rounded-lg border p-0.5">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <Button
              key={v}
              size="sm"
              variant={view === v ? "secondary" : "ghost"}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {VIEWS[v]}
            </Button>
          ))}
        </span>
      </div>

      {view === "player" ? (
        <RedeemView
          sim={sim}
          user={user}
          items={items}
          typed={typed}
          setTyped={setTyped}
          last={last}
          onRedeem={(code) => {
            const r = redeem(sim, user, code)
            setSim(r.sim)
            if (r.ok) {
              setLast(r.redemption)
              toast.success(
                `Canjeaste: ${prizeText({ ...r.redemption, days: r.code.days }, items)}.`
              )
              return
            }
            setLast(null)
            return { error: r.error, retryAt: r.retryAt }
          }}
        />
      ) : (
        <AdminCodes
          sim={sim}
          items={items}
          onCreate={(i) => {
            const r = createCodes(sim, i)
            if (!r.ok) return { error: r.error }
            setSim(r.sim)
            return { codes: r.codes }
          }}
          onRevoke={(id, why) => setSim((s) => revokeCode(s, id, why))}
          onRevert={(id, why) => setSim((s) => revertRedemption(s, id, why))}
        />
      )}
    </div>
  )
}
