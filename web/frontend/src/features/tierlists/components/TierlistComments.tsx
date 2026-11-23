import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  LockIcon,
  MessageSquareIcon,
  ReplyIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { VerifiedSeal } from "@/components/brand/VerifiedBadge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { CommentReportDialog } from "@/features/player/components/CommentReportDialog"
import { COMMENT_MAX } from "@/features/player/components/ProfileWall"
import { timeAgo } from "@/features/shell/notifications/lib/model"
import {
  fetchOlderComments,
  tierlistCommentsOptions,
  useTierlistActions,
  type Tierlist,
  type TierlistComment,
} from "../api/queries"

// Comentarios de una tierlist: dos niveles. Cada comentario tiene sus respuestas debajo, y las respuestas no se
// responden (lo vuelve a controlar la base). Mismas reglas que el muro del perfil.

type Reply = TierlistComment["replies"][number]
type Actions = ReturnType<typeof useTierlistActions>

export function TierlistComments({ tierlist }: { tierlist: Tierlist }) {
  const { data, isPending, isError } = useQuery(
    tierlistCommentsOptions(tierlist.id)
  )
  const actions = useTierlistActions(tierlist.id)
  const [older, setOlder] = useState<TierlistComment[]>([])
  const [loadingMore, setLoadingMore] = useState(false)

  const seen = new Set(data?.items.map((c) => c.id))
  const items = [
    ...(data?.items ?? []),
    ...older.filter((c) => !seen.has(c.id)),
  ]
  const more = async () => {
    const last = items.at(-1)
    if (!last) return
    setLoadingMore(true)
    try {
      const page = await fetchOlderComments(tierlist.id, last.created_at)
      setOlder((o) => [...o, ...page.items])
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Comentarios">
      <h2 className="text-base font-semibold">
        Comentarios{data && tierlist.comments_open ? ` (${data.total})` : ""}
      </h2>
      {tierlist.is_owner && (
        <Card
          variant="outline"
          className="flex-row items-center gap-3 px-4 py-3"
        >
          <Switch
            id="tierlist-open"
            checked={tierlist.comments_open}
            onCheckedChange={(v) => actions.setOpen.mutate(v)}
          />
          <Label
            htmlFor="tierlist-open"
            className="flex flex-col items-start gap-0.5"
          >
            <span className="text-sm font-semibold">
              Comentarios en esta tierlist
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {tierlist.comments_open
                ? "Cualquiera con cuenta puede comentar y responder. Puedes borrar los que no quieras."
                : "Cerrados: no se ven ni se pueden dejar. Los me gusta siguen."}
            </span>
          </Label>
        </Card>
      )}

      {!tierlist.comments_open ? (
        !tierlist.is_owner && (
          <p className="inline-flex items-center gap-2 rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
            <LockIcon aria-hidden className="size-4" />
            El autor cerró los comentarios de esta tierlist.
          </p>
        )
      ) : (
        <>
          {tierlist.can_comment ? (
            <CommentForm
              placeholder="Opina sobre esta tierlist…"
              label="Tu comentario"
              submit="Comentar"
              sending={actions.comment.isPending}
              onSend={(body) => actions.comment.mutateAsync({ body })}
            />
          ) : (
            <p className="inline-flex items-center gap-2 rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
              <LockIcon aria-hidden className="size-4" />
              {tierlist.restriction === "banned"
                ? "Con un baneo activo no puedes comentar."
                : tierlist.restriction === "blocked"
                  ? "El autor te bloqueó: no puedes comentar acá."
                  : "Necesitas tu ficha de jugador para comentar."}
            </p>
          )}

          {isPending ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Cargando…
            </p>
          ) : isError ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No se pudieron cargar los comentarios.
            </p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <MessageSquareIcon aria-hidden className="size-6" />
              Todavía no hay comentarios.
            </div>
          ) : (
            <ul aria-label="Comentarios" className="flex flex-col">
              {items.map((c) => (
                <Thread
                  key={c.id}
                  c={c}
                  canReply={tierlist.can_comment}
                  actions={actions}
                  onDeleted={(id) =>
                    setOlder((o) => o.filter((x) => x.id !== id))
                  }
                />
              ))}
            </ul>
          )}
          {data && items.length < data.threads && (
            <Button
              variant="outline"
              size="sm"
              className="self-center"
              disabled={loadingMore}
              onClick={more}
            >
              Ver más
            </Button>
          )}
        </>
      )}
    </section>
  )
}

function Thread({
  c,
  canReply,
  actions,
  onDeleted,
}: {
  c: TierlistComment
  canReply: boolean
  actions: Actions
  onDeleted: (id: string) => void
}) {
  const [replying, setReplying] = useState(false)
  return (
    <li className="flex flex-col border-t py-3 first:border-t-0">
      <CommentRow c={c} actions={actions} onDeleted={onDeleted}>
        {canReply && !c.deleted && (
          <button
            type="button"
            onClick={() => setReplying((r) => !r)}
            className="inline-flex items-center gap-1 self-start text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ReplyIcon aria-hidden className="size-3.5" />
            Responder
          </button>
        )}
      </CommentRow>
      {(c.replies.length > 0 || replying) && (
        <ul
          aria-label="Respuestas"
          className="mt-2 ml-5 flex flex-col gap-2 border-l-2 pl-4 sm:ml-12"
        >
          {c.replies.map((r) => (
            <li key={r.id}>
              <CommentRow c={r} actions={actions} onDeleted={onDeleted} small />
            </li>
          ))}
          {replying && (
            <li>
              <CommentForm
                autoFocus
                placeholder={`Responde a ${c.author?.nick ?? "este comentario"}…`}
                label="Tu respuesta"
                submit="Responder"
                sending={actions.comment.isPending}
                onSend={(body) =>
                  actions.comment
                    .mutateAsync({ body, parent_id: c.id })
                    .then(() => setReplying(false))
                }
              />
            </li>
          )}
        </ul>
      )}
    </li>
  )
}

function CommentRow({
  c,
  actions,
  onDeleted,
  small,
  children,
}: {
  c: TierlistComment | Reply
  actions: Actions
  onDeleted: (id: string) => void
  small?: boolean
  children?: React.ReactNode
}) {
  if (c.deleted || !c.author)
    return (
      <p className="py-1 text-sm text-muted-foreground italic">
        Comentario borrado.
      </p>
    )
  const a = c.author
  return (
    <div className="flex gap-3">
      <Link
        to="/player/$nick"
        params={{ nick: a.nick }}
        aria-label={`Ver el perfil de ${a.nick}`}
        className="shrink-0"
      >
        <PlayerAvatar
          alias={a.nick}
          playerId={a.player_id}
          photo={a.photo_url}
          size="row"
          className={cn(small && "size-6")}
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <Link
            to="/player/$nick"
            params={{ nick: a.nick }}
            className="font-semibold hover:text-primary"
          >
            {a.nick}
          </Link>
          {a.verified && <VerifiedSeal kind={a.verified} className="size-4" />}
          <LevelBadge level={a.level} size={20} />
          <span className="text-xs text-muted-foreground">
            · {timeAgo(c.created_at)}
          </span>
        </div>
        <p className="text-sm break-words whitespace-pre-line">{c.body}</p>
        {children}
      </div>
      {c.can_report && (
        <CommentReportDialog
          author={a.nick}
          onReport={(reason, note) =>
            actions.report.mutateAsync({ reason, note, comment_id: c.id })
          }
        />
      )}
      {c.can_delete && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Borrar el comentario de ${a.nick}`}
          title="Borrar"
          onClick={() => {
            onDeleted(c.id)
            actions.removeComment.mutate(c.id)
          }}
        >
          <Trash2Icon />
        </Button>
      )}
    </div>
  )
}

function CommentForm({
  placeholder,
  label,
  submit,
  sending,
  autoFocus,
  onSend,
}: {
  placeholder: string
  label: string
  submit: string
  sending: boolean
  autoFocus?: boolean
  /** El texto se borra solo si se guardó. */
  onSend: (body: string) => Promise<unknown>
}) {
  const [text, setText] = useState("")
  const left = COMMENT_MAX - text.trim().length
  const send = () => {
    const body = text.trim()
    if (!body || left < 0) return
    onSend(body).then(
      () => setText(""),
      () => {}
    )
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
    >
      <Textarea
        aria-label={label}
        placeholder={placeholder}
        value={text}
        autoFocus={autoFocus}
        maxLength={COMMENT_MAX + 50}
        rows={2}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send()
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "text-xs text-muted-foreground tabular-nums",
            left < 0 && "text-destructive"
          )}
        >
          {left < 0 ? `${-left} de más` : `${left} caracteres`}
        </span>
        <Button
          type="submit"
          size="sm"
          disabled={sending || !text.trim() || left < 0}
        >
          <SendIcon aria-hidden />
          {submit}
        </Button>
      </div>
    </form>
  )
}
