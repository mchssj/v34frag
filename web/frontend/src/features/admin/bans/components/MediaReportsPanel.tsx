import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Trash2Icon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { Schemas } from "@/api/client"
import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  MEDIA_KIND,
  MEDIA_REASON,
} from "@/features/player/components/MediaReportDialog"
import { mediaReportsOptions, useResolveMediaReport } from "@/features/shop/api"
import { isVideo } from "@/features/shop/cosmetics"
import { fmtDate } from "../../lib/format"
import { Chip, EmptyState, QueryError } from "../../components/ui"

// Administración › Baneos › Imágenes (bitácora 2026-11-13-avatar-y-fondo-propios): las denuncias del avatar y el fondo
// que suben los jugadores, y de las portadas. Las revisan moderadores y admins: descartar o sacar la imagen (sin
// devolver lo pagado; el dueño recibe un aviso con el motivo). La API pagina, filtra y ordena.

type Report = Schemas["MediaReport"]
type Status = "open" | "resolved" | "all"
const PER = 20

const STATUS_TEXT: Record<Report["status"], string> = {
  open: "Por revisar",
  dismissed: "Descartada",
  removed: "Imagen sacada",
}

/** Cuántas hay por revisar (para la pestaña). */
export function useOpenMediaReports() {
  return useQuery({
    ...mediaReportsOptions({ status: "open", page: 1, per: 1 }),
    select: (d) => d.total,
  }).data
}

export function MediaReportsPanel() {
  const [status, setStatus] = useState<Status>("open")
  const [page, setPage] = useState(1)
  // Las abiertas, primero las más viejas (las que más esperan); el resto, las más nuevas.
  const order = status === "open" ? "asc" : "desc"
  const list = useQuery(mediaReportsOptions({ status, page, per: PER, order }))
  const resolve = useResolveMediaReport()
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PER)) : 1
  const act = (id: string, action: "dismiss" | "remove") =>
    resolve.mutate(
      { id, action },
      {
        onSuccess: () =>
          toast.success(
            action === "remove"
              ? "Imagen sacada. El dueño recibió un aviso."
              : "Denuncia descartada"
          ),
        onError: (e) => toast.error(errorMessage(e)),
      }
    )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Los avatares, los fondos y las portadas que denunciaron los jugadores.
        Sacar la imagen cierra todas sus denuncias, borra el archivo y le avisa
        al dueño con el motivo; no se le devuelve lo que pagó.
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
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : list.data.items.length === 0 ? (
        <EmptyState>
          {status === "open"
            ? "No hay imágenes por revisar."
            : "No hay denuncias."}
        </EmptyState>
      ) : (
        <ul aria-label="Denuncias de imágenes" className="flex flex-col gap-2">
          {list.data.items.map((r) => (
            <ReportRow
              key={r.id}
              r={r}
              busy={resolve.isPending}
              onResolve={(a) => act(r.id, a)}
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

/** La imagen denunciada. Si ya no está (la cambió o la sacaron), el archivo puede no existir más. */
function Shot({ r }: { r: Report }) {
  const box = r.kind === "avatar" ? "size-28" : "h-28 w-[308px] max-w-full"
  if (isVideo(r.url))
    return (
      <video
        className={`${box} rounded-md border bg-muted object-cover`}
        src={r.url}
        poster={r.poster_url ?? undefined}
        autoPlay
        loop
        muted
        playsInline
        aria-label="Imagen denunciada"
      />
    )
  return (
    <img
      src={r.url}
      alt="Imagen denunciada"
      className={`${box} rounded-md border bg-muted object-cover`}
    />
  )
}

function ReportRow({
  r,
  busy,
  onResolve,
}: {
  r: Report
  busy: boolean
  onResolve: (action: "dismiss" | "remove") => void
}) {
  return (
    <li>
      <Card variant="outline" className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <Chip>{MEDIA_KIND[r.kind].replace(/^Su /, "")}</Chip>
          <Chip>{MEDIA_REASON[r.reason]}</Chip>
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
        <div className="flex flex-wrap items-start gap-4">
          <Shot r={r} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px]">
            <p>
              Del perfil de <PlayerLink p={r.profile} />
              {!r.current && (
                <span className="text-muted-foreground">
                  {" "}
                  · ya no la tiene puesta
                </span>
              )}
            </p>
            {r.note && (
              <p>
                <span className="text-muted-foreground">Nota:</span> {r.note}
              </p>
            )}
          </div>
        </div>
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
            <Button
              size="sm"
              variant="destructive"
              disabled={busy || !r.current}
              onClick={() => onResolve("remove")}
            >
              <Trash2Icon aria-hidden />
              Sacar la imagen
            </Button>
          </div>
        )}
      </Card>
    </li>
  )
}
