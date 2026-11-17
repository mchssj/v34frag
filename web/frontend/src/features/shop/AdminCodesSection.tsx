import { useQuery } from "@tanstack/react-query"
import { CopyIcon, DownloadIcon, PlusIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import type { Schemas } from "@/api/client"
import { errorMessage } from "@/api/errors"
import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { StatTile } from "@/components/brand/StatTile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useDebouncedValue } from "@/lib/useDebouncedValue"

import { adminAccountsOptions, adminItemsOptions, configOptions } from "./api"
import {
  codesCsv,
  daysText,
  prizeText,
  STATE_LABEL,
  type CodeState,
} from "./codeFormat"
import {
  adminAttemptsOptions,
  adminCodesOptions,
  adminRedemptionsOptions,
  useCreateCodes,
  useRevertRedemption,
  useRevokeCode,
  type AdminCode,
} from "./codes"
import { ItemThumb } from "./ItemPreview"

// Administración › Tienda › Códigos (replanteo 126, bitácora 2026-11-16-codigos-canjeables): códigos para sorteos
// que dan un artículo, puntos, monedas VIP o VIP. Las reglas (premio completo, usos, personalizado único) las
// valida la base y el error se muestra tal cual.

const section = "flex flex-col gap-3 rounded-xl border bg-card p-5"
const PER = 50
type Reward = Schemas["CodeCreate"]["reward"]
const REWARD: Record<Reward, string> = {
  item: "Artículo de la tienda",
  points: "Puntos",
  vip_coins: "Monedas VIP",
  vip: "VIP",
}
const STATE_TONE: Record<
  CodeState,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  scheduled: "secondary",
  used_up: "outline",
  expired: "outline",
  revoked: "destructive",
}

const fmtDate = (s: string | null) =>
  s
    ? new Date(s).toLocaleDateString("es", {
        day: "numeric",
        month: "short",
        year: "2-digit",
      })
    : "—"

async function copy(text: string, what = "Código copiado.") {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(what)
  } catch {
    toast.error("No se pudo copiar.")
  }
}

export function AdminCodesSection() {
  const [q, setQ] = useState("")
  const [state, setState] = useState<CodeState | "all">("all")
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<{
    codes: string[]
    prize: string
    label: string
  } | null>(null)
  const [viewing, setViewing] = useState<AdminCode | null>(null)
  const [revoking, setRevoking] = useState<AdminCode | null>(null)
  const [attemptsOpen, setAttemptsOpen] = useState(false)
  const revoke = useRevokeCode()
  const term = useDebouncedValue(q.trim(), 300)
  const list = useQuery(
    adminCodesOptions({
      page,
      per: PER,
      ...(term ? { q: term } : {}),
      ...(state !== "all" ? { state } : {}),
    })
  )
  const attempts = useQuery(adminAttemptsOptions)
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PER))

  return (
    <section className={section} aria-labelledby="codes-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="codes-title" className="text-sm font-bold">
            Códigos y sorteos
          </h2>
          <p className="max-w-[70ch] text-xs text-muted-foreground">
            Un código da un premio: un artículo (para siempre o por días),
            puntos, monedas VIP o días de VIP. Pásaselo al ganador por un canal
            privado: cada código se canjea una vez por cuenta.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <PlusIcon /> Nuevo código
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label="Fallos en la última hora"
          value={attempts.data?.last_hour}
        />
        <StatTile label="Fallos en 24 horas" value={attempts.data?.last_day} />
        <StatTile
          label="Cuentas bloqueadas"
          value={attempts.data?.blocked.length}
          valueClassName={
            attempts.data?.blocked.length ? "text-destructive" : undefined
          }
        >
          <button
            type="button"
            className="self-start text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setAttemptsOpen(true)}
          >
            Ver intentos
          </button>
        </StatTile>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="w-full max-w-[280px]"
          placeholder="Buscar código, sorteo o nota..."
          aria-label="Buscar código"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
        <Select
          value={state}
          onValueChange={(v) => {
            setState(v as CodeState | "all")
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[160px]" aria-label="Estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(Object.keys(STATE_LABEL) as CodeState[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {list.isError ? (
        <p className="text-sm text-destructive">{errorMessage(list.error)}</p>
      ) : !list.data?.items.length ? (
        <p className="py-4 text-sm text-muted-foreground">
          {list.isPending ? "Cargando..." : "No hay códigos con ese filtro."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Sorteo</TableHead>
              <TableHead>Premio</TableHead>
              <TableHead className="text-right">Usos</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.items.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 font-mono text-xs hover:text-primary"
                    title="Copiar"
                    onClick={() => void copy(c.code)}
                  >
                    {c.code} <CopyIcon className="size-3" />
                  </button>
                  {c.for_user && (
                    <span className="block text-[11px] text-muted-foreground">
                      Para {c.for_user.alias ?? c.for_user.nick}
                    </span>
                  )}
                </TableCell>
                <TableCell className="max-w-[180px] truncate text-xs">
                  {c.label ?? "—"}
                </TableCell>
                <TableCell className="text-xs">{prizeText(c.prize)}</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {c.uses} / {c.max_uses}
                </TableCell>
                <TableCell className="text-xs">
                  {fmtDate(c.expires_at)}
                </TableCell>
                <TableCell>
                  <Badge variant={STATE_TONE[c.state]}>
                    {STATE_LABEL[c.state]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setViewing(c)}
                  >
                    Canjes
                  </Button>
                  {c.state !== "revoked" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setRevoking(c)}
                    >
                      Revocar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          Página {page} de {pages}
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {creating && (
        <CreateCodeDialog
          onClose={() => setCreating(false)}
          onCreated={(r) => {
            setCreating(false)
            setCreated(r)
          }}
        />
      )}
      <CreatedDialog created={created} onClose={() => setCreated(null)} />
      {viewing && (
        <RedemptionsDialog code={viewing} onClose={() => setViewing(null)} />
      )}
      <AttemptsDialog open={attemptsOpen} onOpenChange={setAttemptsOpen} />
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => {
          if (!o) {
            setRevoking(null)
            revoke.reset()
          }
        }}
        title={`Revocar ${revoking?.code ?? ""}`}
        description="Deja de servir desde ahora. Lo que ya se canjeó no se quita: para eso, revierte cada canje."
        confirmLabel="Revocar"
        danger
        reason={{ label: "Motivo", required: true }}
        pending={revoke.isPending}
        error={revoke.error}
        onConfirm={async (reason) => {
          if (!revoking) return
          try {
            await revoke.mutateAsync({ id: revoking.id, reason })
            toast.success("Código revocado.")
            setRevoking(null)
          } catch {
            // el error se muestra en la ventana
          }
        }}
      />
    </section>
  )
}

// ---------- crear ----------

/** Fin del día elegido (hora local), para "sirve hasta". */
const endOfDay = (d: string) => new Date(`${d}T23:59:59`).toISOString()
const startOfDay = (d: string) => new Date(`${d}T00:00:00`).toISOString()
const inDays = (n: number) => {
  const t = new Date(Date.now() + n * 86_400_000)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
}

export function CreateCodeDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (r: { codes: string[]; prize: string; label: string }) => void
}) {
  const id = useId()
  const create = useCreateCodes()
  const vipFree = useQuery(configOptions).data?.code_vip_free ?? true
  const [reward, setReward] = useState<Reward>("item")
  const [item, setItem] = useState<Schemas["AdminShopItem"] | null>(null)
  const [itemQ, setItemQ] = useState("")
  const [forever, setForever] = useState(true)
  const [days, setDays] = useState(7)
  const [amount, setAmount] = useState(500)
  const [maxUses, setMaxUses] = useState(1)
  const [count, setCount] = useState(1)
  const [startsAt, setStartsAt] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [forUser, setForUser] = useState<{ id: string; alias: string } | null>(
    null
  )
  const [userQ, setUserQ] = useState("")
  const [custom, setCustom] = useState("")
  const [label, setLabel] = useState("")
  const [note, setNote] = useState("")

  const itemTerm = useDebouncedValue(itemQ.trim(), 300)
  const items = useQuery({
    ...adminItemsOptions({
      page: 1,
      per: 8,
      sort: "name",
      order: "asc",
      ...(itemTerm ? { q: itemTerm } : {}),
    }),
    enabled: reward === "item" && !item,
  })
  const userTerm = useDebouncedValue(userQ.trim(), 300)
  const users = useQuery({
    ...adminAccountsOptions({
      page: 1,
      per: 6,
      sort: "alias",
      order: "asc",
      q: userTerm,
    }),
    enabled: !forUser && userTerm.length >= 2,
  })

  const needsDays = reward === "vip" || (reward === "item" && !forever)
  const one = !!forUser || !!custom.trim()
  const ready =
    (reward !== "item" || !!item) &&
    (reward === "item" || reward === "vip" || amount >= 1) &&
    (!needsDays || (days >= 1 && days <= 365))
  const body: Schemas["CodeCreate"] = {
    reward,
    ...(reward === "item" && item ? { item: item.id } : {}),
    ...(reward === "points" || reward === "vip_coins" ? { amount } : {}),
    ...(needsDays ? { days } : {}),
    max_uses: forUser ? 1 : maxUses,
    count: one ? 1 : count,
    ...(startsAt ? { starts_at: startOfDay(startsAt) } : {}),
    ...(expiresAt ? { expires_at: endOfDay(expiresAt) } : {}),
    ...(forUser ? { for_user: forUser.id } : {}),
    ...(custom.trim() ? { custom: custom.trim() } : {}),
    ...(label.trim() ? { label: label.trim() } : {}),
    ...(note.trim() ? { note: note.trim() } : {}),
  }
  const prize = prizeText({
    reward,
    item: item ? { ...item, url: null, poster_url: null } : null,
    amount: reward === "points" || reward === "vip_coins" ? amount : null,
    days: needsDays ? days : null,
  })

  async function submit() {
    try {
      const r = await create.mutateAsync(body)
      onCreated({
        codes: r.codes.map((c) => c.code),
        prize,
        label: label.trim(),
      })
    } catch {
      // el error se muestra en la ventana
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !create.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Nuevo código</DialogTitle>
          <DialogDescription>
            El premio, cuántas veces se puede usar y hasta cuándo. Cada cuenta
            lo canjea una sola vez.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 text-sm">
          <div className="grid gap-1.5">
            <Label>Premio</Label>
            <Select
              value={reward}
              onValueChange={(v) => setReward(v as Reward)}
            >
              <SelectTrigger aria-label="Premio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REWARD) as Reward[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {REWARD[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reward === "item" &&
            (item ? (
              <div className="flex items-center gap-3 rounded-lg border p-2">
                <ItemThumb
                  item={{ ...item, url: null, poster_url: null }}
                  size={40}
                />
                <span className="flex-1">
                  {item.name}
                  {(item.vip_only || !item.active) && (
                    <span className="block text-xs text-muted-foreground">
                      {[
                        item.vip_only &&
                          (vipFree
                            ? "VIP: el ganador lo usa aunque no sea VIP"
                            : "VIP: se usa siendo VIP"),
                        !item.active && "No está en la tienda",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setItem(null)}>
                  Cambiar
                </Button>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-item`}>Artículo</Label>
                <Input
                  id={`${id}-item`}
                  placeholder="Buscar por nombre..."
                  value={itemQ}
                  onChange={(e) => setItemQ(e.target.value)}
                />
                <ul className="flex flex-col divide-y rounded-lg border">
                  {(items.data?.items ?? [])
                    .filter((i) => !i.vip_reward)
                    .map((i) => (
                      <li key={i.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 p-2 text-left hover:bg-muted/50"
                          onClick={() => setItem(i)}
                        >
                          <ItemThumb
                            item={{ ...i, url: null, poster_url: null }}
                            size={32}
                          />
                          <span className="flex-1 truncate">{i.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {i.kind}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}

          {reward === "item" && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={forever ? "default" : "outline"}
                onClick={() => setForever(true)}
              >
                Para siempre
              </Button>
              <Button
                size="sm"
                variant={!forever ? "default" : "outline"}
                onClick={() => setForever(false)}
              >
                Por días
              </Button>
            </div>
          )}

          {needsDays && (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-days`}>Días</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id={`${id}-days`}
                  type="number"
                  min={1}
                  max={365}
                  className="w-24"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                />
                {(reward === "vip" ? [7, 30, 90] : [7, 30]).map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant="outline"
                    onClick={() => setDays(d)}
                  >
                    {d === 7 ? "1 semana" : d === 30 ? "1 mes" : "3 meses"}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {(reward === "points" || reward === "vip_coins") && (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-amount`}>
                {reward === "points" ? "Puntos" : "Monedas VIP"}
              </Label>
              <Input
                id={`${id}-amount`}
                type="number"
                min={1}
                max={100000}
                className="w-32"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-uses`}>Usos de cada código</Label>
              <Input
                id={`${id}-uses`}
                type="number"
                min={1}
                max={10000}
                disabled={!!forUser}
                value={forUser ? 1 : maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-count`}>Cuántos códigos</Label>
              <Input
                id={`${id}-count`}
                type="number"
                min={1}
                max={100}
                disabled={one}
                value={one ? 1 : count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-starts`}>Sirve desde (opcional)</Label>
              <Input
                id={`${id}-starts`}
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-expires`}>Sirve hasta (opcional)</Label>
              <Input
                id={`${id}-expires`}
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <span className="flex gap-2 text-xs">
                {[7, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => setExpiresAt(inDays(d))}
                  >
                    En {daysText(d)}
                  </button>
                ))}
              </span>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-user`}>
              Solo para una cuenta (opcional)
            </Label>
            {forUser ? (
              <div className="flex items-center gap-2 rounded-lg border p-2">
                <span className="flex-1">{forUser.alias}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setForUser(null)}
                >
                  Quitar
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id={`${id}-user`}
                  placeholder="Alias o nick del ganador..."
                  value={userQ}
                  onChange={(e) => setUserQ(e.target.value)}
                />
                {!!users.data?.items.length && (
                  <ul className="flex flex-col divide-y rounded-lg border">
                    {users.data.items.map((a) => (
                      <li key={a.user.id}>
                        <button
                          type="button"
                          className="w-full p-2 text-left hover:bg-muted/50"
                          onClick={() =>
                            setForUser({
                              id: a.user.id,
                              alias: a.user.alias ?? a.user.id,
                            })
                          }
                        >
                          {a.user.alias}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-custom`}>
              Código personalizado (opcional)
            </Label>
            <Input
              id={`${id}-custom`}
              placeholder="NAVIDAD-2026"
              maxLength={30}
              className="font-mono uppercase"
              value={custom}
              onChange={(e) =>
                setCustom(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "")
                )
              }
            />
            {custom.trim() && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Un código elegido a mano se adivina más fácil que uno al azar.
                Úsalo solo en un stream o con pocos usos.
              </span>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-label`}>Sorteo</Label>
            <Input
              id={`${id}-label`}
              placeholder="Sorteo Discord 17/11"
              maxLength={80}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-note`}>Nota interna (opcional)</Label>
            <Input
              id={`${id}-note`}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
            {one || count === 1 ? "1 código" : `${count} códigos`} de {prize}
            {forUser
              ? ` solo para ${forUser.alias}`
              : ` · ${maxUses} uso${maxUses === 1 ? "" : "s"} cada uno`}
            .
          </p>
          {!!create.error && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(create.error)}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={create.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={!ready || create.isPending}
          >
            Generar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreatedDialog({
  created,
  onClose,
}: {
  created: { codes: string[]; prize: string; label: string } | null
  onClose: () => void
}) {
  function download() {
    if (!created) return
    const csv = codesCsv(
      created.codes.map((code) => ({ code })),
      created.prize,
      created.label
    )
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    const a = document.createElement("a")
    a.href = href
    a.download = `codigos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(href)
  }
  return (
    <Dialog open={!!created} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {created?.codes.length === 1
              ? "Código generado"
              : `${created?.codes.length ?? 0} códigos generados`}
          </DialogTitle>
          <DialogDescription>
            {created?.prize}. No los publiques en un canal abierto: el primero
            que lo escriba se lleva el premio.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-[40vh] overflow-y-auto rounded-lg border bg-muted/30 p-3 font-mono text-sm">
          {created?.codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={download}>
            <DownloadIcon /> Bajar CSV
          </Button>
          <Button
            onClick={() =>
              void copy(created?.codes.join("\n") ?? "", "Códigos copiados.")
            }
          >
            <CopyIcon /> Copiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- canjes e intentos ----------

function RedemptionsDialog({
  code,
  onClose,
}: {
  code: AdminCode
  onClose: () => void
}) {
  const list = useQuery(adminRedemptionsOptions(code.id))
  const revert = useRevertRedemption()
  const [reverting, setReverting] = useState<string | null>(null)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="font-mono">{code.code}</DialogTitle>
          <DialogDescription>
            {prizeText(code.prize)} · {code.uses} de {code.max_uses} usos
            {code.label ? ` · ${code.label}` : ""}
          </DialogDescription>
        </DialogHeader>
        {list.isError ? (
          <p className="text-sm text-destructive">{errorMessage(list.error)}</p>
        ) : !list.data?.items.length ? (
          <p className="py-4 text-sm text-muted-foreground">
            {list.isPending ? "Cargando..." : "Nadie lo canjeó todavía."}
          </p>
        ) : (
          <ul className="max-h-[50vh] divide-y overflow-y-auto text-sm">
            {list.data.items.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">
                    {r.account?.alias ?? r.account?.nick ?? "Cuenta borrada"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.redeemed_at).toLocaleString("es", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                    {r.reverted_at
                      ? ` · revertido por ${r.reverted_by?.alias ?? "un admin"}: ${r.revert_reason ?? ""}`
                      : r.until
                        ? ` · hasta el ${fmtDate(r.until)}`
                        : ""}
                  </span>
                </span>
                {!r.reverted_at && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setReverting(r.id)}
                  >
                    Revertir
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <ConfirmDialog
          open={!!reverting}
          onOpenChange={(o) => {
            if (!o) {
              setReverting(null)
              revert.reset()
            }
          }}
          title="Revertir el canje"
          description="Le quita el premio: los puntos o las monedas, el período de VIP o el artículo (si no lo compró después). El código recupera el uso, pero esa cuenta no lo puede volver a canjear. Le llega un aviso."
          confirmLabel="Revertir"
          danger
          reason={{
            label: "Motivo",
            required: true,
            help: "La cuenta lo ve en el aviso.",
          }}
          pending={revert.isPending}
          error={revert.error}
          onConfirm={async (reason) => {
            if (!reverting) return
            try {
              await revert.mutateAsync({ id: reverting, reason })
              toast.success("Canje revertido.")
              setReverting(null)
            } catch {
              // el error se muestra en la ventana
            }
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function AttemptsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const q = useQuery({ ...adminAttemptsOptions, enabled: open })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Intentos fallidos</DialogTitle>
          <DialogDescription>
            Códigos que no existen, revocados o que todavía no empiezan. 5
            fallos en 15 minutos o 20 en 24 horas bloquean el canje de esa
            cuenta. Se borran a los 30 días.
          </DialogDescription>
        </DialogHeader>
        {q.isError ? (
          <p className="text-sm text-destructive">{errorMessage(q.error)}</p>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            {!!q.data?.blocked.length && (
              <div className="flex flex-col gap-1">
                <h3 className="text-[13px] font-semibold">Bloqueadas ahora</h3>
                <ul className="divide-y rounded-lg border">
                  {q.data.blocked.map((b) => (
                    <li
                      key={b.account?.id}
                      className="flex justify-between p-2"
                    >
                      <span>{b.account?.alias ?? b.account?.nick}</span>
                      <span className="text-xs text-muted-foreground">
                        hasta{" "}
                        {new Date(b.until).toLocaleString("es", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!q.data?.attempts.length ? (
              <p className="py-4 text-muted-foreground">
                {q.isPending ? "Cargando..." : "No hay intentos fallidos."}
              </p>
            ) : (
              <ul className="max-h-[45vh] divide-y overflow-y-auto">
                {q.data.attempts.map((a, k) => (
                  <li key={k} className="flex items-center gap-3 py-1.5">
                    <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                      {new Date(a.at).toLocaleString("es", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                    <span className="flex-1 truncate">
                      {a.account?.alias ?? a.account?.nick}
                    </span>
                    <span className="font-mono text-xs">
                      {a.typed ? `${a.typed}…` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
