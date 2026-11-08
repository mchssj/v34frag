import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { cn } from "cn"
import {
  ChevronDownIcon,
  ClockIcon,
  UserCheckIcon,
  UserPlusIcon,
} from "lucide-react"
import { toast } from "sonner"

import { api, unwrap } from "@/api/client"
import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// El botón de amistad en el perfil de otro jugador (replanteo 85): Agregar amigo, Solicitud enviada (se cancela),
// Te envió una solicitud (Aceptar / Rechazar) o Amigos (se elimina). Sin botón para uno mismo ni si no se puede.

export type Friendship =
  "self" | "unavailable" | "friends" | "received" | "sent" | "none"

export const friendshipOptions = (playerId: string) =>
  queryOptions({
    queryKey: ["friendship", playerId],
    queryFn: async () => {
      const r = (await unwrap(
        api.GET("/api/v1/mm/friends/{id}", {
          params: { path: { id: playerId } },
        })
      )) as { status: Friendship }
      return r.status
    },
  })

type Action = "send" | "remove" | "accept" | "reject"

function useFriendAction(playerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (action: Action) => {
      const path = { params: { path: { id: playerId } } }
      if (action === "send")
        await unwrap(
          api.POST("/api/v1/mm/friends", { body: { player_id: playerId } })
        )
      else if (action === "remove")
        await unwrap(api.DELETE("/api/v1/mm/friends/{id}", path))
      else if (action === "accept")
        await unwrap(api.POST("/api/v1/mm/friends/{id}/accept", path))
      else await unwrap(api.POST("/api/v1/mm/friends/{id}/reject", path))
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["friendship", playerId] }),
  })
}

const SIZE = "h-8 gap-1.5 px-3 text-[13px]"

export function FriendButton({
  playerId,
  nick,
}: {
  playerId: string
  nick: string
}) {
  const { data: status } = useQuery(friendshipOptions(playerId))
  const act = useFriendAction(playerId)
  const run = (action: Action, done?: string) =>
    act.mutate(action, {
      onSuccess: () => {
        if (done) toast.success(done)
      },
    })

  if (!status || status === "self" || status === "unavailable") return null

  if (status === "none")
    return (
      <Button
        className={SIZE}
        disabled={act.isPending}
        onClick={() => run("send", "Solicitud enviada")}
      >
        <UserPlusIcon aria-hidden className="size-3.5" />
        Agregar amigo
      </Button>
    )

  if (status === "received")
    return (
      <span className="flex items-center gap-2">
        <span className="hidden text-[13px] text-primary sm:inline">
          Te envió una solicitud de amistad
        </span>
        <Button
          className={SIZE}
          disabled={act.isPending}
          onClick={() => run("accept", `${nick} ahora es tu amigo`)}
        >
          Aceptar
        </Button>
        <Button
          variant="outline"
          className={SIZE}
          disabled={act.isPending}
          onClick={() => run("reject")}
        >
          Rechazar
        </Button>
      </span>
    )

  const friends = status === "friends"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            SIZE,
            friends && "border-win/30 bg-win/10 text-win hover:bg-win/15"
          )}
          disabled={act.isPending}
        >
          {friends ? (
            <UserCheckIcon aria-hidden className="size-3.5" />
          ) : (
            <ClockIcon aria-hidden className="size-3.5" />
          )}
          {friends ? "Amigos" : "Solicitud enviada"}
          <ChevronDownIcon aria-hidden className="size-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          variant={friends ? "destructive" : "default"}
          onSelect={() =>
            run(
              "remove",
              friends ? `${nick} ya no es tu amigo` : "Solicitud cancelada"
            )
          }
        >
          {friends ? "Eliminar de amigos" : "Cancelar la solicitud"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
