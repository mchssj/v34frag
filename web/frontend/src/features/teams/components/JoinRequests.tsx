import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { formatDistanceStrict, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { timeAgo } from "@/features/shell/notifications/lib/model"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { teamPendingOptions, useAnswerJoin } from "../api/queries"
import type { TeamInvite } from "../types"
import { Panel } from "./ui"

// --- Pedidos para entrar (líder) -----------------------------------------

const expiresIn = (iso: string) =>
  `vence en ${formatDistanceStrict(new Date(), parseISO(iso), { locale: es })}`

export function JoinRequests({ teamId }: { teamId: string }) {
  const pending = useQuery(teamPendingOptions(teamId)).data
  const requests = (pending ?? []).filter((p) => p.kind === "request")
  return (
    <Panel
      title="Pedidos para entrar"
      aside={
        requests.length > 0 && (
          <span className="grid size-5 place-items-center rounded-full bg-primary font-mono text-[11px] font-bold text-primary-foreground">
            {requests.length}
          </span>
        )
      }
    >
      {requests.length === 0 ? (
        <p className="px-[18px] py-6 text-sm text-muted-foreground">
          No hay pedidos pendientes.
        </p>
      ) : (
        <ul>
          {requests.map((r) => (
            <JoinRequestRow key={r.id} teamId={teamId} request={r} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function JoinRequestRow({
  teamId,
  request,
}: {
  teamId: string
  request: TeamInvite
}) {
  const answer = useAnswerJoin()
  const nick = request.player.alias

  async function reply(accept: boolean) {
    try {
      await answer.mutateAsync({ requestId: request.id, accept, teamId })
      toast.success(accept ? `${nick} entró al equipo` : "Pedido rechazado")
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 border-b px-[18px] py-3 last:border-b-0">
      <Link
        to="/player/$nick"
        params={{ nick }}
        aria-label={`Perfil de ${nick}`}
        className="rounded-full outline-none hover:ring-2 hover:ring-primary focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <PlayerAvatar
          alias={nick}
          photo={request.player.photo_url}
          className="size-9"
          fallbackClassName="text-sm"
        />
      </Link>
      {/* Ancho mínimo: en pantallas chicas los botones bajan en lugar de aplastar el texto. */}
      <span className="flex min-w-[150px] flex-1 flex-col">
        <span className="flex items-center gap-2">
          <Link
            to="/player/$nick"
            params={{ nick }}
            className="w-fit truncate text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            {nick}
          </Link>
          {request.player.level && <LevelBadge level={request.player.level} />}
        </span>
        <span className="text-xs text-muted-foreground">
          {timeAgo(request.created_at)} · {expiresIn(request.expires_at)}
        </span>
        {request.message && (
          <span className="mt-1 line-clamp-2 text-[13px] text-pretty">
            “{request.message}”
          </span>
        )}
      </span>
      <span className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={answer.isPending}
          onClick={() => void reply(false)}
        >
          Rechazar
        </Button>
        <Button
          size="sm"
          disabled={answer.isPending}
          onClick={() => void reply(true)}
        >
          Aceptar
        </Button>
      </span>
    </li>
  )
}
