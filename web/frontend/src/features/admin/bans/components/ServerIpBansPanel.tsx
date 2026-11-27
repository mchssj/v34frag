import { useQuery } from "@tanstack/react-query"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { QueryState } from "@/components/brand/QueryState"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fmtDateTime } from "../../lib/format"
import {
  looseBanIpsOptions,
  useAddLooseBanIp,
  useLiftBanIp,
} from "../api/queries"
import { BannedIp } from "./BanIpsSection"
import { RangeExceptionsList, useRangeExceptions } from "./RangeExceptions"

// Los baneos por IP sin ficha (replanteos 151 y 152): los !banip de los servidores y los que se ponen desde acá. Valen
// en los tres servidores y en la web, con las mismas excepciones. Desde la web, como mucho 30 días (Daniel, 2026-11-26).

const DURATIONS = [
  { minutes: 60, label: "1 hora" },
  { minutes: 1440, label: "1 día" },
  { minutes: 10080, label: "7 días" },
  { minutes: 43200, label: "30 días" },
] as const

export function ServerIpBansPanel() {
  const query = useQuery(looseBanIpsOptions())
  const lift = useLiftBanIp()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <p className="flex-1 text-[13px] leading-relaxed text-muted-foreground">
          IPs y rangos baneados sin ficha: desde la web o con{" "}
          <code>!banip</code> en un servidor. Valen en los tres servidores y en
          la web (cola, aceptar y crear cuentas). Los de una ficha están en el
          detalle de su baneo.
        </p>
        {!open && (
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Banear IP o rango
          </Button>
        )}
      </div>
      {open && <LooseBanForm onClose={() => setOpen(false)} />}
      <QueryState q={query}>
        {(data) =>
          data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay IPs baneadas sin ficha.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.items.map((ip) => (
                <BannedIp
                  key={ip.id}
                  ip={ip}
                  playerId={null}
                  detail={[
                    ip.reason && `Motivo: ${ip.reason}`,
                    ip.created_by_name && `por ${ip.created_by_name}`,
                    ip.server_name ? `en ${ip.server_name}` : "desde la web",
                    fmtDateTime(ip.created_at),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  lifting={lift.isPending}
                  onLift={() =>
                    lift.mutate(ip.id, {
                      onSuccess: () => toast.success(`${ip.ip} levantada.`),
                      onError: (err) => toast.error(errorMessage(err)),
                    })
                  }
                />
              ))}
            </ul>
          )
        }
      </QueryState>
    </div>
  )
}

/** IP o rango, motivo y duración; con "Revisar", a quién alcanza y las excepciones antes de banear. */
function LooseBanForm({ onClose }: { onClose: () => void }) {
  const id = useId()
  const [typed, setTyped] = useState("")
  const [reason, setReason] = useState("")
  const [minutes, setMinutes] = useState<number>(1440)
  const [preview, setPreview] = useState("")
  const exc = useRangeExceptions(preview, null)
  const add = useAddLooseBanIp()

  const confirm = () =>
    add.mutate(
      {
        ip: preview,
        reason: reason.trim(),
        minutes,
        except_players: exc.except_players,
        except_users: exc.except_users,
      },
      {
        onSuccess: () => {
          toast.success(
            exc.count
              ? `${preview} baneada, con ${exc.count} ${exc.count === 1 ? "excepción" : "excepciones"}.`
              : `${preview} baneada.`
          )
          onClose()
        },
      }
    )

  return (
    <div
      role="region"
      aria-label="Banear IP o rango"
      className="flex flex-col gap-3 rounded-lg border px-3 py-3"
    >
      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          if (typed.trim()) {
            setPreview(typed.trim())
            exc.reset()
            add.reset()
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-ip`}>IP o rango</Label>
          <Input
            id={`${id}-ip`}
            value={typed}
            maxLength={60}
            placeholder="181.21.0.0/16"
            className="font-mono"
            onChange={(e) => setTyped(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">
            Rangos de hasta /16 (x.y.*.*).
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-reason`}>Motivo</Label>
          <Input
            id={`${id}-reason`}
            value={reason}
            maxLength={200}
            placeholder="Cuentas nuevas de un cheater"
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-dur`}>Duración</Label>
          <Select
            value={String(minutes)}
            onValueChange={(v) => setMinutes(Number(v))}
          >
            <SelectTrigger id={`${id}-dur`} className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => (
                <SelectItem key={d.minutes} value={String(d.minutes)}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            Como mucho 30 días.
          </span>
        </div>
        <span className="flex gap-2 sm:col-span-3">
          <Button type="submit" variant="outline" disabled={!typed.trim()}>
            Revisar
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </span>
      </form>

      {preview && (
        <div
          role="region"
          aria-label="A quién afecta"
          className="flex flex-col gap-2 rounded-lg bg-muted px-3 py-2.5"
        >
          <span className="text-[13px] font-semibold">
            Banear <span className="font-mono">{preview}</span>
          </span>
          <RangeExceptionsList
            ctl={exc}
            hint="desmarca a quien creas que es una cuenta de la persona que quieres frenar."
          />
          {add.isError && (
            <span role="alert" className="text-xs text-destructive">
              {errorMessage(add.error)}
            </span>
          )}
          <span>
            <Button
              size="sm"
              variant="destructive"
              disabled={
                add.isPending ||
                exc.affected.isPending ||
                exc.affected.isError ||
                !reason.trim()
              }
              onClick={confirm}
            >
              Banear {preview}
            </Button>
            {!reason.trim() && (
              <span className="ml-2 text-xs text-muted-foreground">
                Falta el motivo.
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}
