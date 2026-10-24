import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"
import {
  ClockIcon,
  InfoIcon,
  MonitorIcon,
  PlusIcon,
  StarIcon,
  UnlinkIcon,
} from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ErrorAlert } from "@/features/auth/ui"
import {
  currentCode,
  expiryText,
  useSecondsLeft,
  type ClaimCode,
} from "@/features/onboarding/claim"
import {
  mySteamRequestsOptions,
  steamStatusOptions,
  useCancelUnlink,
  useCreateClaimCode,
  useMakePrimary,
  useRequestUnlink,
  type SteamStatus,
} from "@/features/onboarding/queries"
import { timeAgo } from "@/features/shell/notifications/model"
import {
  claimOutcome,
  gameAccounts,
  type GameAccountRow,
  type SteamRequest,
} from "../accounts"
import { ContactFields, PROFILE_CONTACTS } from "../ContactFields"
import { myProfileOptions, profileKeys, useUpdateProfile } from "../queries"
import {
  socialsSchema,
  type SocialsInput,
  type SocialsValues,
} from "../schemas"
import { CardFooter, CardTitle, SectionCard } from "../ui"

export function LinkSection() {
  const steam = useQuery(steamStatusOptions)
  const requests = useQuery(mySteamRequestsOptions)
  if (!steam.data || !requests.data)
    return steam.isError || requests.isError ? (
      <ErrorAlert message={errorMessage(steam.error ?? requests.error)} />
    ) : (
      <Spinner className="size-6 text-muted-foreground" />
    )
  return (
    <>
      <GameAccountsCard initialStatus={steam.data} pending={requests.data} />
      <AccountsCard />
    </>
  )
}

/** Cuentas de juego: los SteamID de la cuenta, las solicitudes pendientes y el código de !claim. */
function GameAccountsCard({
  initialStatus,
  pending,
}: {
  initialStatus: SteamStatus
  pending: SteamRequest[]
}) {
  const queryClient = useQueryClient()
  const create = useCreateClaimCode()
  // Una sola confirmación de desvincular abierta a la vez.
  const [confirming, setConfirming] = useState<string | null>(null)
  const [code, setCode] = useState<ClaimCode | null>(() =>
    currentCode(initialStatus)
  )
  const seconds = useSecondsLeft(code?.expiresAt)
  const waiting = code !== null && seconds !== 0

  // Con un código vigente se consulta cada 5 s, para ver el !claim sin recargar.
  const status =
    useQuery({
      ...steamStatusOptions,
      refetchInterval: waiting ? 5000 : false,
    }).data ?? initialStatus

  useEffect(() => {
    if (!code || status.last_code?.code !== code.code) return
    if (status.last_code.status !== "used") return
    let cancelled = false
    // Un SteamID adicional queda como solicitud: se piden las pendientes antes de decidir.
    void queryClient
      .fetchQuery({ ...mySteamRequestsOptions, staleTime: 0 })
      .then((fresh) => {
        if (cancelled) return
        const outcome = claimOutcome(code.code, status, fresh)
        if (!outcome) return
        setCode(null)
        const show =
          outcome.tone === "error"
            ? toast.error
            : outcome.tone === "success"
              ? toast.success
              : toast
        show(outcome.title, { description: outcome.description ?? undefined })
        // La ficha y las partidas cambian al vincular.
        void queryClient.invalidateQueries({ queryKey: profileKeys.mine })
      })
    return () => {
      cancelled = true
    }
  }, [code, status, queryClient])

  const g = gameAccounts(status, pending)

  async function generate() {
    try {
      const c = await create.mutateAsync()
      setCode({ code: c.code, expiresAt: Date.parse(c.expires_at) })
    } catch {
      // Se muestra con ErrorAlert.
    }
  }

  async function copy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(`!claim ${code.code}`)
      toast("Comando copiado")
    } catch {
      toast.error(`No se pudo copiar. Escribe: !claim ${code.code}`)
    }
  }

  return (
    <SectionCard>
      <div className="flex items-start gap-3 p-5">
        <CardTitle
          className="flex-1"
          title="Cuentas de juego"
          description="Los SteamID64 con los que juegas en el servidor. Las partidas de todos suman a tu ficha."
        />
        <span
          className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-muted px-2 font-mono text-xs font-medium text-muted-foreground"
          aria-label={`${g.linked} de ${g.max} cuentas vinculadas`}
        >
          {g.linked}/{g.max}
        </span>
      </div>

      {g.empty ? (
        <Row
          icon={
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/14 text-primary">
              <UnlinkIcon className="size-4" aria-hidden />
            </span>
          }
          title={
            <span className="text-sm font-medium">
              Todavía no vinculaste ninguna cuenta
            </span>
          }
          meta="Tus partidas no suman a tu ficha y no puedes entrar a un equipo hasta que vincules al menos una."
        />
      ) : (
        <ul aria-label="Cuentas de juego">
          {g.rows.map((row) => (
            <li key={`${row.kind}-${row.steamId}`}>
              <AccountRow
                row={row}
                confirming={confirming === row.steamId}
                onConfirm={(open) => setConfirming(open ? row.steamId : null)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 border-t bg-muted/40 p-5">
        {g.atLimit ? (
          <p className="flex items-center gap-2.5 text-[13px] text-pretty text-muted-foreground">
            <InfoIcon className="size-4 shrink-0" aria-hidden />
            Llegaste al límite de {g.max} cuentas. Desvincula una para enlazar
            otra.
          </p>
        ) : (
          <>
            <CardTitle
              title={g.addTitle}
              description="Entra al servidor con la cuenta que quieres sumar y escribe el código en el chat."
            />
            {code && waiting && (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed bg-card p-3.5">
                <code className="font-mono text-xl font-bold tracking-[2px]">
                  !claim {code.code}
                </code>
                <span className="min-w-40 flex-1 text-xs text-muted-foreground">
                  Esperando que lo escribas en el chat
                  {seconds !== null &&
                    ` · ${expiryText(seconds).toLowerCase()}`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-[30px] text-xs"
                  onClick={() => void copy()}
                >
                  Copiar
                </Button>
              </div>
            )}
            {create.error != null && (
              <ErrorAlert message={errorMessage(create.error)} />
            )}
            <Button
              className="w-fit text-[13px]"
              disabled={create.isPending}
              onClick={() => void generate()}
            >
              <PlusIcon aria-hidden />
              {code && waiting ? "Generar otro código" : "Generar código"}
            </Button>
          </>
        )}
      </div>
    </SectionCard>
  )
}

function Row({
  icon,
  title,
  meta,
  actions,
  children,
}: {
  icon: ReactNode
  title: ReactNode
  meta: ReactNode
  actions?: ReactNode
  /** Debajo, a todo el ancho (la confirmación de desvincular). */
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-t px-5 py-4">
      {icon}
      <span className="flex min-w-[180px] flex-1 flex-col gap-[3px]">
        {title}
        <span className="text-xs text-pretty text-muted-foreground">
          {meta}
        </span>
      </span>
      {actions}
      {children}
    </div>
  )
}

const ROW_BUTTON = "h-[30px] px-2.5 text-xs"

function AccountRow({
  row,
  confirming,
  onConfirm,
}: {
  row: GameAccountRow
  /** La confirmación de desvincular de esta fila está abierta. */
  confirming: boolean
  onConfirm: (open: boolean) => void
}) {
  const makePrimary = useMakePrimary()
  const cancelUnlink = useCancelUnlink()
  const linked = row.kind === "linked"

  async function setPrimary(steamid: string) {
    try {
      await makePrimary.mutateAsync(steamid)
      toast.success("Cuenta principal actualizada")
    } catch (e) {
      // Por ejemplo, si ya lo cambió en las últimas 24 horas.
      toast.error(errorMessage(e))
    }
  }

  async function cancel(steamid: string) {
    try {
      await cancelUnlink.mutateAsync(steamid)
      toast.success("Solicitud cancelada")
    } catch (e) {
      // Por ejemplo, si un admin ya la resolvió.
      toast.error(errorMessage(e))
    }
  }

  return (
    <Row
      icon={
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted">
          <MonitorIcon className="size-4" aria-hidden />
        </span>
      }
      title={
        <span className="flex flex-wrap items-center gap-2">
          <code className="font-mono text-sm font-medium">{row.steamId}</code>
          {linked && row.primary && (
            <Badge className="bg-win/15 text-win">
              <StarIcon className="size-[11px]" aria-hidden />
              Principal
            </Badge>
          )}
          {linked && row.unlinkPending && (
            <Badge className="bg-sidebar-primary/15 text-sidebar-primary">
              <ClockIcon className="size-[11px]" aria-hidden />
              Desvinculación en revisión
            </Badge>
          )}
          {!linked && (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
              <ClockIcon className="size-[11px]" aria-hidden />
              Pendiente de aprobación
            </Badge>
          )}
        </span>
      }
      meta={
        linked
          ? row.since
          : `Pedida ${timeAgo(row.requestedAt)}${row.nick ? ` · como ${row.nick}` : ""}`
      }
      actions={
        linked &&
        !confirming &&
        (row.unlinkPending ? (
          <Button
            variant="outline"
            size="sm"
            className={ROW_BUTTON}
            disabled={cancelUnlink.isPending}
            onClick={() => void cancel(row.steamId)}
          >
            Cancelar solicitud
          </Button>
        ) : (
          <span className="flex gap-1.5">
            {!row.primary && (
              <Button
                variant="outline"
                size="sm"
                className={ROW_BUTTON}
                disabled={makePrimary.isPending}
                onClick={() => void setPrimary(row.steamId)}
              >
                Hacer principal
              </Button>
            )}
            {/* La ficha no puede quedar sin SteamID: el único no se desvincula. */}
            {row.canUnlink && (
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  ROW_BUTTON,
                  "text-destructive hover:text-destructive"
                )}
                onClick={() => onConfirm(true)}
              >
                Desvincular
              </Button>
            )}
          </span>
        ))
      }
    >
      {linked && confirming && (
        <UnlinkConfirm steamId={row.steamId} onClose={() => onConfirm(false)} />
      )}
    </Row>
  )
}

/** Confirmación para pedir desvincular: lo aprueba un admin y el motivo es opcional. */
function UnlinkConfirm({
  steamId,
  onClose,
}: {
  steamId: string
  onClose: () => void
}) {
  const unlink = useRequestUnlink()
  const [reason, setReason] = useState("")
  const reasonId = `unlink-reason-${steamId}`

  async function send() {
    try {
      await unlink.mutateAsync({ steamid: steamId, reason })
      toast.success("Solicitud enviada")
      onClose()
    } catch {
      // Se muestra dentro de la caja.
    }
  }

  return (
    <div
      role="group"
      aria-label={`Desvincular ${steamId}`}
      className="flex flex-[1_1_100%] flex-wrap items-center gap-3 rounded-md border border-destructive/30 bg-destructive/8 px-4 py-3"
    >
      <div className="flex min-w-[220px] flex-1 flex-col gap-2">
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">
            Un admin tiene que aprobar la desvinculación
          </span>
          <span className="text-[13px] text-pretty text-muted-foreground">
            Mientras se revisa, la cuenta sigue vinculada. Lo jugado queda en tu
            ficha.
          </span>
        </span>
        <label htmlFor={reasonId} className="sr-only">
          ¿Por qué? (opcional)
        </label>
        <Input
          id={reasonId}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          placeholder="¿Por qué? (opcional)"
          className="h-8 bg-background text-[13px] dark:bg-background"
        />
        {unlink.error != null && (
          <span role="alert" className="text-xs text-destructive">
            {errorMessage(unlink.error)}
          </span>
        )}
      </div>
      <span className="flex gap-2">
        <Button variant="outline" className="text-[13px]" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          className="bg-destructive text-[13px] text-white hover:bg-destructive/90"
          disabled={unlink.isPending}
          onClick={() => void send()}
        >
          {unlink.isPending ? "Enviando…" : "Enviar solicitud"}
        </Button>
      </span>
    </div>
  )
}

function Badge({
  className,
  children,
}: {
  className: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-[7px] text-[11px] font-medium",
        className
      )}
    >
      {children}
    </span>
  )
}

function AccountsCard() {
  const details = useQuery(myProfileOptions).data?.details
  const update = useUpdateProfile()
  const form = useForm<SocialsInput, unknown, SocialsValues>({
    resolver: zodResolver(socialsSchema),
    values: {
      discord: details?.discord ?? "",
      steam: details?.steam ?? "",
      faceit: details?.faceit ?? "",
    },
  })

  const save = form.handleSubmit(async (v) => {
    try {
      // Un campo vacío borra el dato ("" lo borra en la API).
      await update.mutateAsync(v)
      toast("Cuentas guardadas")
    } catch {
      // Se muestra con ErrorAlert.
    }
  })

  return (
    <SectionCard>
      <form onSubmit={save} noValidate>
        <CardTitle
          className="px-5 pt-5 pb-4"
          title="Cuentas conectadas"
          description="Los capitanes las usan para invitarte a PCW y mixes. Si tu perfil es privado, se ocultan."
        />
        <ContactFields
          control={form.control}
          rows={PROFILE_CONTACTS}
          layout="inline"
        />
        {update.error != null && (
          <div className="px-5 pb-4">
            <ErrorAlert message={errorMessage(update.error)} />
          </div>
        )}
        <CardFooter>
          <Button
            type="submit"
            className="text-[13px]"
            disabled={update.isPending}
          >
            Guardar cuentas
          </Button>
        </CardFooter>
      </form>
    </SectionCard>
  )
}
