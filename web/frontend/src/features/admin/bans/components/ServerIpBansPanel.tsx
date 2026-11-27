import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { QueryState } from "@/components/brand/QueryState"
import { fmtDateTime } from "../../lib/format"
import { looseBanIpsOptions, useLiftBanIp } from "../api/queries"
import { BannedIp } from "./BanIpsSection"

// Los baneos por IP hechos con !banip en un servidor (replanteo 151): no tienen ficha, así que no aparecen en la lista
// de baneos. Valen en los tres servidores y en la web, con las mismas excepciones.
export function ServerIpBansPanel() {
  const query = useQuery(looseBanIpsOptions())
  const lift = useLiftBanIp()

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        IPs y rangos baneados con <code>!banip</code> en un servidor, sin ficha.
        Valen en los tres servidores y en la web (cola, aceptar y crear
        cuentas). Los de una ficha están en el detalle de su baneo.
      </p>
      <QueryState q={query}>
        {(data) =>
          data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay IPs baneadas desde los servidores.
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
                    ip.server_name && `en ${ip.server_name}`,
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
