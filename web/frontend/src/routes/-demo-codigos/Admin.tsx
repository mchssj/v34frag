import { cn } from "cn"
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  PlusIcon,
  SearchIcon,
  ShieldAlertIcon,
} from "lucide-react"
import { Fragment, useMemo, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { Eyebrow } from "@/components/brand/SectionHeading"
import { Segmented } from "@/components/brand/Segmented"
import { StatTile } from "@/components/brand/StatTile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { Thumb } from "@/features/shop/parts"

import {
  PrizeArt,
  StateBadge,
  fmtDate,
  itemName,
  prizeText,
  span,
  type Items,
} from "./parts"
import {
  DAY,
  MAX_BATCH,
  REWARD_LABEL,
  blockedUntil,
  codeState,
  type Code,
  type CodeState,
  type CreateInput,
  type Reward,
  type Sim,
} from "./sim"

type Dur = "7" | "30" | "forever" | "custom"
type VipDur = "7" | "30" | "90" | "custom"
type Exp = "none" | "7" | "30"
type Filter = "todos" | CodeState

const COPY = (text: string, what = "Copiado.") =>
  navigator.clipboard?.writeText(text).then(
    () => toast.success(what),
    () => toast.error("No se pudo copiar.")
  )

export function AdminCodes({
  sim,
  items,
  onCreate,
  onRevoke,
  onRevert,
}: {
  sim: Sim
  items: Items
  onCreate: (i: CreateInput) => { error?: string; codes?: Code[] }
  onRevoke: (id: string, reason: string) => void
  onRevert: (id: string, reason: string) => void
}) {
  // ---------- Formulario ----------
  const [reward, setReward] = useState<Reward>("vip")
  const [itemId, setItemId] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [dur, setDur] = useState<Dur>("forever")
  const [vipDur, setVipDur] = useState<VipDur>("7")
  const [customDays, setCustomDays] = useState("14")
  const [amount, setAmount] = useState("500")
  const [uses, setUses] = useState("1")
  const [count, setCount] = useState("1")
  const [exp, setExp] = useState<Exp>("7")
  const [forUser, setForUser] = useState<string>("nadie")
  const [custom, setCustom] = useState("")
  const [label, setLabel] = useState("")
  const [note, setNote] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [created, setCreated] = useState<Code[] | null>(null)

  const giftable = useMemo(
    () => [...items.values()].filter((i) => !i.vip_reward),
    [items]
  )
  const found = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = t
      ? giftable.filter((i) =>
          `${itemName(i)} ${i.id}`.toLowerCase().includes(t)
        )
      : giftable
    return list.slice(0, 18)
  }, [giftable, q])

  function days(): number | null {
    if (reward === "vip")
      return vipDur === "custom" ? Number(customDays) : Number(vipDur)
    if (reward === "item")
      return dur === "forever"
        ? null
        : dur === "custom"
          ? Number(customDays)
          : Number(dur)
    return null
  }

  function generate() {
    const r = onCreate({
      reward,
      itemId,
      amount: Number(amount),
      days: days(),
      maxUses: forUser !== "nadie" ? 1 : Number(uses),
      count: custom.trim() ? 1 : Number(count),
      expiresInDays: exp === "none" ? null : Number(exp),
      forUser: forUser === "nadie" ? null : forUser,
      custom: custom.trim() || null,
      label,
      note,
    })
    if (r.error) return setFormError(r.error)
    setFormError(null)
    setCreated(r.codes!)
  }

  const preview = {
    reward,
    itemId,
    amount: Number(amount) || 0,
    days: days(),
  }

  // ---------- Lista ----------
  const [filter, setFilter] = useState<Filter>("todos")
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<Code | null>(null)
  const [reverting, setReverting] = useState<string | null>(null)

  const list = sim.codes.filter((c) => {
    if (filter !== "todos" && codeState(c, sim.now) !== filter) return false
    const t = search.trim().toLowerCase()
    return !t || `${c.display} ${c.label}`.toLowerCase().includes(t)
  })
  const alias = (id: string) =>
    sim.accounts.find((a) => a.id === id)?.alias ?? id

  // ---------- Contadores ----------
  const active = sim.codes.filter(
    (c) => codeState(c, sim.now) === "activo"
  ).length
  const week = sim.redemptions.filter(
    (r) => r.at > sim.now - 7 * DAY && !r.revertedAt
  ).length
  const fails = sim.attempts.filter((a) => a.at > sim.now - DAY)
  const blocked = sim.accounts.filter((a) => blockedUntil(sim, a.id))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Administración › Tienda › Códigos</Eyebrow>
        <h1 className="text-[28px] leading-tight font-bold tracking-[-0.8px]">
          Códigos y sorteos
        </h1>
        <p className="max-w-[70ch] text-sm text-muted-foreground">
          Generá códigos con un premio de la tienda, puntos, monedas VIP o días
          de VIP, y pasáselos a los ganadores. Solo los admins ven esta sección.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Códigos activos" value={active} />
        <StatTile label="Canjes (7 días)" value={week} />
        <StatTile label="Intentos fallidos (24 h)" value={fails.length} />
        <StatTile
          label="Cuentas pausadas"
          value={blocked.length}
          valueClassName={blocked.length ? "text-destructive" : undefined}
        />
      </div>

      {/* ---------- Nuevo código ---------- */}
      <Card variant="outline" radius="tile" className="flex flex-col gap-5 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <PlusIcon aria-hidden className="size-4" /> Nuevo código
        </h2>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex flex-col gap-5">
            <Row label="Premio">
              <Segmented
                label="Premio"
                size="lg"
                value={reward}
                onChange={setReward}
                options={(Object.keys(REWARD_LABEL) as Reward[]).map((r) => ({
                  value: r,
                  label: REWARD_LABEL[r],
                }))}
              />
            </Row>

            {reward === "item" && (
              <>
                <Row
                  label="Artículo"
                  hint="Cualquiera de la tienda, también los VIP y los que no están a la venta. El Marco Oro VIP no: viene con el VIP."
                >
                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <SearchIcon
                        aria-hidden
                        className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                      />
                      <Input
                        aria-label="Buscar artículo"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Buscar marco, sticker, fondo…"
                        className="pl-8"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {found.map((i) => (
                        <button
                          key={i.id}
                          type="button"
                          onClick={() => setItemId(i.id)}
                          aria-pressed={itemId === i.id}
                          title={itemName(i)}
                          className={cn(
                            "flex flex-col overflow-hidden rounded-lg border text-left transition-colors hover:border-primary/60",
                            itemId === i.id &&
                              "border-primary ring-2 ring-primary/30"
                          )}
                        >
                          <Thumb i={i} alias="v34|Pepon" small />
                          <span className="truncate px-1.5 py-1 text-[11px]">
                            {i.name}
                            {i.vip_only && (
                              <span className="ml-1 text-[#e8b53a]">VIP</span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </Row>
                <Row label="Duración">
                  <div className="flex flex-wrap items-center gap-2">
                    <Segmented
                      label="Duración del artículo"
                      size="lg"
                      value={dur}
                      onChange={setDur}
                      options={[
                        { value: "forever", label: "Para siempre" },
                        { value: "7", label: "1 semana" },
                        { value: "30", label: "1 mes" },
                        { value: "custom", label: "Días" },
                      ]}
                    />
                    {dur === "custom" && (
                      <DaysInput value={customDays} onChange={setCustomDays} />
                    )}
                  </div>
                </Row>
              </>
            )}

            {reward === "vip" && (
              <Row
                label="Duración"
                hint="Si ya es VIP, se suma al final de lo que tiene. Menos de 30 días no da las monedas de bienvenida."
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented
                    label="Duración del VIP"
                    size="lg"
                    value={vipDur}
                    onChange={setVipDur}
                    options={[
                      { value: "7", label: "1 semana" },
                      { value: "30", label: "1 mes" },
                      { value: "90", label: "3 meses" },
                      { value: "custom", label: "Días" },
                    ]}
                  />
                  {vipDur === "custom" && (
                    <DaysInput value={customDays} onChange={setCustomDays} />
                  )}
                </div>
              </Row>
            )}

            {(reward === "points" || reward === "vip_coins") && (
              <Row label="Cantidad">
                <Input
                  type="number"
                  min={1}
                  max={100000}
                  aria-label="Cantidad"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-32 font-mono"
                />
              </Row>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <Row
                label="Solo para una cuenta"
                hint="El ganador ya elegido. Nadie más lo puede canjear."
              >
                <Select value={forUser} onValueChange={setForUser}>
                  <SelectTrigger
                    className="w-full"
                    aria-label="Solo para una cuenta"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nadie">Cualquier cuenta</SelectItem>
                    {sim.accounts
                      .filter((a) => !a.banned)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.alias}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Row>
              <Row
                label="Vence"
                hint="Hasta cuándo se puede canjear. No es la duración del premio."
              >
                <Segmented
                  label="Vencimiento"
                  size="lg"
                  value={exp}
                  onChange={setExp}
                  options={[
                    { value: "7", label: "7 días" },
                    { value: "30", label: "30 días" },
                    { value: "none", label: "Nunca" },
                  ]}
                />
              </Row>
              <Row
                label="Usos por código"
                hint="Cada cuenta lo canjea una sola vez."
              >
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  aria-label="Usos por código"
                  value={forUser !== "nadie" ? "1" : uses}
                  disabled={forUser !== "nadie"}
                  onChange={(e) => setUses(e.target.value)}
                  className="w-32 font-mono"
                />
              </Row>
              <Row
                label="Cantidad de códigos"
                hint={`Un lote de hasta ${MAX_BATCH}, todos con el mismo premio.`}
              >
                <Input
                  type="number"
                  min={1}
                  max={MAX_BATCH}
                  aria-label="Cantidad de códigos"
                  value={custom.trim() ? "1" : count}
                  disabled={!!custom.trim()}
                  onChange={(e) => setCount(e.target.value)}
                  className="w-32 font-mono"
                />
              </Row>
              <Row label="Sorteo" hint="Lo ve el jugador en sus canjes.">
                <Input
                  aria-label="Sorteo"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={80}
                  placeholder="Sorteo Discord 17/11"
                />
              </Row>
              <Row label="Nota interna (opcional)">
                <Input
                  aria-label="Nota interna"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  placeholder="Ganador: el del clip del viernes"
                />
              </Row>
            </div>

            <Row label="Código personalizado (opcional)">
              <div className="flex flex-col gap-1.5">
                <Input
                  aria-label="Código personalizado"
                  value={custom}
                  onChange={(e) =>
                    setCustom(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                    )
                  }
                  maxLength={24}
                  placeholder="Al azar: CML-XXXX-XXXX-XXXX"
                  className="max-w-xs font-mono uppercase"
                />
                {custom.trim() && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangleIcon
                      aria-hidden
                      className="mt-px size-3.5 shrink-0"
                    />
                    Uno personalizado se adivina más fácil que uno al azar.
                    Usalo para un stream con pocos usos y vencimiento corto.
                  </p>
                )}
              </div>
            </Row>
          </div>

          {/* Vista previa */}
          <div className="flex flex-col gap-3">
            <Card
              variant="outline"
              className="flex flex-col items-center gap-3 bg-muted/30 p-5 text-center"
            >
              <span className="text-xs text-muted-foreground">
                Lo que recibe el ganador
              </span>
              {reward === "item" && !itemId ? (
                <p className="py-8 text-sm text-muted-foreground">
                  Elegí un artículo.
                </p>
              ) : (
                <>
                  <PrizeArt p={preview} items={items} alias="v34|Pepon" />
                  <span className="font-semibold">
                    {prizeText(preview, items)}
                  </span>
                </>
              )}
              <span className="text-xs text-muted-foreground">
                {forUser !== "nadie"
                  ? `Solo ${alias(forUser)} · 1 uso`
                  : `${Number(uses) || 0} ${Number(uses) === 1 ? "uso" : "usos"}`}
                {" · "}
                {exp === "none" ? "no vence" : `vence en ${exp} días`}
              </span>
            </Card>
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
            <Button size="lg" onClick={generate}>
              Generar{" "}
              {!custom.trim() && Number(count) > 1
                ? `${count} códigos`
                : "código"}
            </Button>
          </div>
        </div>
      </Card>

      {/* ---------- Lista ---------- */}
      <Card variant="outline" radius="tile" className="flex flex-col p-0">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
          <h2 className="mr-auto text-base font-semibold">Códigos</h2>
          <Segmented
            label="Estado"
            size="sm"
            value={filter}
            onChange={setFilter}
            options={(
              ["todos", "activo", "agotado", "vencido", "revocado"] as const
            ).map((v) => ({
              value: v,
              label:
                v === "todos"
                  ? "Todos"
                  : v[0]!.toUpperCase() + v.slice(1) + "s",
            }))}
          />
          <Input
            aria-label="Buscar código o sorteo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar código o sorteo"
            className="h-7 w-48 text-xs"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
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
            {list.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-muted-foreground"
                >
                  No hay códigos con ese filtro.
                </TableCell>
              </TableRow>
            )}
            {list.map((c) => {
              const st = codeState(c, sim.now)
              const reds = sim.redemptions.filter((r) => r.codeId === c.id)
              const isOpen = open === c.id
              return (
                <Fragment key={c.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setOpen(isOpen ? null : c.id)}
                  >
                    <TableCell>
                      {isOpen ? (
                        <ChevronDownIcon className="size-4" />
                      ) : (
                        <ChevronRightIcon className="size-4" />
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        <code className="font-mono text-xs font-semibold">
                          {c.display}
                        </code>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label="Copiar código"
                          onClick={(e) => {
                            e.stopPropagation()
                            COPY(c.display, "Código copiado.")
                          }}
                        >
                          <CopyIcon />
                        </Button>
                      </span>
                      {c.forUser && (
                        <span className="block text-[11px] text-muted-foreground">
                          Solo {alias(c.forUser)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {c.label}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <PrizeArt
                          p={c}
                          items={items}
                          alias="v34|Pepon"
                          small
                          className="size-8 h-8"
                        />
                        <span className="text-xs">{prizeText(c, items)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {c.uses} / {c.maxUses.toLocaleString("es")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.expiresAt ? fmtDate(c.expiresAt) : "Nunca"}
                    </TableCell>
                    <TableCell>
                      <StateBadge state={st} />
                    </TableCell>
                    <TableCell className="text-right">
                      {(st === "activo" || st === "programado") && (
                        <Button
                          size="xs"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRevoking(c)
                          }}
                        >
                          Revocar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell />
                      <TableCell colSpan={7} className="py-3">
                        <div className="flex flex-col gap-2 text-xs">
                          <span className="text-muted-foreground">
                            Creado el {fmtDate(c.createdAt)}
                            {c.custom && " · personalizado"}
                            {c.note && ` · ${c.note}`}
                            {c.revokeReason && ` · Revocado: ${c.revokeReason}`}
                          </span>
                          {reds.length === 0 ? (
                            <span className="text-muted-foreground">
                              Nadie lo canjeó todavía.
                            </span>
                          ) : (
                            <ul className="flex flex-col divide-y rounded-lg border bg-background">
                              {reds.map((r) => (
                                <li
                                  key={r.id}
                                  className="flex items-center gap-3 px-3 py-2"
                                >
                                  <span className="font-medium">
                                    {alias(r.user)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {fmtDate(r.at)}
                                  </span>
                                  {r.until && (
                                    <span className="text-muted-foreground">
                                      hasta {fmtDate(r.until)}
                                    </span>
                                  )}
                                  <span className="ml-auto">
                                    {r.revertedAt ? (
                                      <Badge
                                        variant="danger"
                                        size="sm"
                                        title={r.revertReason ?? undefined}
                                      >
                                        Revertido
                                      </Badge>
                                    ) : (
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        onClick={() => setReverting(r.id)}
                                      >
                                        Revertir
                                      </Button>
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      {/* ---------- Intentos fallidos ---------- */}
      <Card variant="outline" radius="tile" className="flex flex-col p-0">
        <h2 className="flex items-center gap-2 border-b px-5 py-3 text-base font-semibold">
          <ShieldAlertIcon aria-hidden className="size-4" /> Intentos fallidos
          <span className="text-xs font-normal text-muted-foreground">
            Códigos que no existen. 5 en 15 minutos pausan 15 minutos; 20 en el
            día, hasta el día siguiente.
          </span>
        </h2>
        {sim.attempts.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">
            Sin intentos fallidos.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead>Cuándo</TableHead>
                <TableHead>Escribió</TableHead>
                <TableHead>Estado de la cuenta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...sim.attempts]
                .sort((a, b) => b.at - a.at)
                .slice(0, 12)
                .map((a, k) => {
                  const b = blockedUntil(sim, a.user)
                  return (
                    <TableRow key={k}>
                      <TableCell className="font-medium">
                        {alias(a.user)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDate(a.at)}
                      </TableCell>
                      <TableCell>
                        <code className="font-mono text-xs">{a.typed}…</code>
                      </TableCell>
                      <TableCell>
                        {b ? (
                          <Badge variant="danger" size="sm">
                            Pausada {span(b - sim.now)}
                          </Badge>
                        ) : (
                          <Badge variant="muted" size="sm">
                            Puede canjear
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* ---------- Ventanas ---------- */}
      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {created?.length === 1
                ? "Código generado"
                : `${created?.length} códigos generados`}
            </DialogTitle>
            <DialogDescription>
              {created?.[0] && prizeText(created[0], items)}. Pasáselos a los
              ganadores por privado: si los publicás en un canal abierto, los
              canjea el primero que los vea.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
            {created?.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
              >
                <code className="font-mono text-sm font-semibold tracking-[1px]">
                  {c.display}
                </code>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Copiar"
                  onClick={() => COPY(c.display, "Código copiado.")}
                >
                  <CopyIcon />
                </Button>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => created && downloadCsv(created, items)}
            >
              <DownloadIcon /> Bajar CSV
            </Button>
            <Button
              onClick={() =>
                created &&
                COPY(
                  created.map((c) => c.display).join("\n"),
                  "Códigos copiados."
                )
              }
            >
              <CopyIcon /> Copiar {created && created.length > 1 ? "todos" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Revocar código"
        description={
          revoking && (
            <>
              <code className="font-mono">{revoking.display}</code> deja de
              servir. Lo que ya se canjeó sigue: para quitarlo, revertí cada
              canje.
            </>
          )
        }
        confirmLabel="Revocar"
        danger
        reason={{ label: "Motivo", required: true }}
        pending={false}
        error={null}
        onConfirm={(why) => {
          onRevoke(revoking!.id, why)
          setRevoking(null)
          toast.success("Código revocado.")
        }}
      />

      <ConfirmDialog
        open={!!reverting}
        onOpenChange={(o) => !o && setReverting(null)}
        title="Revertir canje"
        description="Se le quita lo que recibió: el artículo (o vuelve a como lo tenía), el VIP de ese código o los puntos, con una fila negativa en su historial. El código recupera el uso y la cuenta recibe un aviso."
        confirmLabel="Revertir"
        danger
        reason={{
          label: "Motivo",
          help: "Lo ve el jugador en el aviso.",
          required: true,
        }}
        pending={false}
        error={null}
        onConfirm={(why) => {
          onRevert(reverting!, why)
          setReverting(null)
          toast.success("Canje revertido.")
        }}
      />
    </div>
  )
}

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function DaysInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Input
        type="number"
        min={1}
        max={365}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 font-mono"
        aria-label="Días"
      />
      días
    </span>
  )
}

function downloadCsv(codes: Code[], items: Items) {
  const rows = [
    ["codigo", "premio", "usos", "vence", "sorteo"],
    ...codes.map((c) => [
      c.display,
      prizeText(c, items),
      String(c.maxUses),
      c.expiresAt ? new Date(c.expiresAt).toISOString() : "",
      c.label,
    ]),
  ]
  const csv = rows
    .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
    .join("\n")
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
  a.download = "codigos.csv"
  a.click()
  URL.revokeObjectURL(a.href)
}
