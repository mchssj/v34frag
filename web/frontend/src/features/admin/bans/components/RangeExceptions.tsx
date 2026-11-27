import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { errorMessage } from "@/api/errors"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Chip, warnText } from "../../components/ui"
import { fmtDate } from "../../lib/format"
import { ipRangeAccountsOptions } from "../api/queries"

// A quién alcanza banear una IP o rango, con las casillas Exceptuar (replanteos 150 y 152). La usan el baneo de una
// ficha (IPs y rangos) y el baneo sin ficha (IPs sin ficha).

type Affected = {
  player_id: string | null
  user_id: string | null
  banned: boolean
}

/** Clave de un afectado: su ficha, o su cuenta si no tiene. */
export const keyOf = (a: {
  player_id: string | null
  user_id: string | null
}) => (a.player_id ? `p:${a.player_id}` : `u:${a.user_id}`)

/** range: la IP o rango a revisar ("" = ninguno). excludePlayer: la ficha baneada, que no se ofrece exceptuar. */
export function useRangeExceptions(
  range: string,
  excludePlayer: string | null
) {
  const affected = useQuery(ipRangeAccountsOptions(range))
  const others = affected.data?.items.filter(
    (a) => !excludePlayer || a.player_id !== excludePlayer
  )
  // De entrada se exceptúa a los que no están baneados; solo se guarda lo que el admin cambia.
  const [changed, setChanged] = useState<Map<string, boolean>>(new Map())
  const isExcepted = (a: Affected) => changed.get(keyOf(a)) ?? !a.banned
  const chosen = (others ?? []).filter(isExcepted)
  return {
    affected,
    others,
    isExcepted,
    toggle: (k: string, on: boolean) =>
      setChanged((m) => new Map(m).set(k, on)),
    reset: () => setChanged(new Map()),
    except_players: chosen.flatMap((a) => (a.player_id ? [a.player_id] : [])),
    except_users: chosen.flatMap((a) =>
      !a.player_id && a.user_id ? [a.user_id] : []
    ),
    count: chosen.length,
  }
}

export function RangeExceptionsList({
  ctl,
  hint,
}: {
  ctl: ReturnType<typeof useRangeExceptions>
  /** Qué hacer con los que quedan alcanzados. */
  hint: string
}) {
  const { affected, others } = ctl
  if (affected.isPending) return <Skeleton className="h-8 rounded" />
  if (affected.isError)
    return (
      <span className="text-[13px] text-destructive">
        {errorMessage(affected.error)}
      </span>
    )
  if (!others || others.length === 0)
    return (
      <span className="text-[13px] text-muted-foreground">
        Ningún otro jugador de CMLeague usó esa IP o rango.
      </span>
    )
  return (
    <>
      <span className={`text-[13px] ${warnText}`}>
        Otros {others.length}{" "}
        {others.length === 1 ? "jugador usó" : "jugadores usaron"} esta IP o
        rango. Los marcados quedan como excepción y siguen buscando partida
        desde ahí; {hint}
      </span>
      <ul className="flex flex-col gap-1">
        {others.map((a) => {
          const k = keyOf(a)
          return (
            <li key={k}>
              <label className="flex items-center gap-2 text-[13px]">
                <Checkbox
                  checked={ctl.isExcepted(a)}
                  onCheckedChange={(on) => ctl.toggle(k, on === true)}
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
  )
}
