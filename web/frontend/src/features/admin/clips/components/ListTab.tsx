import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ExternalLinkIcon, RotateCcwIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { FilterChips } from "@/components/brand/FilterChips"
import { SearchBox } from "@/components/brand/SearchBox"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useServerTable,
  type DataColumn,
} from "@/components/data-table/useServerTable"
import { AdminTable, Chip } from "../../components/ui"
import { fmtDate, type Tone } from "../../lib/format"
import {
  clipListOptions,
  useReprocessClips,
  type ClipListFilters,
} from "../api/queries"
import { CLIP_TYPES, clipLabel } from "../lib/clips"
import type { AdminClip, AdminClipStatus, ClipType } from "../types"

// Administración › Clips › Clips (plan docs/bitacora/2026-11-03-reportes-clips-nombre-equipo): todas las jugadas
// que se muestran, para elegir varias y mandarlas a grabar de nuevo.

const PER = 25
const ALL = "__all__"

const STATUS: { value: AdminClipStatus; label: string }[] = [
  { value: "done", label: "Con video" },
  { value: "failed", label: "Fallidos" },
  { value: "processing", label: "Grabándose" },
  { value: "queued", label: "En cola" },
  { value: "no_demo", label: "Sin demo" },
]

const VIDEO: Record<string, { label: string; tone: Tone }> = {
  done: { label: "Con video", tone: "win" },
  failed: { label: "Falló", tone: "danger" },
  processing: { label: "Grabándose", tone: "warn" },
  pending: { label: "En cola", tone: "neutral" },
  unavailable: { label: "Sin demo", tone: "neutral" },
}

/** El link para mirar el video: el .mp4 de R2 o, si ya no está, el de Drive. */
const videoHref = (c: AdminClip["clip"]) => c.video.url ?? c.video.embed_url

export function ListTab() {
  const [filters, setFilters] = useState<ClipListFilters>({})
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<Map<string, AdminClip>>(new Map())
  const [confirm, setConfirm] = useState(false)
  const [failed, setFailed] = useState<{ who: string; error: string }[]>([])
  const list = useQuery(clipListOptions(filters, page, PER))
  const reprocess = useReprocessClips()

  const rows = list.data?.items ?? []
  const pickable = rows.filter((r) => r.can_reprocess)
  const allOnPage =
    pickable.length > 0 && pickable.every((r) => picked.has(r.clip.id))
  const someOnPage = pickable.some((r) => picked.has(r.clip.id))

  function toggle(r: AdminClip, on: boolean) {
    setPicked((m) => {
      const next = new Map(m)
      if (on) next.set(r.clip.id, r)
      else next.delete(r.clip.id)
      return next
    })
  }
  function togglePage(on: boolean) {
    setPicked((m) => {
      const next = new Map(m)
      for (const r of pickable) {
        if (on) next.set(r.clip.id, r)
        else next.delete(r.clip.id)
      }
      return next
    })
  }
  function filter(patch: ClipListFilters) {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(1)
  }

  const columns: DataColumn<AdminClip>[] = [
    {
      id: "pick",
      header: () => (
        <Checkbox
          aria-label="Elegir todos los de esta página"
          checked={allOnPage ? true : someOnPage ? "indeterminate" : false}
          disabled={pickable.length === 0}
          onCheckedChange={(v) => togglePage(v === true)}
        />
      ),
      headClassName: "w-10 pl-4",
      cellClassName: "pl-4",
      cell: ({ row: { original: r } }) => (
        <Checkbox
          aria-label={`Elegir el clip de ${who(r)}, ronda ${r.clip.round}`}
          title={r.blocked_reason ?? undefined}
          checked={picked.has(r.clip.id)}
          disabled={!r.can_reprocess}
          onCheckedChange={(v) => toggle(r, v === true)}
        />
      ),
    },
    {
      id: "play",
      header: "Jugada",
      cell: ({ row: { original: r } }) => (
        <span className="flex items-center gap-2">
          <Chip tone="primary" className="font-mono font-bold">
            {clipLabel(r.clip.type)}
          </Chip>
          <span className="text-xs text-muted-foreground">
            Ronda {r.clip.round}
          </span>
          {r.clip.vip && <Chip tone="vip">VIP</Chip>}
        </span>
      ),
    },
    {
      id: "player",
      header: "Jugador",
      cell: ({ row: { original: r } }) => (
        <span className="font-medium">{who(r)}</span>
      ),
    },
    {
      id: "match",
      header: "Partida",
      cellClassName: "text-[13px]",
      cell: ({ row: { original: r } }) => (
        <Link
          to="/match/$id"
          params={{ id: r.match.id }}
          className="underline-offset-4 hover:underline"
        >
          {[r.match.map, r.match.played_at && fmtDate(r.match.played_at)]
            .filter(Boolean)
            .join(" · ") || "Ver partida"}
        </Link>
      ),
    },
    {
      id: "video",
      header: "Video",
      cell: ({ row: { original: r } }) => {
        const v = VIDEO[r.clip.video.status] ?? VIDEO.pending!
        const href = videoHref(r.clip)
        return (
          <span className="flex items-center gap-2">
            <Chip tone={v.tone}>{v.label}</Chip>
            {r.clip.review === "pending" && (
              <Chip tone="warn">Para revisar</Chip>
            )}
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Ver
                <ExternalLinkIcon className="size-3" aria-hidden />
              </a>
            )}
          </span>
        )
      },
    },
    {
      id: "extra",
      header: "Historial",
      headClassName: "pr-4",
      cellClassName: "pr-4 text-xs text-muted-foreground",
      cell: ({ row: { original: r } }) =>
        [
          r.discord_posted ? "En Discord" : null,
          r.reprocess_count === 1
            ? "Reprocesado 1 vez"
            : r.reprocess_count > 1
              ? `Reprocesado ${r.reprocess_count} veces`
              : null,
        ]
          .filter(Boolean)
          .join(" · ") || "—",
    },
  ]

  const table = useServerTable({
    columns,
    data: rows,
    total: list.data?.total,
    page,
    per: PER,
    onPage: setPage,
    getRowId: (r) => r.clip.id,
  })

  function run() {
    const chosen = [...picked.values()]
    reprocess.mutate(
      chosen.map((r) => r.clip.id),
      {
        onSuccess: ({ results }) => {
          const byId = new Map(chosen.map((r) => [r.clip.id, r]))
          const ok = results.filter((x) => x.ok).length
          const bad = results.filter((x) => !x.ok)
          setConfirm(false)
          setPicked(new Map(bad.map((x) => [x.id, byId.get(x.id)!])))
          setFailed(
            bad.map((x) => ({
              who: byId.get(x.id) ? describe(byId.get(x.id)!) : x.id,
              error: x.error ?? "No se pudo",
            }))
          )
          if (ok)
            toast.success(
              ok === 1
                ? "1 clip se va a grabar de nuevo. Revísalo en Para revisar."
                : `${ok} clips se van a grabar de nuevo. Revísalos en Para revisar.`
            )
          if (bad.length)
            toast.error(
              bad.length === 1
                ? "1 clip no se pudo reprocesar."
                : `${bad.length} clips no se pudieron reprocesar.`
            )
        },
      }
    )
  }

  return (
    <section
      aria-label="Lista de clips"
      className="flex flex-col gap-4 pb-20"
    >
      <p className="max-w-[760px] text-[13px] leading-relaxed text-muted-foreground">
        Todas las jugadas que se muestran, de la más nueva a la más vieja. Elige
        las que salieron mal y mándalas a grabar de nuevo: el video viejo se
        borra y el nuevo no sale en Discord hasta que lo apruebes en{" "}
        <b className="font-semibold text-foreground">Para revisar</b>. Solo se
        pueden reprocesar las que ya se grabaron (o fallaron) y tienen la demo
        guardada (90 días).
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <FilterChips
          label="Estado del video"
          value={filters.status}
          onChange={(v) => filter({ status: v ?? undefined })}
          options={[
            { value: undefined, label: "Todos" },
            ...STATUS.map((s) => ({ value: s.value, label: s.label })),
          ]}
        />
        <Select
          value={filters.type ?? ALL}
          onValueChange={(v) =>
            filter({ type: v === ALL ? undefined : (v as ClipType) })
          }
        >
          <SelectTrigger
            size="sm"
            aria-label="Tipo de jugada"
            className="w-[150px]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las jugadas</SelectItem>
            {CLIP_TYPES.map((t) => (
              <SelectItem key={t.type} value={t.type}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="w-full sm:ml-auto sm:w-64">
          <SearchBox
            value={filters.q}
            placeholder="Nick del jugador"
            label="Buscar clips por jugador"
            onChange={(v) => filter({ q: v })}
          />
        </div>
      </div>

      {failed.length > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3.5 py-3 text-[13px]"
        >
          <span className="flex items-center justify-between gap-2 font-semibold">
            No se pudieron reprocesar
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Cerrar el aviso"
              onClick={() => setFailed([])}
            >
              <XIcon aria-hidden />
            </Button>
          </span>
          <ul className="flex flex-col gap-0.5">
            {failed.map((f, i) => (
              <li key={i}>
                {f.who}: <span className="text-muted-foreground">{f.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AdminTable
        table={table}
        query={list}
        className="min-w-[760px]"
        empty="Ningún clip con esos filtros."
        rowClassName={(r) =>
          picked.has(r.clip.id) ? "bg-primary/5" : undefined
        }
      />

      {picked.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <div
            role="region"
            aria-label="Clips elegidos"
            className="flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5 shadow-lg"
          >
            <span className="text-sm font-semibold">
              {picked.size === 1
                ? "1 clip elegido"
                : `${picked.size} clips elegidos`}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPicked(new Map())}
            >
              Quitar selección
            </Button>
            <Button
              size="sm"
              disabled={picked.size > 50}
              title={picked.size > 50 ? "Hasta 50 a la vez" : undefined}
              onClick={() => setConfirm(true)}
            >
              <RotateCcwIcon aria-hidden />
              Reprocesar
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={
          picked.size === 1
            ? "¿Reprocesar 1 clip?"
            : `¿Reprocesar ${picked.size} clips?`
        }
        description="Se borra el video actual y se vuelve a grabar. El nuevo no sale en Discord hasta que lo apruebes en Para revisar."
        confirmLabel="Reprocesar"
        pending={reprocess.isPending}
        error={reprocess.error}
        onConfirm={run}
      />
    </section>
  )
}

const who = (r: AdminClip) => r.clip.player?.alias ?? r.clip.game_nick

const describe = (r: AdminClip) =>
  `${clipLabel(r.clip.type)} de ${who(r)} (ronda ${r.clip.round}${r.match.map ? `, ${r.match.map}` : ""})`
