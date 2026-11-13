import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import {
  ArchiveIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { FilterChips } from "@/components/brand/FilterChips"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Medal } from "@/features/medals/Medal"
import { CATEGORIES, templateOf } from "@/features/medals/templates"
import { AdminHeader, Chip, EmptyState, QueryError } from "../../components/ui"
import {
  adminMedalsOptions,
  useActivateMedal,
  useArchiveMedal,
  useDeleteMedal,
  type MedalDefinition,
} from "../api/queries"
import { MedalEditor } from "../components/MedalEditor"
import { STATUS_LABEL, STATUS_TONE } from "../lib/editor"

type StatusFilter = "active" | "draft" | "archived" | undefined

/** `edit`: `"new"` para una medalla nueva, el id para editar una, o nada para la lista. */
export function AdminMedalsPage({
  edit,
  onEdit,
}: {
  edit: string | undefined
  onEdit: (id: string | undefined) => void
}) {
  const q = useQuery(adminMedalsOptions)
  const [status, setStatus] = useState<StatusFilter>(undefined)

  if (edit) {
    if (q.isPending) return <Skeleton className="h-[600px] rounded-xl" />
    if (q.isError)
      return <QueryError error={q.error} onRetry={() => void q.refetch()} />
    const def = edit === "new" ? undefined : q.data.find((d) => d.id === edit)
    if (edit !== "new" && !def) {
      return (
        <section className="flex flex-col gap-5">
          <AdminHeader title="Medallas" subtitle="Esa medalla no existe." />
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => onEdit(undefined)}
          >
            Volver a la lista
          </Button>
        </section>
      )
    }
    return (
      <MedalEditor
        key={edit}
        def={def}
        onDone={() => onEdit(undefined)}
        onSaved={(id) => onEdit(id)}
      />
    )
  }

  const items = (q.data ?? []).filter((d) => !status || d.status === status)
  return (
    <section className="flex flex-col gap-5">
      <AdminHeader
        title="Medallas"
        subtitle="Cada medalla sale de una plantilla (un diseño de Kyan con su métrica) con el objetivo y el dibujo que elijas. El juego las da apenas termina cada mix; las de temporada las da el cierre de temporada y las de Comunidad, un admin desde Fichas."
        action={
          <Button size="md" onClick={() => onEdit("new")}>
            <PlusIcon aria-hidden />
            Nueva medalla
          </Button>
        }
      />
      <FilterChips
        label="Estado"
        value={status}
        onChange={(v) => setStatus(v as StatusFilter)}
        options={[
          { value: undefined, label: "Todas" },
          { value: "active", label: "Activas" },
          { value: "draft", label: "Borradores" },
          { value: "archived", label: "Archivadas" },
        ]}
      />
      {q.isError ? (
        <QueryError error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState>No hay medallas con ese estado.</EmptyState>
      ) : (
        CATEGORIES.map((cat) => {
          const list = items.filter(
            (d) => templateOf(d.template)?.category === cat
          )
          if (!list.length) return null
          return (
            <div key={cat} className="flex flex-col gap-3">
              <h2 className="text-[15px] font-semibold">
                {cat}{" "}
                <span className="font-mono text-muted-foreground">
                  {list.length}
                </span>
              </h2>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
                {list.map((d) => (
                  <MedalRow key={d.id} d={d} onEdit={() => onEdit(d.id)} />
                ))}
              </ul>
            </div>
          )
        })
      )}
    </section>
  )
}

function MedalRow({ d, onEdit }: { d: MedalDefinition; onEdit: () => void }) {
  const activate = useActivateMedal()
  const archive = useArchiveMedal()
  const del = useDeleteMedal()
  const [confirm, setConfirm] = useState<
    "activate" | "archive" | "delete" | null
  >(null)
  const [retro, setRetro] = useState(true)
  const engine = !["season_rank", "manual", "event_result"].includes(
    d.aggregation
  )

  return (
    <li
      className={cn(
        "flex gap-3 rounded-xl border p-3",
        d.status === "archived" && "opacity-70"
      )}
    >
      <Medal look={d.design} size={64} title={d.title} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold wrap-anywhere">{d.title}</span>
          <Chip tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Chip>
        </div>
        <span className="text-xs text-muted-foreground">
          {templateOf(d.template)?.title ?? d.template}
          {d.status !== "draft" && (
            <>
              {" "}
              · <span className="font-mono">{d.holders}</span>{" "}
              {d.holders === 1 ? "jugador la tiene" : "jugadores la tienen"}
            </>
          )}
        </span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Button size="xs" variant="outline" onClick={onEdit}>
            <PencilIcon aria-hidden />
            {d.status === "draft" ? "Editar" : "Dibujo"}
          </Button>
          {d.status !== "active" && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => setConfirm("activate")}
            >
              <ZapIcon aria-hidden />
              Activar
            </Button>
          )}
          {d.status === "active" && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => setConfirm("archive")}
            >
              <ArchiveIcon aria-hidden />
              Archivar
            </Button>
          )}
          {d.status === "draft" && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => setConfirm("delete")}
            >
              <Trash2Icon aria-hidden />
              Borrar
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "activate"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Activar "${d.title}"`}
        description={
          engine
            ? "Desde ahora el motor la revisa después de cada mix."
            : d.aggregation === "manual"
              ? "La va a poder dar un admin desde Fichas."
              : d.aggregation === "event_result"
                ? "Se va a dar sola al terminar cada torneo."
                : "Queda disponible para los tramos de Administración › Temporadas."
        }
        confirmLabel="Activar"
        pending={activate.isPending}
        error={activate.error}
        onConfirm={() =>
          activate.mutate(
            { id: d.id, retroactive: engine && retro },
            {
              onSuccess: (r) => {
                setConfirm(null)
                toast.success(
                  r.awarded
                    ? `Medalla activada: se la dio a ${r.awarded} ${r.awarded === 1 ? "jugador" : "jugadores"}.`
                    : "Medalla activada."
                )
              },
            }
          )
        }
      >
        {engine && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={retro}
              onChange={(e) => setRetro(e.target.checked)}
            />
            <span>
              <b className="font-semibold">Dársela a quienes ya la cumplen.</b>{" "}
              Si la apagas, solo cuenta desde el próximo mix de cada jugador.
            </span>
          </label>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === "archive"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Archivar "${d.title}"`}
        description="Deja de otorgarse. Quien ya la tiene la conserva. Para cambiar la condición o el objetivo, archívala y crea otra."
        confirmLabel="Archivar"
        pending={archive.isPending}
        error={archive.error}
        onConfirm={() =>
          archive.mutate(d.id, {
            onSuccess: () => {
              setConfirm(null)
              toast.success("Medalla archivada.")
            },
          })
        }
      />

      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Borrar el borrador "${d.title}"`}
        confirmLabel="Borrar"
        danger
        pending={del.isPending}
        error={del.error}
        onConfirm={() =>
          del.mutate(d.id, {
            onSuccess: () => {
              setConfirm(null)
              toast.success("Borrador borrado.")
            },
          })
        }
      />
    </li>
  )
}
