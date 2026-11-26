import { useQuery } from "@tanstack/react-query"
import { XIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Chip, PanelSection, warnText } from "../../components/ui"
import { fmtDate } from "../../lib/format"
import {
  banIpsOptions,
  ipCandidatesOptions,
  ipRangeAccountsOptions,
  useLiftBanIp,
  useSetBanIps,
} from "../api/queries"

// Baneo por IP (replanteo 149, docs/bitacora/2026-11-26-baneo-por-ip). Solo admins y en un baneo activo de una ficha.

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
  const set = useSetBanIps(banId)
  const lift = useLiftBanIp()
  const [preview, setPreview] = useState("")
  const [typed, setTyped] = useState("")
  const affected = useQuery(ipRangeAccountsOptions(preview))
  const others = affected.data?.items.filter((a) => a.player_id !== playerId)
  const banned = current.data?.items.map((x) => x.ip) ?? []

  const confirm = () =>
    set.mutate([...new Set([...banned, preview])], {
      onSuccess: () => {
        toast.success(`${preview} baneada.`)
        setPreview("")
        setTyped("")
      },
    })

  return (
    <PanelSection title="IPs y rangos">
      <span className="text-[13px] leading-relaxed text-muted-foreground">
        Desde estas IPs nadie puede buscar partida, aceptar una ni crear una
        cuenta. Vencen con el baneo, como mucho en 30 días. Con una VPN o los
        datos del celular cambia de IP.
      </span>

      {current.isPending ? (
        <Skeleton className="h-10 rounded-lg" />
      ) : banned.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="IPs baneadas">
          {current.data?.items.map((x) => (
            <li
              key={x.id}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border pr-1 pl-3 text-[13px]"
            >
              <span className="font-mono">{x.ip}</span>
              <span className="text-xs text-muted-foreground">
                hasta el {fmtDate(x.expires_at)}
              </span>
              <button
                type="button"
                aria-label={`Levantar ${x.ip}`}
                disabled={lift.isPending}
                onClick={() =>
                  lift.mutate(x.id, {
                    onSuccess: () => toast.success(`${x.ip} levantada.`),
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }
                className="grid size-6 place-items-center rounded-full bg-muted"
              >
                <XIcon aria-hidden className="size-3" />
              </button>
            </li>
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
                      onClick={() => setPreview(o.value)}
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
          if (typed.trim()) setPreview(typed.trim())
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
            <span className={`text-[13px] ${warnText}`}>
              Afecta también a {others.length}{" "}
              {others.length === 1 ? "jugador" : "jugadores"} de CMLeague:{" "}
              {others
                .slice(0, 12)
                .map((a) => a.alias ?? "una cuenta sin alias")
                .join(", ")}
              {others.length > 12 ? "…" : ""}. No van a poder buscar partida
              desde esa conexión mientras dure.
            </span>
          ) : (
            <span className="text-[13px] text-muted-foreground">
              Ningún otro jugador de CMLeague usó esa IP o rango.
            </span>
          )}
          {set.isError && (
            <span role="alert" className="text-xs text-destructive">
              {errorMessage(set.error)}
            </span>
          )}
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={set.isPending || affected.isError}
              onClick={confirm}
            >
              Banear {preview}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPreview("")
                set.reset()
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
