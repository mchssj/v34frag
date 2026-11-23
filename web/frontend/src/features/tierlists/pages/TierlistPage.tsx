import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import {
  CopyIcon,
  DownloadIcon,
  HeartIcon,
  LinkIcon,
  PencilIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { BackButton } from "@/components/brand/BackButton"
import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { QueryErrorMessage } from "@/components/brand/QueryState"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CommentReportDialog } from "@/features/player/components/CommentReportDialog"
import { tierlistOptions, useTierlistActions } from "../api/queries"
import { TierBoard } from "../components/TierBoard"
import { TierlistComments } from "../components/TierlistComments"
import { TierlistEditor } from "../components/TierlistEditor"
import { downloadTierlist } from "../lib/export"

export function TierlistPage({
  id,
  edit,
  onEdit,
}: {
  id: string
  edit: boolean
  onEdit: (edit: boolean) => void
}) {
  const navigate = useNavigate()
  const query = useQuery(tierlistOptions(id))
  const actions = useTierlistActions(id)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const t = query.data

  if (query.isError)
    return (
      <QueryErrorMessage
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    )
  if (!t)
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>
    )

  const profile = {
    to: "/player/$nick",
    params: { nick: t.owner.nick },
    search: { tab: "tierlists" },
  } as const

  if (edit && t.is_owner)
    return (
      <div className="flex flex-col gap-4">
        <BackButton
          fallback={profile}
          label={`Tierlists de ${t.owner.nick}`}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        />
        <h1 className="text-2xl font-bold">Editar tierlist</h1>
        <TierlistEditor
          key={t.updated_at}
          tierlist={t}
          saving={actions.save.isPending}
          onCancel={() => onEdit(false)}
          onSave={(body) =>
            actions.save.mutate(body, { onSuccess: () => onEdit(false) })
          }
        />
      </div>
    )

  return (
    <div className="flex flex-col gap-6">
      <BackButton
        fallback={profile}
        label={`Tierlists de ${t.owner.nick}`}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      />
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold break-words">{t.name}</h1>
          <Badge variant="soft">
            {t.kind === "players" ? "Jugadores" : "Equipos"}
          </Badge>
          {t.featured && (
            <Badge variant="soft">
              <StarIcon aria-hidden className="fill-current" />
              Destacada
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link
            {...profile}
            className="inline-flex items-center gap-2 font-semibold text-foreground hover:text-primary"
          >
            <PlayerAvatar
              alias={t.owner.nick}
              playerId={t.owner.player_id}
              photo={t.owner.photo_url}
              size="row"
            />
            {t.owner.nick}
          </Link>
          {t.copied_from && (
            <span>
              · Basada en{" "}
              <Link
                to="/tierlists/$id"
                params={{ id: t.copied_from.id }}
                className="font-semibold hover:text-primary"
              >
                la tierlist de {t.copied_from.nick}
              </Link>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-pressed={t.liked}
            disabled={!t.can_like || actions.like.isPending}
            title={
              t.is_owner
                ? "No puedes darle me gusta a la tuya"
                : t.can_like
                  ? undefined
                  : "Necesitas tu ficha de jugador"
            }
            onClick={() => actions.like.mutate(!t.liked)}
          >
            <HeartIcon
              aria-hidden
              className={cn(t.liked && "fill-current text-destructive")}
            />
            <span className="tabular-nums">{t.likes}</span>
            <span className="sr-only">me gusta</span>
          </Button>
          {t.is_owner && (
            <>
              <Button size="sm" onClick={() => onEdit(true)}>
                <PencilIcon aria-hidden />
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={actions.feature.isPending}
                onClick={() => actions.feature.mutate(!t.featured)}
              >
                <StarIcon
                  aria-hidden
                  className={cn(t.featured && "fill-current")}
                />
                {t.featured ? "Quitar de destacada" : "Destacar en mi perfil"}
              </Button>
            </>
          )}
          {t.can_copy && (
            <Button
              variant="outline"
              size="sm"
              disabled={actions.copy.isPending}
              onClick={() =>
                actions.copy.mutate(undefined, {
                  onSuccess: (r) =>
                    void navigate({
                      to: "/tierlists/$id",
                      params: { id: r.id },
                      search: { editar: true },
                    }),
                })
              }
            >
              <CopyIcon aria-hidden />
              Copiar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => {
              setExporting(true)
              downloadTierlist(t)
                .catch(() => toast.error("No se pudo armar la imagen"))
                .finally(() => setExporting(false))
            }}
          >
            <DownloadIcon aria-hidden />
            Descargar imagen
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigator.clipboard
                .writeText(`${window.location.origin}/tierlists/${t.id}`)
                .then(
                  () => toast.success("Enlace copiado"),
                  () => toast.error("No se pudo copiar el enlace")
                )
            }
          >
            <LinkIcon aria-hidden />
            Copiar enlace
          </Button>
          {t.can_report && (
            <CommentReportDialog
              author={t.owner.nick}
              title={`Denunciar la tierlist de ${t.owner.nick}`}
              onReport={(reason, note) =>
                actions.report.mutateAsync({ reason, note })
              }
            />
          )}
          {t.is_owner && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => setDeleting(true)}
            >
              <Trash2Icon aria-hidden />
              Borrar
            </Button>
          )}
        </div>
      </header>

      <TierBoard tierlist={t} />
      {t.tiers.every((r) => r.items.length === 0) && (
        <p className="text-sm text-muted-foreground">
          {t.is_owner
            ? "Todavía está vacía: toca Editar para agregar y ordenar."
            : "Todavía está vacía."}
        </p>
      )}

      <TierlistComments tierlist={t} />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Borrar la tierlist"
        description="Se borra con sus comentarios y me gusta. No se puede deshacer."
        confirmLabel="Borrar"
        danger
        pending={actions.remove.isPending}
        error={actions.remove.error}
        onConfirm={() =>
          actions.remove.mutate(undefined, {
            onSuccess: () => void navigate(profile),
          })
        }
      />
    </div>
  )
}
