import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { XIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { ROLE_LABEL } from "@/auth/roles"
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
import { playerDetailOptions } from "@/features/admin/players/queries"
import { SearchBox } from "@/features/ranking/SearchBox"
import { ConfirmDialog } from "../dialogs"
import { isBlockedName } from "../errors"
import { endOfDayIso, fmtDate, isoDatePlus, type Tone } from "../format"
import {
  Chip,
  EmptyState,
  FilterChips,
  PanelSection,
  Pager,
  PickHint,
  QueryError,
  SplitLayout,
  TableBox,
  headCell,
} from "../ui"
import { BanDialog } from "../bans/BanDialog"
import {
  USERS_PER,
  usersOptions,
  useGrantVip,
  useRevokeVip,
  useSetAlias,
  useSetRole,
  userVipOptions,
  streamerOptions,
  useGrantStreamer,
  useRevokeStreamer,
  type AccountFilter,
  type AdminUser,
  type SettableRole,
  type VipGrant,
} from "./queries"

const ROLE_TONE: Record<string, Tone> = {
  admin: "strong",
  moderator: "primary",
  organizer: "neutral",
  user: "neutral",
}

const roleLabel = (r: string) => ROLE_LABEL[r as keyof typeof ROLE_LABEL] ?? r

export function AccountsTab({
  selected,
  onSelect,
  initialQ,
}: {
  selected: string | null
  onSelect: (id: string | null) => void
  /** Búsqueda inicial (al llegar desde "Cambiar alias" de Palabras bloqueadas). */
  initialQ?: string
}) {
  const [q, setQ] = useState<string | undefined>(initialQ)
  const [filter, setFilter] = useState<AccountFilter>("all")
  const [page, setPage] = useState(1)
  const list = useQuery(usersOptions(q ?? "", filter, page))
  const current = list.data?.items.find((u) => u.id === selected) ?? null

  return (
    <SplitLayout
      asideLabel="Detalle de la cuenta"
      main={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox
              value={q}
              label="Buscar cuentas"
              placeholder="Alias"
              onChange={(v) => {
                setQ(v)
                setPage(1)
              }}
            />
            <FilterChips
              label="Filtrar cuentas"
              value={filter}
              onChange={(f) => {
                setFilter(f)
                setPage(1)
              }}
              options={[
                { value: "all", label: "Todas" },
                { value: "admin", label: "Admins" },
                { value: "moderator", label: "Moderadores" },
                { value: "organizer", label: "Organizadores" },
                { value: "streamer", label: "Streamers" },
                { value: "noplayer", label: "Sin ficha" },
              ]}
            />
          </div>
          {list.isError ? (
            <QueryError
              error={list.error}
              onRetry={() => void list.refetch()}
            />
          ) : list.isPending ? (
            <Skeleton className="h-80 rounded-xl" />
          ) : list.data.items.length === 0 ? (
            <EmptyState>Ninguna cuenta coincide.</EmptyState>
          ) : (
            <TableBox>
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={cn(headCell, "pl-4")}>
                      Cuenta
                    </TableHead>
                    <TableHead className={headCell}>Rol</TableHead>
                    <TableHead className={headCell}>Ficha</TableHead>
                    <TableHead className={headCell}>VIP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.items.map((u) => {
                    const on = u.id === selected
                    return (
                      <TableRow
                        key={u.id}
                        className={cn(on && "bg-primary/[0.08]")}
                      >
                        <TableCell className="py-1.5 pl-2">
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => onSelect(u.id)}
                            className="flex w-full flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                          >
                            <span className="font-semibold">{u.alias}</span>
                            <span className="text-xs text-muted-foreground">
                              {u.alias_changed_at
                                ? `Alias cambiado el ${fmtDate(u.alias_changed_at)}`
                                : "Nunca cambió el alias"}
                            </span>
                          </button>
                        </TableCell>
                        <TableCell>
                          <span className="flex flex-wrap gap-1">
                            <Chip tone={ROLE_TONE[u.role] ?? "neutral"}>
                              {roleLabel(u.role)}
                            </Chip>
                            {u.streamer && <Chip tone="primary">Streamer</Chip>}
                          </span>
                        </TableCell>
                        <TableCell className="text-[13px]">
                          {!u.player_id ? (
                            <span className="text-muted-foreground">
                              Sin ficha
                            </span>
                          ) : u.steam_id ? (
                            "Con SteamID"
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400">
                              Sin SteamID
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <VipChip vip={u.vip} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <Pager
                page={page}
                total={list.data.total}
                per={USERS_PER}
                onPage={setPage}
              />
            </TableBox>
          )}
        </>
      }
      aside={
        current ? (
          <AccountPanel
            key={current.id}
            u={current}
            onClose={() => onSelect(null)}
          />
        ) : (
          <PickHint
            title="Elige una cuenta"
            text="Acá cambias el alias, el rol, el VIP y la marca de streamer."
          />
        )
      }
    />
  )
}

function VipChip({ vip }: { vip: AdminUser["vip"] }) {
  if (!vip) return <span className="text-muted-foreground">—</span>
  if (!vip.active) return <Chip>Venció</Chip>
  return (
    <Chip tone="vip">
      {vip.lifetime ? "De por vida" : `Hasta ${fmtDate(vip.until)}`}
    </Chip>
  )
}

function AccountPanel({ u, onClose }: { u: AdminUser; onClose: () => void }) {
  const id = useId()
  const [alias, setAlias] = useState(u.alias)
  const setAliasM = useSetAlias(u.id)
  const setRole = useSetRole(u.id)
  const [role, setRoleTarget] = useState<SettableRole | null>(null)
  const [banning, setBanning] = useState(false)
  const player = useQuery({
    ...playerDetailOptions(u.player_id ?? ""),
    enabled: !!u.player_id,
  })
  const ban = player.data?.ban ?? null
  const a = alias.trim()
  const aliasOk = a.length >= 2 && a.length <= 24 && !/[<>]/.test(a)
  const blocked = isBlockedName(setAliasM.error, "alias")

  const saveAlias = (force: boolean) =>
    setAliasM.mutate(
      { alias: a, force },
      {
        onSuccess: () =>
          toast.success(force ? "Alias guardado igual." : "Alias cambiado."),
      }
    )

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">
            {u.alias}
            <Chip tone={ROLE_TONE[u.role] ?? "neutral"}>
              {roleLabel(u.role)}
            </Chip>
          </h2>
          <span className="text-[13px] text-muted-foreground">
            {u.player_id ? (
              <>
                Ficha {u.alias}
                {u.steam_id ? ". " : ", todavía sin SteamID. "}
                <Link
                  to="/player/$nick"
                  params={{ nick: u.alias }}
                  className="text-primary hover:underline"
                >
                  Ver perfil
                </Link>
              </>
            ) : (
              "Sin ficha: se crea cuando vincula su SteamID con !claim."
            )}
          </span>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Cerrar detalle"
          onClick={onClose}
        >
          <XIcon aria-hidden />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-alias`}>Alias</Label>
        <div className="flex gap-2">
          <Input
            id={`${id}-alias`}
            value={alias}
            maxLength={24}
            onChange={(e) => {
              setAlias(e.target.value)
              setAliasM.reset()
            }}
          />
          <Button
            className="h-9"
            disabled={!aliasOk || a === u.alias || setAliasM.isPending}
            onClick={() => saveAlias(false)}
          >
            Guardar
          </Button>
        </div>
        {setAliasM.isError &&
          (blocked ? (
            <Alert variant="warning">
              <AlertDescription>
                {errorMessage(setAliasM.error)}
              </AlertDescription>
              <AlertAction>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveAlias(true)}
                >
                  Guardar igual
                </Button>
              </AlertAction>
            </Alert>
          ) : (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(setAliasM.error)}
            </p>
          ))}
        <span className="text-xs text-muted-foreground">
          Es su nombre en toda la web y el de su ficha. Sin la espera de 15 días
          que tiene el jugador.
        </span>
      </div>

      <PanelSection title="Rol">
        {u.role === "admin" ? (
          <span className="text-[13px] leading-relaxed text-muted-foreground">
            Es admin. Ese rol se da y se quita en la base, no desde acá.
          </span>
        ) : (
          <div
            role="radiogroup"
            aria-label="Rol"
            className="flex flex-col gap-1.5"
          >
            {(
              [
                ["user", "Juega, arma equipos y se inscribe."],
                ["organizer", "Además crea y gestiona sus torneos."],
                ["moderator", "Además banea desde la web (no permanentes)."],
              ] as const
            ).map(([r, desc]) => {
              const on = u.role === r
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => !on && setRoleTarget(r)}
                  className={cn(
                    "flex min-h-12 flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left",
                    on ? "border-primary bg-primary/10" : "hover:bg-muted"
                  )}
                >
                  <span className="font-semibold">{roleLabel(r)}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </button>
              )
            })}
          </div>
        )}
      </PanelSection>

      <VipSection u={u} />

      <StreamerSection u={u} />

      {u.player_id && (
        <PanelSection title="Baneo">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex-1 text-[13px] text-muted-foreground">
              {ban
                ? `Baneado ${ban.expires_at ? `hasta el ${fmtDate(ban.expires_at)}` : "de forma permanente"}: ${ban.reason}`
                : "Sin baneos activos."}
            </span>
            {ban ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/bans" search={{ q: u.alias, ban: ban.id }}>
                  Ver en Baneos
                </Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/50 text-destructive hover:text-destructive"
                onClick={() => setBanning(true)}
              >
                Banear
              </Button>
            )}
          </div>
        </PanelSection>
      )}

      <ConfirmDialog
        open={role !== null}
        onOpenChange={(o) => !o && setRoleTarget(null)}
        title={`¿Hacer ${role ? roleLabel(role).toLowerCase() : ""} a ${u.alias}?`}
        description="Puedes cambiarlo cuando quieras."
        confirmLabel="Cambiar rol"
        pending={setRole.isPending}
        error={setRole.error}
        onConfirm={() =>
          role &&
          setRole.mutate(role, {
            onSuccess: () => {
              setRoleTarget(null)
              toast.success(
                `${u.alias} ahora es ${roleLabel(role).toLowerCase()}.`
              )
            },
          })
        }
      />
      {banning && u.player_id && (
        <BanDialog
          fixed={{ kind: "player", id: u.player_id, label: u.alias }}
          canPermanent
          onClose={() => setBanning(false)}
        />
      )}
    </>
  )
}

type VipDur = "1" | "3" | "6" | "12" | "date" | "life"

function VipSection({ u }: { u: AdminUser }) {
  const vip = useQuery(userVipOptions(u.id))
  const grant = useGrantVip(u.id)
  const revoke = useRevokeVip(u.id)
  const [dur, setDur] = useState<VipDur>("1")
  const [date, setDate] = useState(isoDatePlus(60))
  const [confirm, setConfirm] = useState<"grant" | "revoke" | null>(null)
  const v = vip.data?.vip ?? u.vip
  const active = !!v?.active
  const lifetime = !!v?.lifetime && active

  const body = (): VipGrant =>
    dur === "life"
      ? { lifetime: true }
      : dur === "date"
        ? { until: endOfDayIso(date) }
        : { months: Number(dur) as 1 | 3 | 6 | 12 }
  const dateOk = dur !== "date" || new Date(endOfDayIso(date)) > new Date()

  return (
    <PanelSection
      title="VIP"
      aside={
        active ? (
          <Chip tone="vip">
            {lifetime ? "De por vida" : `Hasta ${fmtDate(v?.until)}`}
          </Chip>
        ) : (
          <Chip>{v ? "Venció" : "No es VIP"}</Chip>
        )
      }
    >
      <span className="text-[13px] leading-relaxed text-muted-foreground">
        {lifetime
          ? `VIP desde el ${fmtDate(v?.since)}. A un VIP de por vida no se le suma tiempo.`
          : active
            ? `VIP desde el ${fmtDate(v?.since)}. Extenderlo suma el período nuevo desde el ${fmtDate(v?.until)}.`
            : `${v ? `Fue VIP desde el ${fmtDate(v.since)}. ` : ""}Elige la duración. Se le avisa a la cuenta.`}
      </span>
      {!lifetime && (
        <>
          <div
            role="radiogroup"
            aria-label="Duración del VIP"
            className="flex flex-wrap gap-1.5"
          >
            {(
              [
                ["1", "1 mes"],
                ["3", "3 meses"],
                ["6", "6 meses"],
                ["12", "12 meses"],
                ["date", "Hasta una fecha"],
                ["life", "De por vida"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={dur === k}
                onClick={() => setDur(k)}
                className={cn(
                  "h-9 rounded-lg border px-3 text-[13px]",
                  dur === k
                    ? "border-primary bg-primary/10 font-semibold"
                    : "hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {dur === "date" && (
            <Input
              type="date"
              aria-label="VIP hasta"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-fit"
            />
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {!lifetime && (
          <Button
            variant="outline"
            disabled={!dateOk}
            onClick={() => setConfirm("grant")}
          >
            {active ? "Extender VIP" : "Dar VIP"}
          </Button>
        )}
        {active && (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirm("revoke")}
          >
            Quitar VIP
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirm === "grant"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          active ? `¿Extender el VIP de ${u.alias}?` : `¿Dar VIP a ${u.alias}?`
        }
        description={
          dur === "life"
            ? "Queda VIP de por vida. Se le avisa a la cuenta."
            : "Vence solo. Se le avisa a la cuenta."
        }
        confirmLabel={active ? "Extender" : "Dar VIP"}
        pending={grant.isPending}
        error={grant.error}
        onConfirm={() =>
          grant.mutate(body(), {
            onSuccess: () => {
              setConfirm(null)
              toast.success("VIP actualizado.")
            },
          })
        }
      />
      <ConfirmDialog
        open={confirm === "revoke"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Quitar el VIP de ${u.alias}?`}
        description="Quita el período actual y los futuros, también uno de por vida. Se le avisa a la cuenta."
        confirmLabel="Quitar VIP"
        danger
        reason={{ label: "Motivo", help: "Obligatorio.", required: true }}
        pending={revoke.isPending}
        error={revoke.error}
        onConfirm={(reason) =>
          revoke.mutate(reason, {
            onSuccess: () => {
              setConfirm(null)
              toast.success("VIP quitado.")
            },
          })
        }
      />
    </PanelSection>
  )
}

/** La marca de streamer del HUD (bitácora 2026-10-29-frontend-hud), con el mismo patrón que el VIP. */
export function StreamerSection({ u }: { u: AdminUser }) {
  const detail = useQuery(streamerOptions(u.id, u.alias))
  const grant = useGrantStreamer(u.id)
  const revoke = useRevokeStreamer(u.id)
  const [confirm, setConfirm] = useState<"grant" | "revoke" | null>(null)
  const s = detail.data
  const active = u.streamer

  const line = active
    ? [
        s?.granted_by ? `Se la dio ${s.granted_by}.` : null,
        s?.has_link
          ? `Generó su link el ${fmtDate(s.link_created_at)}.`
          : "Todavía no generó su link.",
        "Quitarla corta su link en 30 segundos; si se la vuelves a dar, tiene que generar uno nuevo.",
      ]
        .filter(Boolean)
        .join(" ")
    : `${s?.revoked_at ? `Se la quitaron el ${fmtDate(s.revoked_at)}. ` : ""}Con la marca puede generar su link de OBS desde Mi perfil y transmitir cualquier servidor con el HUD activo.`

  return (
    <PanelSection
      title="Streamer del HUD"
      aside={
        active ? (
          <Chip tone="primary">
            {s ? `Desde el ${fmtDate(s.granted_at)}` : "Streamer"}
          </Chip>
        ) : (
          <Chip>No</Chip>
        )
      }
    >
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {line} Se le avisa a la cuenta.
      </p>
      <div className="flex flex-wrap gap-2">
        {active ? (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirm("revoke")}
          >
            Quitar streamer
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setConfirm("grant")}>
            Dar streamer
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirm === "grant"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Darle la marca de streamer a ${u.alias}?`}
        description="Podrá generar su link de OBS desde Mi perfil. Se le avisa a la cuenta."
        confirmLabel="Dar streamer"
        pending={grant.isPending}
        error={grant.error}
        onConfirm={() =>
          grant.mutate(undefined, {
            onSuccess: () => {
              setConfirm(null)
              toast.success(`${u.alias} ya es streamer.`)
            },
          })
        }
      />
      <ConfirmDialog
        open={confirm === "revoke"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Quitarle la marca de streamer a ${u.alias}?`}
        description="Su link deja de andar en 30 segundos. Se le avisa a la cuenta."
        confirmLabel="Quitar streamer"
        danger
        pending={revoke.isPending}
        error={revoke.error}
        onConfirm={() =>
          revoke.mutate(undefined, {
            onSuccess: () => {
              setConfirm(null)
              toast.success("Marca de streamer quitada.")
            },
          })
        }
      />
    </PanelSection>
  )
}
