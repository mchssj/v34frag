import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  LockIcon,
  MessageSquareIcon,
  SendIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Trash2Icon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { api, unwrap, type Schemas } from "@/api/client"
import { errorMessage } from "@/api/errors"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { VerifiedSeal } from "@/components/brand/VerifiedBadge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { timeAgo } from "@/features/shell/notifications/lib/model"

// Comentarios y "me gusta / no me gusta" en los perfiles (replanteo 91, bitácora 2026-11-09-comentarios-perfil). Los
// votos van en el encabezado del perfil; los comentarios, en la pestaña Comentarios. Las reglas (tope, quién borra, el
// dueño que los cierra) las aplica la base.
// Las piezas de abajo reciben los datos y las acciones: las usan el perfil (con la API) y la demo (/demo/perfil-social).

export type Wall = Schemas["ProfileWall"]
export type WallComment = Wall["items"][number]
export const COMMENT_MAX = 280

export const wallKey = (playerId: string) =>
  ["players", playerId, "wall"] as const
export const wallOptions = (playerId: string) =>
  queryOptions({
    queryKey: wallKey(playerId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/players/{id}/wall", {
          params: { path: { id: playerId } },
          signal,
        })
      ),
  })

/** Las acciones del muro contra la API; cada una deja el muro nuevo en la caché. */
export function useWallActions(playerId: string) {
  const qc = useQueryClient()
  const set = (w: Wall) => qc.setQueryData(wallKey(playerId), w)
  const refresh = () => qc.invalidateQueries({ queryKey: wallKey(playerId) })
  const onError = (e: unknown) => toast.error(errorMessage(e))
  const vote = useMutation({
    mutationFn: (value: 1 | -1 | 0) =>
      unwrap(
        api.PUT("/api/v1/players/{id}/vote", {
          params: { path: { id: playerId } },
          body: { value },
        })
      ),
    onSuccess: set,
    onError,
  })
  const send = useMutation({
    mutationFn: (body: string) =>
      unwrap(
        api.POST("/api/v1/players/{id}/comments", {
          params: { path: { id: playerId } },
          body: { body },
        })
      ),
    onSuccess: set,
    onError,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await unwrap(
        api.DELETE("/api/v1/profile-comments/{id}", {
          params: { path: { id } },
        })
      )
    },
    onSuccess: refresh,
    onError,
  })
  const setOpen = useMutation({
    mutationFn: async (open: boolean) => {
      await unwrap(api.PUT("/api/v1/me/profile-comments", { body: { open } }))
    },
    onSuccess: refresh,
    onError,
  })
  return { vote, send, remove, setOpen }
}

// ---------- votos ----------

/** Me gusta / no me gusta: dos botones con su número. El propio o sin sesión, solo se ven. */
export function WallVotes({
  wall,
  onVote,
  pending,
  className,
}: {
  wall: Pick<Wall, "likes" | "dislikes" | "my_vote" | "can_vote" | "is_owner">
  onVote: (value: 1 | -1 | 0) => void
  pending?: boolean
  className?: string
}) {
  const disabledWhy = wall.can_vote
    ? undefined
    : wall.is_owner
      ? "No puedes votar tu propio perfil"
      : "Inicia sesión para votar"
  const button = (value: 1 | -1) => {
    const on = wall.my_vote === value
    const Icon = value === 1 ? ThumbsUpIcon : ThumbsDownIcon
    const count = value === 1 ? wall.likes : wall.dislikes
    const label = value === 1 ? "Me gusta" : "No me gusta"
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={`${label}: ${count}`}
        title={disabledWhy ?? (on ? `Sacar tu ${label.toLowerCase()}` : label)}
        disabled={!wall.can_vote || pending}
        onClick={() => onVote(on ? 0 : value)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 px-2.5 text-[13px] font-semibold tabular-nums transition-colors",
          "enabled:hover:bg-muted disabled:cursor-default",
          on && value === 1 && "text-win",
          on && value === -1 && "text-destructive"
        )}
      >
        <Icon aria-hidden className={cn("size-4", on && "fill-current/25")} />
        {count}
      </button>
    )
  }
  return (
    <div
      role="group"
      aria-label="Votos del perfil"
      className={cn(
        "inline-flex items-center divide-x overflow-hidden rounded-lg border bg-background",
        className
      )}
    >
      {button(1)}
      {button(-1)}
    </div>
  )
}

// ---------- comentarios ----------

export function WallComments({
  wall,
  onSend,
  onDelete,
  onSetOpen,
  onMore,
  sending,
  loadingMore,
}: {
  wall: Wall
  /** Devuelve una promesa: el texto se borra solo si se guardó. */
  onSend: (body: string) => Promise<unknown>
  onDelete: (id: string) => void
  onSetOpen: (open: boolean) => void
  onMore?: () => void
  sending?: boolean
  loadingMore?: boolean
}) {
  const [text, setText] = useState("")
  const left = COMMENT_MAX - text.trim().length
  const submit = () => {
    const body = text.trim()
    if (!body || left < 0) return
    onSend(body).then(
      () => setText(""),
      () => {}
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {wall.is_owner && (
        <Card
          variant="outline"
          className="flex-row items-center gap-3 px-4 py-3"
        >
          <Switch
            id="wall-open"
            checked={wall.comments_open}
            onCheckedChange={onSetOpen}
          />
          <Label
            htmlFor="wall-open"
            className="flex flex-col items-start gap-0.5"
          >
            <span className="text-sm font-semibold">
              Comentarios en tu perfil
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {wall.comments_open
                ? "Cualquiera con cuenta puede dejarte uno. Puedes borrar los que no quieras."
                : "Cerrados: no se ven ni se pueden dejar. Los votos siguen."}
            </span>
          </Label>
        </Card>
      )}

      {!wall.comments_open ? (
        !wall.is_owner && (
          <p className="inline-flex items-center gap-2 rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
            <LockIcon aria-hidden className="size-4" />
            Este jugador cerró los comentarios de su perfil.
          </p>
        )
      ) : (
        <>
          {wall.can_comment ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              <Textarea
                aria-label="Tu comentario"
                placeholder={
                  wall.is_owner
                    ? "Responde a los que te comentaron…"
                    : "Déjale un comentario…"
                }
                value={text}
                maxLength={COMMENT_MAX + 50}
                rows={3}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit()
                }}
              />
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "text-xs text-muted-foreground tabular-nums",
                    left < 0 && "text-destructive"
                  )}
                >
                  {left < 0
                    ? `${-left} de más`
                    : `${left} caracteres · se ve en tu nombre`}
                </span>
                <Button
                  type="submit"
                  size="sm"
                  disabled={sending || !text.trim() || left < 0}
                >
                  <SendIcon aria-hidden />
                  Comentar
                </Button>
              </div>
            </form>
          ) : (
            <p className="rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
              <Link to="/login" className="font-semibold text-primary">
                Inicia sesión
              </Link>{" "}
              para dejar un comentario.
            </p>
          )}

          {wall.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <MessageSquareIcon aria-hidden className="size-6" />
              Todavía no hay comentarios.
            </div>
          ) : (
            <ul aria-label="Comentarios" className="flex flex-col">
              {wall.items.map((c) => (
                <CommentRow key={c.id} c={c} onDelete={onDelete} />
              ))}
            </ul>
          )}
          {onMore && wall.items.length < wall.total && (
            <Button
              variant="outline"
              size="sm"
              className="self-center"
              disabled={loadingMore}
              onClick={onMore}
            >
              Ver más ({wall.total - wall.items.length})
            </Button>
          )}
        </>
      )}
    </div>
  )
}

function CommentRow({
  c,
  onDelete,
}: {
  c: WallComment
  onDelete: (id: string) => void
}) {
  return (
    <li className="flex gap-3 border-t py-3 first:border-t-0">
      <Link
        to="/player/$nick"
        params={{ nick: c.author.nick }}
        aria-label={`Ver el perfil de ${c.author.nick}`}
        className="shrink-0"
      >
        <PlayerAvatar
          alias={c.author.nick}
          photo={c.author.photo_url}
          size="row"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <Link
            to="/player/$nick"
            params={{ nick: c.author.nick }}
            className="font-semibold hover:text-primary"
          >
            {c.author.nick}
          </Link>
          {c.author.verified && (
            <VerifiedSeal kind={c.author.verified} className="size-4" />
          )}
          <LevelBadge level={c.author.level} size={20} />
          <span className="text-xs text-muted-foreground">
            · {timeAgo(c.created_at)}
          </span>
        </div>
        <p className="text-sm break-words whitespace-pre-line">{c.body}</p>
      </div>
      {c.can_delete && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Borrar el comentario de ${c.author.nick}`}
          title="Borrar"
          onClick={() => onDelete(c.id)}
        >
          <Trash2Icon />
        </Button>
      )}
    </li>
  )
}

// ---------- con la API ----------

/** Los votos del encabezado del perfil. */
export function ProfileVotes({ playerId }: { playerId: string }) {
  const { data } = useQuery(wallOptions(playerId))
  const { vote } = useWallActions(playerId)
  if (!data) return null
  return (
    <WallVotes
      wall={data}
      pending={vote.isPending}
      onVote={(v) => vote.mutate(v)}
    />
  )
}

/** La pestaña Comentarios. */
export function ProfileWall({ playerId }: { playerId: string }) {
  const { data, isPending, isError } = useQuery(wallOptions(playerId))
  const { send, remove, setOpen } = useWallActions(playerId)
  const [older, setOlder] = useState<WallComment[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  if (isPending)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Cargando…
      </p>
    )
  if (isError || !data)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No se pudieron cargar los comentarios.
      </p>
    )
  // "Ver más" trae los anteriores al último que se ve y los suma abajo.
  const seen = new Set(data.items.map((c) => c.id))
  const wall = {
    ...data,
    items: [...data.items, ...older.filter((c) => !seen.has(c.id))],
  }
  const more = async () => {
    const last = wall.items.at(-1)
    if (!last) return
    setLoadingMore(true)
    try {
      const page = await unwrap(
        api.GET("/api/v1/players/{id}/wall", {
          params: {
            path: { id: playerId },
            query: { before: last.created_at },
          },
        })
      )
      setOlder((o) => [...o, ...page.items])
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setLoadingMore(false)
    }
  }
  return (
    <WallComments
      wall={wall}
      sending={send.isPending}
      loadingMore={loadingMore}
      onSend={(body) => send.mutateAsync(body)}
      onDelete={(id) => {
        setOlder((o) => o.filter((c) => c.id !== id))
        remove.mutate(id)
      }}
      onSetOpen={(open) => setOpen.mutate(open)}
      onMore={more}
    />
  )
}
