import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { InfoIcon, TriangleAlertIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { pickPlayerOptions } from "@/features/admin/players/queries"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { endOfDayIso, fmtDate, isoDatePlus } from "../format"
import {
  activeBansForOptions,
  useCreateBan,
  useUpdateBan,
  type Ban,
} from "./queries"

export type BanTarget =
  | { kind: "player"; id: string; label: string }
  | { kind: "steam"; steamId: string }

type Duration = "1" | "3" | "7" | "30" | "date" | "perm"

const DURATIONS: { key: Duration; label: string }[] = [
  { key: "1", label: "1 día" },
  { key: "3", label: "3 días" },
  { key: "7", label: "1 semana" },
  { key: "30", label: "1 mes" },
  { key: "date", label: "Hasta una fecha" },
  { key: "perm", label: "Permanente" },
]

const STEAM64 = /^7656\d{13}$/

const targetLabel = (t: BanTarget) =>
  t.kind === "player" ? t.label : t.steamId

/** Fecha de vencimiento del baneo (null = permanente). */
export function banExpiry(
  d: Duration,
  date: string,
  now = new Date()
): string | null {
  if (d === "perm") return null
  if (d === "date") return endOfDayIso(date)
  return new Date(now.getTime() + Number(d) * 86_400_000).toISOString()
}

/**
 * Banear (con `fixed` o eligiendo a quién) o cambiar un baneo activo (`ban`). Un baneo vale en todos
 * los servidores; el moderador no ve "Permanente" ni puede reemplazar uno permanente (contrato).
 */
export function BanDialog({
  fixed,
  ban,
  canPermanent,
  onClose,
  onSaved,
}: {
  fixed?: BanTarget
  ban?: Ban
  canPermanent: boolean
  onClose: () => void
  /** Con el baneo como quedó (el nuevo o el cambiado). */
  onSaved?: (b: Ban) => void
}) {
  const id = useId()
  const create = useCreateBan()
  const update = useUpdateBan()
  const mutation = ban ? update : create
  const [target, setTarget] = useState<BanTarget | null>(fixed ?? null)
  const [q, setQ] = useState("")
  const debounced = useDebouncedValue(q.trim(), 250)
  const players = useQuery(
    pickPlayerOptions(STEAM64.test(debounced) ? "" : debounced)
  )
  const [reason, setReason] = useState(ban?.reason ?? "")
  const [dur, setDur] = useState<Duration>(
    ban ? (ban.permanent ? "perm" : "date") : "7"
  )
  const [date, setDate] = useState(
    ban?.expires_at ? ban.expires_at.slice(0, 10) : isoDatePlus(7)
  )

  // Baneo activo que el nuevo reemplazaría.
  const existingQ = !ban && target ? targetLabel(target) : ""
  const existing = useQuery(activeBansForOptions(existingQ))
  const replaces = existing.data?.items.find((b) =>
    target?.kind === "player"
      ? b.player?.id === target.id
      : b.steam_id === (target?.kind === "steam" ? target.steamId : "")
  )
  const blockedByPerm = !!replaces?.permanent && !canPermanent

  const dateOk =
    dur !== "date" || (!!date && new Date(endOfDayIso(date)) > new Date())
  const ready =
    !!target &&
    reason.trim().length > 0 &&
    dateOk &&
    !blockedByPerm &&
    !mutation.isPending

  function submit() {
    if (!target) return
    const expires = banExpiry(dur, date)
    const timing =
      expires === null ? { permanent: true as const } : { expires_at: expires }
    const done = (msg: string, saved: Ban) => {
      toast.success(msg)
      onSaved?.(saved)
      onClose()
    }
    if (ban) {
      update.mutate(
        { id: ban.id, body: { reason: reason.trim(), ...timing } },
        { onSuccess: (saved) => done("Baneo actualizado.", saved) }
      )
      return
    }
    create.mutate(
      {
        reason: reason.trim(),
        ...timing,
        ...(target.kind === "player"
          ? { player_id: target.id }
          : { steam_id: target.steamId }),
      },
      {
        onSuccess: (saved) =>
          done(
            `${targetLabel(target)} baneado en todos los servidores.`,
            saved
          ),
      }
    )
  }

  const typedSteam = STEAM64.test(debounced) ? debounced : null
  const durations = DURATIONS.filter((d) => d.key !== "perm" || canPermanent)

  return (
    <Dialog open onOpenChange={(o) => !o && !mutation.isPending && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-32px)] gap-4 overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {ban
              ? `Cambiar el baneo de ${ban.player?.alias ?? ban.nick ?? ban.steam_id}`
              : fixed
                ? `Banear a ${targetLabel(fixed)}`
                : "Banear"}
          </DialogTitle>
        </DialogHeader>

        {!ban && !fixed && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-q`}>Jugador o SteamID</Label>
            <Input
              id={`${id}-q`}
              value={q}
              placeholder="Nick de la ficha o SteamID64"
              onChange={(e) => setQ(e.target.value)}
            />
            <div
              role="radiogroup"
              aria-label="A quién banear"
              className="flex flex-col gap-1.5"
            >
              {typedSteam && (
                <Option
                  on={target?.kind === "steam" && target.steamId === typedSteam}
                  label={typedSteam}
                  info="SteamID (si tiene ficha, se banea la ficha)"
                  onClick={() =>
                    setTarget({ kind: "steam", steamId: typedSteam })
                  }
                />
              )}
              {debounced &&
                !typedSteam &&
                players.data?.items
                  .filter((p) => p.has_steam)
                  .map((p) => (
                    <Option
                      key={p.id}
                      on={target?.kind === "player" && target.id === p.id}
                      label={p.alias}
                      info="Banea la ficha y todos sus SteamID"
                      onClick={() =>
                        setTarget({ kind: "player", id: p.id, label: p.alias })
                      }
                    />
                  ))}
            </div>
          </div>
        )}
        {(ban || fixed) && (
          <div className="flex flex-col gap-0.5 rounded-lg bg-muted px-3 py-2.5">
            <span className="font-semibold">
              {ban
                ? (ban.player?.alias ?? ban.nick ?? ban.steam_id)
                : fixed && targetLabel(fixed)}
            </span>
            <span className="text-xs text-muted-foreground">
              {(ban ? ban.player : fixed?.kind === "player")
                ? "Vale para todos sus SteamID y los que sume después."
                : "SteamID sin ficha."}
            </span>
          </div>
        )}

        {replaces && (
          <Alert variant={blockedByPerm ? "destructive" : "warning"}>
            <TriangleAlertIcon aria-hidden />
            <AlertDescription>
              {blockedByPerm
                ? "Tiene un baneo permanente: solo un admin puede reemplazarlo."
                : `Ya tiene un baneo activo (${replaces.permanent ? "permanente" : `hasta el ${fmtDate(replaces.expires_at)}`}). Este lo reemplaza y el anterior queda levantado.`}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-r`} className="flex justify-between">
            <span>Motivo</span>
            <span className="font-mono font-normal text-muted-foreground">
              {reason.length}/200
            </span>
          </Label>
          <Textarea
            id={`${id}-r`}
            rows={2}
            maxLength={200}
            value={reason}
            placeholder="Se ve en la lista pública y al intentar entrar al servidor"
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span id={`${id}-d`} className="text-sm font-medium">
            Duración
          </span>
          <div
            role="radiogroup"
            aria-labelledby={`${id}-d`}
            className="flex flex-wrap gap-1.5"
          >
            {durations.map((d) => (
              <button
                key={d.key}
                type="button"
                role="radio"
                aria-checked={dur === d.key}
                onClick={() => setDur(d.key)}
                className={cn(
                  "h-9 rounded-lg border px-3 text-[13px] transition-colors",
                  dur === d.key
                    ? "border-primary bg-primary/10 font-semibold"
                    : "hover:bg-muted"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          {dur === "date" && (
            <Input
              type="date"
              aria-label="Vence el"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-fit"
            />
          )}
          <span
            className={cn(
              "text-xs",
              dateOk ? "text-muted-foreground" : "text-destructive"
            )}
          >
            {!dateOk
              ? "La fecha tiene que ser futura."
              : dur === "perm"
                ? "No vence. Solo un admin lo puede cambiar o levantar."
                : `Vence el ${fmtDate(banExpiry(dur, date))}.`}
          </span>
        </div>

        <Alert>
          <InfoIcon aria-hidden />
          <AlertDescription>
            Vale en todos los servidores, también los externos. Si está jugando,
            lo echa la próxima sincronización (cada 3 minutos o al cambiar de
            mapa), o al instante si escribes{" "}
            <span className="font-mono">!syncbans</span> en el servidor. No se
            le avisa por Discord.
          </AlertDescription>
        </Alert>

        {mutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(mutation.error)}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            disabled={!ready}
            onClick={submit}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {ban ? "Guardar cambios" : "Banear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Option({
  on,
  label,
  info,
  onClick,
}: {
  on: boolean
  label: string
  info: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 text-left",
        on ? "border-primary bg-primary/10" : "hover:bg-muted"
      )}
    >
      <span className="font-medium break-all">{label}</span>
      <span className="text-xs text-muted-foreground">{info}</span>
    </button>
  )
}
