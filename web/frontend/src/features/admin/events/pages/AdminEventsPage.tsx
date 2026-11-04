import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import { PlusIcon } from "lucide-react"
import { z } from "zod"

import { useMe } from "@/auth/queries"
import { FilterChips } from "@/components/brand/FilterChips"
import { SearchBox } from "@/components/brand/SearchBox"
import { Badge, type BadgeVariant } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SelectButton } from "@/components/data-table/DataTable"
import {
  useServerTable,
  type DataColumn,
} from "@/components/data-table/useServerTable"
import type { EventSummary } from "@/features/events/types"
import { AdminHeader, AdminTable } from "../../components/ui"
import { fmtDate } from "../../lib/format"
import { ADMIN_EVENTS_PER, adminEventsOptions } from "../api/queries"
import {
  nextStep,
  STATUS_LABEL,
  TEMPLATE_LABEL,
  type EventStatus,
} from "../lib/model"

export const adminEventsSearch = z.object({
  status: z
    .enum(["registration", "in_progress", "finished", "cancelled"])
    .optional()
    .catch(undefined),
  q: z.string().max(60).optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
})
export type AdminEventsSearch = z.infer<typeof adminEventsSearch>

const STATUS_TONE: Record<EventStatus, BadgeVariant> = {
  registration: "primary",
  in_progress: "win",
  finished: "muted",
  cancelled: "danger",
}

const dates = (e: EventSummary) =>
  e.starts_on
    ? e.ends_on && e.ends_on !== e.starts_on
      ? `${fmtDate(e.starts_on)} – ${fmtDate(e.ends_on)}`
      : fmtDate(e.starts_on)
    : "Sin fecha"

const COLUMNS: DataColumn<EventSummary>[] = [
  {
    id: "name",
    header: "Torneo",
    headClassName: "pl-4",
    cellClassName: "py-2 pl-2",
    cell: ({ row: { original: e } }) => (
      <SelectButton>
        <span className="font-semibold">{e.name}</span>
      </SelectButton>
    ),
  },
  {
    id: "format",
    header: "Formato",
    cell: ({ row: { original: e } }) => (
      <span className="text-muted-foreground">
        {TEMPLATE_LABEL[e.template]}
      </span>
    ),
  },
  {
    id: "mode",
    header: "Modo",
    cell: ({ row: { original: e } }) => (
      <span className="font-mono text-xs">{e.game_mode}</span>
    ),
  },
  {
    id: "status",
    header: "Estado",
    cell: ({ row: { original: e } }) => (
      <Badge variant={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
    ),
  },
  {
    id: "teams",
    header: "Equipos",
    cellClassName: "font-mono text-xs",
    cell: ({ row: { original: e } }) =>
      e.max_teams ? `${e.teams} / ${e.max_teams}` : e.teams,
  },
  {
    id: "dates",
    header: "Fechas",
    cellClassName: "whitespace-nowrap text-muted-foreground",
    cell: ({ row: { original: e } }) => dates(e),
  },
  {
    id: "organizer",
    header: "Organizador",
    cellClassName: "text-muted-foreground",
    cell: ({ row: { original: e } }) => e.organizer?.alias ?? "—",
  },
  {
    id: "next",
    header: "Qué falta",
    headClassName: "pr-4",
    cellClassName: "pr-4",
    cell: ({ row: { original: e } }) => {
      const s = nextStep(e)
      return (
        <span
          className={cn(
            "text-[13px]",
            s.tone === "warn" &&
              "font-medium text-amber-700 dark:text-amber-400",
            s.tone === "muted" && "text-muted-foreground"
          )}
        >
          {s.text}
        </span>
      )
    },
  },
]

/** Administración › Torneos: todos (admin y moderador) o los propios (organizador). */
export function AdminEventsPage({
  search,
  onSearch,
}: {
  search: AdminEventsSearch
  onSearch: (patch: Partial<AdminEventsSearch>) => void
}) {
  const me = useMe().data
  const navigate = useNavigate()
  const organizer = me?.role === "organizer" ? me.id : undefined
  // El moderador opera torneos, pero no los crea.
  const canCreate = me?.role === "admin" || me?.role === "organizer"
  const page = search.page ?? 1
  const list = useQuery({
    ...adminEventsOptions({
      status: search.status,
      q: search.q,
      organizer,
      page,
    }),
    enabled: !!me,
  })
  const table = useServerTable({
    columns: COLUMNS,
    data: list.data?.items as EventSummary[] | undefined,
    total: list.data?.total,
    page,
    per: ADMIN_EVENTS_PER,
    onPage: (p) => onSearch({ page: p === 1 ? undefined : p }),
    getRowId: (e) => e.id,
  })
  const filter = (patch: Partial<AdminEventsSearch>) =>
    onSearch({ ...patch, page: undefined })

  return (
    <section className="flex flex-col gap-5">
      <AdminHeader
        title="Torneos"
        subtitle={
          organizer
            ? "Tus torneos: inscripciones, siembra, fixture, horarios y resultados."
            : "Todos los torneos: inscripciones, siembra, fixture, horarios y resultados. La columna «Qué falta» dice el siguiente paso de cada uno."
        }
        action={
          canCreate && (
            <Button
              size="md"
              onClick={() => void navigate({ to: "/admin/events/new" })}
            >
              <PlusIcon aria-hidden />
              Crear torneo
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips
          label="Estado"
          value={search.status}
          onChange={(v) => filter({ status: v })}
          options={[
            { value: undefined, label: "Todos" },
            { value: "registration", label: STATUS_LABEL.registration },
            { value: "in_progress", label: STATUS_LABEL.in_progress },
            { value: "finished", label: STATUS_LABEL.finished },
            { value: "cancelled", label: STATUS_LABEL.cancelled },
          ]}
        />
        <div className="w-full sm:ml-auto sm:w-64">
          <SearchBox
            value={search.q}
            placeholder="Buscar torneo"
            label="Buscar torneo"
            onChange={(q) => filter({ q })}
          />
        </div>
      </div>
      <AdminTable
        table={table}
        query={list}
        className="min-w-[860px]"
        empty={
          search.status || search.q
            ? "Ningún torneo con esos filtros."
            : "Todavía no hay torneos."
        }
        selection={{
          isSelected: () => false,
          onSelect: (e) =>
            void navigate({
              to: "/admin/events/$id",
              params: { id: e.id },
            }),
        }}
      />
    </section>
  )
}
