import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Trash2Icon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { api, unwrap, type Schemas } from "@/api/client"
import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { COMMENT_REPORT_REASON } from "@/features/player/components/CommentReportDialog"
import { fmtDate } from "../../lib/format"
import { Chip, EmptyState, QueryError } from "../../components/ui"

// Administración › Baneos › Comentarios (replanteo 94, bitácora 2026-11-09-perfil-social-ajustes): las denuncias de
// comentarios de los perfiles. Las revisan moderadores y admins: descartar o borrar el comentario. La API pagina,
// filtra y ordena.

type Report = Schemas["ProfileCommentReport"]
type Status = "open" | "resolved" | "all"
const PER = 20

const STATUS_TEXT: Record<Report["status"], string> = {
  open: "Por revisar",
  dismissed: "Descartada",
  removed: "Comentario borrado",
}

const reportsKey = ["admin", "profile-comment-reports"] as const
const reportsOptions = (status: Status, page: number, order: "asc" | "desc") =>
  queryOptions({
    queryKey: [...reportsKey, status, page, order],
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/admin/profile-comment-reports", {
          params: { query: { status, page, per: PER, order } },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
  })

/** Cuántas hay por revisar (para la pestaña). */
export function useOpenCommentReports() {
  return useQuery({
    ...reportsOptions("open", 1, "desc"),
    select: (d) => d.total,
  }).data
}

export function CommentReportsPanel() {
  const qc = useQueryClient()
  const [status, setStatus] = useState<Status>("open")
  const [page, setPage] = useState(1)
  // Las abiertas, primero las más viejas (las que más esperan); el resto, las más nuevas.
  const order = status === "open" ? "asc" : "desc"
  const list = useQuery(reportsOptions(status, page, order))
  const resolve = useMutation({
    mutationFn: async (v: { id: string; action: "dismiss" | "delete" }) => {
      await unwrap(
        api.POST("/api/v1/admin/profile-comment-reports/{id}/resolve", {
          params: { path: { id: v.id } },
          body: { action: v.action },
        })
      )
    },
    onSuccess: (_, v) => {
      toast.success(
        v.action === "delete" ? "Comentario borrado" : "Denuncia descartada"
      )
      void qc.invalidateQueries({ queryKey: reportsKey })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PER)) : 1

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Los comentarios de los perfiles que denunciaron los jugadores. Borrar el
        comentario cierra todas sus denuncias; queda guardado, como los que
        borra el dueño del perfil.
      </p>
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["open", "Por revisar"],
            ["resolved", "Resueltas"],
            ["all", "Todas"],
          ] as const
        ).map(([k, label]) => (
          <Button
            key={k}
            size="sm"
            variant={status === k ? "secondary" : "ghost"}
            aria-pressed={status === k}
            onClick={() => {
              setStatus(k)
              setPage(1)
            }}
          >
            {label}
          </Button>
        ))}
      </div>

      {list.isError ? (
        <QueryError error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <div className="flex flex-col gap-2" aria-busy>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : list.data.items.length === 0 ? (
        <EmptyState>
          {status === "open"
            ? "No hay comentarios por revisar."
            : "No hay denuncias."}
        </EmptyState>
      ) : (
        <ul
          aria-label="Denuncias de comentarios"
          className="flex flex-col gap-2"
        >
          {list.data.items.map((r) => (
            <ReportRow
              key={r.id}
              r={r}
              busy={resolve.isPending}
              onResolve={(action) => resolve.mutate({ id: r.id, action })}
            />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground tabular-nums">
            {page} de {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  )
}

function PlayerLink({ p }: { p: { alias: string } | null }) {
  if (!p) return <span className="text-muted-foreground">(sin ficha)</span>
  return (
    <Link
      to="/player/$nick"
      params={{ nick: p.alias }}
      className="font-semibold hover:text-primary"
    >
      {p.alias}
    </Link>
  )
}

function ReportRow({
  r,
  busy,
  onResolve,
}: {
  r: Report
  busy: boolean
  onResolve: (action: "dismiss" | "delete") => void
}) {
  return (
    <li>
      <Card variant="outline" className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <Chip>{COMMENT_REPORT_REASON[r.reason]}</Chip>
          {r.reports > 1 && <Chip>{r.reports} denuncias</Chip>}
          <span className="text-muted-foreground">
            {fmtDate(r.created_at)} · la mandó <PlayerLink p={r.reporter} />
          </span>
          {r.status !== "open" && (
            <span className="ml-auto text-xs text-muted-foreground">
              {STATUS_TEXT[r.status]}
              {r.resolved_by && <> · {r.resolved_by.alias}</>}
            </span>
          )}
        </div>
        <blockquote className="rounded-md border-l-2 bg-muted/50 px-3 py-2 text-sm break-words whitespace-pre-line">
          {r.comment.body}
        </blockquote>
        <p className="text-xs text-muted-foreground">
          De <PlayerLink p={r.comment.author} /> en el perfil de{" "}
          <PlayerLink p={r.profile} />
          {r.comment.deleted_at && " · ya borrado"}
        </p>
        {r.note && (
          <p className="text-[13px]">
            <span className="text-muted-foreground">Nota:</span> {r.note}
          </p>
        )}
        {r.status === "open" && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onResolve("dismiss")}
            >
              <XIcon aria-hidden />
              Descartar
            </Button>
            {!r.comment.deleted_at && (
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => onResolve("delete")}
              >
                <Trash2Icon aria-hidden />
                Borrar el comentario
              </Button>
            )}
          </div>
        )}
      </Card>
    </li>
  )
}
