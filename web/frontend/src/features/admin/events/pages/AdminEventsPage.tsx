import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { cn } from "cn"
import { HistoryIcon, PlusIcon } from "lucide-react"
import { z } from "zod"

import {
  canCreateEvent,
  canCreateHistoricEvent,
  canReviewEvents,
} from "@/auth/permissions"
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
import {
  ADMIN_EVENTS_PER,
  adminEventsOptions,
  pendingGamesOptions,
} from "../api/queries"
import { EventMarks } from "@/features/events/components/EventMarks"
import {
  nextStep,
  STATUS_LABEL,
  TEMPLATE_LABEL,
  type EventStatus,
} from "../lib/model"

const MARKS = ["pending", "games", "historic", "testing", "rejected"] as const
type Mark = (typeof MARKS)[number]

export const adminEventsSearch = z.object({
  status: z
    .enum(["registration", "in_progress", "finished", "cancelled"])
    .optional()
    .catch(undefined),
  mark: z.enum(MARKS).optional().catch(undefined),
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
      <div className="flex flex-col gap-1">
        <SelectButton>
          <span className="font-semibold">{e.name}</span>
        </SelectButton>
        <EventMarks event={e} />
      </div>
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
      const s =
        e.approval === "pending"
          ? { text: "Revisar y aprobar", tone: "warn" as const }
          : e.approval === "rejected"
            ? {
                text: "Rechazado: corregir y volver a enviar",
                tone: "warn" as const,
              }
            : e.pending_games > 0
              ? {
                  text: `${e.pending_games} mix${e.pending_games === 1 ? "" : "es"} por aprobar`,
                  tone: "warn" as const,
                }
              : nextStep(e)
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
  // El moderador no crea torneos normales, pero sí sube históricos.
  const canCreate = !!me && canCreateEvent(me.role)
  const canHistoric = !!me && canCreateHistoricEvent(me.role)
  const staff = !!me && canReviewEvents(me.role)
  const page = search.page ?? 1
  const mark: Mark | undefined =
    !staff && (search.mark === "testing" || search.mark === "games")
      ? undefined
      : search.mark
  const list = useQuery({
    ...adminEventsOptions({
      status: search.status,
      q: search.q,
      organizer,
      page,
      approval:
        mark === "pending"
          ? "pending"
          : mark === "rejected"
            ? "rejected"
            : undefined,
      historic: mark === "historic" ? true : undefined,
      testing: mark === "testing" ? true : undefined,
      pending_games: mark === "games" ? true : undefined,
    }),
    enabled: !!me,
  })
  // Aviso del staff: torneos y mixes que esperan aprobación.
  const pendingEvents = useQuery({
    ...adminEventsOptions({ approval: "pending", page: 1 }),
    enabled: staff,
  })
  const pendingGames = useQuery({ ...pendingGamesOptions({}), enabled: staff })
  const waiting = {
    events: pendingEvents.data?.total ?? 0,
    games: pendingGames.data?.total ?? 0,
  }
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
          (canCreate || canHistoric) && (
            <div className="flex flex-wrap gap-2">
              {canHistoric && (
                <Button
                  size="md"
                  variant="outline"
                  onClick={() =>
                    void navigate({
                      to: "/admin/events/new",
                      search: { historic: true },
                    })
                  }
                >
                  <HistoryIcon aria-hidden />
                  Subir torneo histórico
                </Button>
              )}
              {canCreate && (
                <Button
                  size="md"
                  onClick={() => void navigate({ to: "/admin/events/new" })}
                >
                  <PlusIcon aria-hidden />
                  Crear torneo
                </Button>
              )}
            </div>
          )
        }
      />
      {staff && waiting.events + waiting.games > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <p>
            <b className="text-amber-900 dark:text-amber-200">
              {[
                waiting.events > 0 &&
                  `${waiting.events} torneo${waiting.events === 1 ? "" : "s"}`,
                waiting.games > 0 &&
                  `${waiting.games} mix${waiting.games === 1 ? "" : "es"} vinculado${waiting.games === 1 ? "" : "s"}`,
              ]
                .filter(Boolean)
                .join(" y ")}{" "}
              {waiting.events + waiting.games === 1 ? "espera" : "esperan"}{" "}
              aprobación.
            </b>{" "}
            <span className="text-muted-foreground">
              Los torneos pendientes solo los ven su organizador, los
              moderadores y los admins. Los mixes ya cuentan en la llave, pero
              no en el ranking.
            </span>
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              filter({ mark: waiting.events > 0 ? "pending" : "games" })
            }
          >
            Ver pendientes
          </Button>
        </div>
      )}
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
        <FilterChips
          label="Marca"
          value={mark}
          onChange={(v) => filter({ mark: v })}
          options={[
            { value: undefined, label: "Todas" },
            { value: "pending", label: "Pendientes" },
            ...(staff
              ? [{ value: "games" as const, label: "Mixes por aprobar" }]
              : []),
            { value: "historic", label: "Históricos" },
            ...(staff
              ? [{ value: "testing" as const, label: "En testing" }]
              : []),
            { value: "rejected", label: "Rechazados" },
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
          search.status || search.q || mark
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
