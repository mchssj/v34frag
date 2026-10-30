import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { CheckIcon, LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ago, fmtDate } from "../format"
import { Chip, EmptyState, QueryError } from "../ui"
import { clipLabel } from "./clips"
import {
  clipReviewOptions,
  useApproveClip,
  useReprocessClip,
  type ClipReview,
} from "./queries"

export function ReviewTab() {
  const list = useQuery(clipReviewOptions)
  return (
    <section aria-label="Para revisar" className="flex flex-col gap-4">
      <p className="max-w-[760px] text-[13px] leading-relaxed text-muted-foreground">
        Clips que se volvieron a grabar porque el video salió mal. Míralo: si
        está bien, sale en Discord (otra vez, si ya había salido). Si no,
        mándalo a grabar de nuevo. Del más viejo al más nuevo.
      </p>
      {list.isError ? (
        <QueryError error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : list.data.items.length === 0 ? (
        <EmptyState>No hay clips para revisar.</EmptyState>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {list.data.items.map((r) => (
            <ReviewCard key={r.clip.id} r={r} />
          ))}
        </div>
      )}
      <p className="max-w-[760px] rounded-lg bg-muted px-3 py-2.5 text-[13px] leading-relaxed">
        Para mandar a grabar de nuevo un clip que salió mal, usa "Reprocesar" en
        la jugada, dentro de la partida. Se puede mientras la demo siga
        guardada: 90 días.
      </p>
    </section>
  )
}

function ReviewCard({ r }: { r: ClipReview }) {
  const approve = useApproveClip()
  const again = useReprocessClip()
  const { clip, match } = r
  const video = clip.video
  const ready = video.status === "done" && !!(video.url || video.embed_url)
  const who = clip.player?.alias ?? clip.game_nick
  const error = approve.error ?? again.error
  const busy = approve.isPending || again.isPending

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="grid aspect-video place-items-center bg-muted">
        {ready && video.url ? (
          <video
            src={video.url}
            controls
            preload="metadata"
            className="size-full bg-black object-contain"
            aria-label={`Clip de ${who}`}
          />
        ) : ready && video.embed_url ? (
          <iframe
            src={video.embed_url}
            title={`Clip de ${who}`}
            allow="autoplay; fullscreen"
            className="size-full border-0"
          />
        ) : (
          <span className="flex flex-col items-center gap-2 px-4 text-center text-[13px] text-muted-foreground">
            <LoaderCircleIcon aria-hidden className="size-6 animate-spin" />
            {video.status === "failed"
              ? "La grabación falló. Mándalo a grabar de nuevo."
              : "Grabándose. Aparece acá cuando esté listo."}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="primary" className="font-mono font-bold">
            {clipLabel(clip.type)}
          </Chip>
          <span className="font-semibold">{who}</span>
          {clip.vip && <Chip tone="vip">VIP</Chip>}
        </div>
        <span className="text-[13px] text-muted-foreground">
          {[match.map, match.played_at && fmtDate(match.played_at)]
            .filter(Boolean)
            .join(" · ")}{" "}
          ·{" "}
          <Link
            to="/match/$id"
            params={{ id: match.id }}
            className="text-primary hover:underline"
          >
            Ver la partida
          </Link>
        </span>
        <span className="text-xs text-muted-foreground">
          {r.reprocess_count === 1
            ? "Reprocesado una vez"
            : `Reprocesado ${r.reprocess_count} veces`}
          , {ago(r.reprocessed_at)}
        </span>
        {error && (
          <p role="alert" className="text-[13px] text-destructive">
            {errorMessage(error)}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            disabled={!ready || busy}
            onClick={() =>
              approve.mutate(clip.id, {
                onSuccess: () => toast.success("Publicado en Discord."),
              })
            }
          >
            <CheckIcon aria-hidden />
            Bien, publicarlo
          </Button>
          <Button
            variant="outline"
            disabled={
              busy ||
              video.status === "pending" ||
              video.status === "processing"
            }
            onClick={() =>
              again.mutate(clip.id, {
                onSuccess: () => toast.success("Se va a grabar de nuevo."),
              })
            }
          >
            Reprocesar otra vez
          </Button>
        </div>
      </div>
    </article>
  )
}
