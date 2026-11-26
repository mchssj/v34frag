import { useQuery } from "@tanstack/react-query"
import { XIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Chip, PanelSection, warnText } from "../../components/ui"
import { fmtDate } from "../../lib/format"
import {
  banIpsOptions,
  ipCandidatesOptions,
  ipRangeAccountsOptions,
  useAddBanIp,
  useAddBanIpException,
  useLiftBanIp,
  useRemoveBanIpException,
} from "../api/queries"

// Baneo por IP (replanteos 149 y 150, docs/bitacora/2026-11-26-baneo-por-ip). Solo admins y en un baneo activo de una
// ficha. Un rango alcanza a todos los que usan ese proveedor: cada IP o rango tiene excepciones por ficha o cuenta.

/** Esta IP, y para IPv4 su /24 (x.y.z.*) y su /16 (x.y.*.*): las IPs dinámicas repiten los primeros números. */
export function ipOptions(ip: string): { value: string; label: string }[] {
  const p = ip.split(".")
  if (p.length !== 4) return [{ value: ip, label: "Esta IP" }]
  return [
    { value: ip, label: "Esta IP" },
    {
      value: `${p[0]}.${p[1]}.${p[2]}.0/24`,
      label: `${p[0]}.${p[1]}.${p[2]}.*`,
    },
    { value: `${p[0]}.${p[1]}.0.0/16`, label: `${p[0]}.${p[1]}.*.*` },
  ]
}

/** Clave de un afectado: su ficha, o su cuenta si no tiene. */
const keyOf = (a: { player_id: string | null; user_id: string | null }) =>
  a.player_id ? `p:${a.player_id}` : `u:${a.user_id}`

export function BanIpsSection({
  banId,
  playerId,
  playerAlias,
}: {
  banId: string
  playerId: string
  playerAlias: string
}) {
  const id = useId()
  const current = useQuery(banIpsOptions(banId))
  const candidates = useQuery(ipCandidatesOptions(playerId))
  const add = useAddBanIp(banId)
  const lift = useLiftBanIp()
  const [preview, setPreview] = useState("")
  const [typed, setTyped] = useState("")
  const affected = useQuery(ipRangeAccountsOptions(preview))
  const others = affected.data?.items.filter((a) => a.player_id !== playerId)
  // Exceptuados en la vista previa: de entrada, los que no están baneados (con un rango, el resto del proveedor).
  // Solo se guarda lo que el admin cambia; se vacía al elegir otra IP o rango.
  const [changed, setChanged] = useState<Map<string, boolean>>(new Map())
  const isExcepted = (a: {
    player_id: string | null
    user_id: string | null
    banned: boolean
  }) => changed.get(keyOf(a)) ?? !a.banned
  const pick = (value: string) => {
    setPreview(value)
    setChanged(new Map())
  }
  const banned = current.data?.items ?? []

  const confirm = () => {
    const chosen = (others ?? []).filter(isExcepted)
    add.mutate(
      {
        ip: preview,
        except_players: chosen.flatMap((a) =>
          a.player_id ? [a.player_id] : []
        ),
        except_users: chosen.flatMap((a) =>
          !a.player_id && a.user_id ? [a.user_id] : []
        ),
      },
      {
        onSuccess: () => {
          toast.success(
            chosen.length
              ? `${preview} baneada, con ${chosen.length} ${chosen.length === 1 ? "excepción" : "excepciones"}.`
              : `${preview} baneada.`
          )
          setPreview("")
          setTyped("")
        },
      }
    )
  }

  return (
    <PanelSection title="IPs y rangos">
      <span className="text-[13px] leading-relaxed text-muted-foreground">
        Desde estas IPs nadie puede buscar partida, aceptar una ni crear una
        cuenta, salvo las excepciones. Vencen con el baneo, como mucho en 30
        días. Con una VPN o los datos del celular cambia de IP.
      </span>

      {current.isPending ? (
        <Skeleton className="h-10 rounded-lg" />
      ) : banned.length > 0 ? (
        <ul className="flex flex-col gap-1.5" aria-label="IPs baneadas">
          {banned.map((x) => (
            <BannedIp
              key={x.id}
              ip={x}
              playerId={playerId}
              lifting={lift.isPending}
              onLift={() =>
                lift.mutate(x.id, {
                  onSuccess: () => toast.success(`${x.ip} levantada.`),
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            />
          ))}
        </ul>
      ) : (
        <span className="text-[13px] text-muted-foreground">
          Ninguna IP baneada con este baneo.
        </span>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">
          IPs que usó {playerAlias}
        </span>
        {candidates.isPending ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : candidates.isError ? (
          <span className="text-[13px] text-destructive">
            {errorMessage(candidates.error)}
          </span>
        ) : candidates.data.items.length === 0 ? (
          <span className="text-[13px] text-muted-foreground">
            No hay IPs guardadas de esta ficha (ni de los servidores ni de la
            web).
          </span>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {candidates.data.items.map((c) => (
              <li
                key={c.ip}
                className="flex flex-col gap-1.5 rounded-lg border px-2.5 py-2"
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[13px]">{c.ip}</span>
                  {c.sources.map((s) => (
                    <Chip key={s}>{s === "web" ? "Web" : "Servidor"}</Chip>
                  ))}
                  {c.banned && <Chip tone="danger">Baneada</Chip>}
                  <span className="text-xs text-muted-foreground">
                    última vez el {fmtDate(c.last_seen_at)}
                  </span>
                </span>
                {c.others.length > 0 && (
                  <span className={`text-xs ${warnText}`}>
                    También la usaron:{" "}
                    {c.others
                      .map((o) => o.alias ?? "una cuenta sin alias")
                      .join(", ")}
                  </span>
                )}
                <span className="flex flex-wrap gap-1.5">
                  {ipOptions(c.ip).map((o) => (
                    <Button
                      key={o.value}
                      size="sm"
                      variant={preview === o.value ? "default" : "outline"}
                      onClick={() => pick(o.value)}
                    >
                      {o.label}
                    </Button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          if (typed.trim()) pick(typed.trim())
        }}
      >
        <Label htmlFor={`${id}-ip`}>Otra IP o rango</Label>
        <div className="flex gap-2">
          <Input
            id={`${id}-ip`}
            value={typed}
            maxLength={60}
            placeholder="181.45.10.0/24"
            className="font-mono"
            onChange={(e) => setTyped(e.target.value)}
          />
          <Button type="submit" variant="outline" className="h-9">
            Revisar
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          Rangos de hasta /16 (x.y.*.*).
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
          {affected.isPending ? (
            <Skeleton className="h-8 rounded" />
          ) : affected.isError ? (
            <span className="text-[13px] text-destructive">
              {errorMessage(affected.error)}
            </span>
          ) : others && others.length > 0 ? (
            <>
              <span className={`text-[13px] ${warnText}`}>
                Otros {others.length}{" "}
                {others.length === 1 ? "jugador usó" : "jugadores usaron"} esta
                IP o rango. Los marcados quedan como excepción y siguen buscando
                partida desde ahí; desmarca a quien creas que es otra cuenta del
                baneado.
              </span>
              <ul className="flex flex-col gap-1">
                {others.map((a) => {
                  const k = keyOf(a)
                  return (
                    <li key={k}>
                      <label className="flex items-center gap-2 text-[13px]">
                        <Checkbox
                          checked={isExcepted(a)}
                          onCheckedChange={(on) =>
                            setChanged((m) => new Map(m).set(k, on === true))
                          }
                          aria-label={`Exceptuar a ${a.alias ?? "la cuenta"}`}
                        />
                        <span className="font-semibold">
                          {a.alias ?? "Cuenta sin alias"}
                        </span>
                        {a.banned && <Chip tone="danger">Baneado</Chip>}
                        <span className="text-xs text-muted-foreground">
                          {a.ips} {a.ips === 1 ? "IP" : "IPs"}, última vez el{" "}
                          {fmtDate(a.last_seen_at)}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <span className="text-[13px] text-muted-foreground">
              Ningún otro jugador de CMLeague usó esa IP o rango.
            </span>
          )}
          {add.isError && (
            <span role="alert" className="text-xs text-destructive">
              {errorMessage(add.error)}
            </span>
          )}
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={add.isPending || affected.isPending || affected.isError}
              onClick={confirm}
            >
              Banear {preview}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPreview("")
                add.reset()
              }}
            >
              Cancelar
            </Button>
          </span>
        </div>
      )}
    </PanelSection>
  )
}

/** Una IP o rango baneado, con sus excepciones: sacar una y sumar otra entre los que usaron ese rango. */
function BannedIp({
  ip,
  playerId,
  lifting,
  onLift,
}: {
  ip: {
    id: string
    ip: string
    expires_at: string
    exceptions: { id: string; alias: string | null }[]
  }
  playerId: string
  lifting: boolean
  onLift: () => void
}) {
  const [adding, setAdding] = useState(false)
  const affected = useQuery({
    ...ipRangeAccountsOptions(ip.ip),
    enabled: adding,
  })
  const addExc = useAddBanIpException()
  const removeExc = useRemoveBanIpException()
  const exceptedNames = new Set(ip.exceptions.map((e) => e.alias))
  const candidates = (affected.data?.items ?? []).filter(
    (a) => a.player_id !== playerId && !exceptedNames.has(a.alias)
  )

  return (
    <li className="flex flex-col gap-1.5 rounded-lg border px-2.5 py-2">
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[13px]">{ip.ip}</span>
        <span className="text-xs text-muted-foreground">
          hasta el {fmtDate(ip.expires_at)}
        </span>
        <button
          type="button"
          aria-label={`Levantar ${ip.ip}`}
          disabled={lifting}
          onClick={onLift}
          className="ml-auto grid size-6 place-items-center rounded-full bg-muted"
        >
          <XIcon aria-hidden className="size-3" />
        </button>
      </span>
      <span className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">Excepciones:</span>
        {ip.exceptions.length === 0 && (
          <span className="text-muted-foreground">ninguna</span>
        )}
        {ip.exceptions.map((e) => (
          <span
            key={e.id}
            className="inline-flex h-6 items-center gap-1 rounded-full border pr-0.5 pl-2"
          >
            {e.alias ?? "Cuenta sin alias"}
            <button
              type="button"
              aria-label={`Sacar la excepción de ${e.alias ?? "la cuenta"}`}
              disabled={removeExc.isPending}
              onClick={() =>
                removeExc.mutate(e.id, {
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
              className="grid size-5 place-items-center rounded-full bg-muted"
            >
              <XIcon aria-hidden className="size-2.5" />
            </button>
          </span>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => setAdding((a) => !a)}
        >
          {adding ? "Listo" : "Exceptuar a alguien"}
        </Button>
      </span>
      {adding &&
        (affected.isPending ? (
          <Skeleton className="h-6 rounded" />
        ) : candidates.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            Nadie más usó esta IP o rango.
          </span>
        ) : (
          <span className="flex flex-wrap gap-1.5">
            {candidates.map((a) => (
              <Button
                key={keyOf(a)}
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={addExc.isPending}
                onClick={() =>
                  addExc.mutate(
                    a.player_id
                      ? { banIpId: ip.id, player_id: a.player_id }
                      : { banIpId: ip.id, user_id: a.user_id ?? undefined },
                    {
                      onSuccess: () =>
                        toast.success(
                          `${a.alias ?? "La cuenta"} exceptuado de ${ip.ip}.`
                        ),
                      onError: (err) => toast.error(errorMessage(err)),
                    }
                  )
                }
              >
                + {a.alias ?? "Cuenta sin alias"}
                {a.banned ? " (baneado)" : ""}
              </Button>
            ))}
          </span>
        ))}
    </li>
  )
}
