import { useQuery } from "@tanstack/react-query"
import { z } from "zod"

import { useMe } from "@/auth/queries"
import { FilterChips } from "@/components/brand/FilterChips"
import { SearchBox } from "@/components/brand/SearchBox"
import { TeamCrest } from "@/components/brand/TeamCrest"
import { Badge } from "@/components/ui/badge"
import { SelectButton } from "@/components/data-table/DataTable"
import {
  useServerTable,
  type DataColumn,
} from "@/components/data-table/useServerTable"
import {
  AdminHeader,
  AdminTable,
  AdminTabs,
  PickHint,
  SplitLayout,
} from "../../components/ui"
import { ago } from "../../lib/format"
import {
  ADMIN_TEAMS_PER,
  adminTeamsOptions,
  type AdminTeam,
} from "../api/queries"
import { TeamConfigTab } from "../components/TeamConfigTab"
import { TeamPanel } from "../components/TeamPanel"

export const adminTeamsSearch = z.object({
  tab: z.enum(["moderate", "config"]).optional().catch(undefined),
  filter: z
    .enum(["blocked", "incomplete", "no_leader", "in_event"])
    .optional()
    .catch(undefined),
  q: z.string().max(60).optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
  team: z.string().optional().catch(undefined),
})
export type AdminTeamsSearch = z.infer<typeof adminTeamsSearch>

const COLUMNS: DataColumn<AdminTeam>[] = [
  {
    id: "team",
    header: "Equipo",
    headClassName: "pl-4",
    cellClassName: "py-1.5 pl-2",
    cell: ({ row: { original: t } }) => (
      <SelectButton>
        <span className="flex min-w-0 items-center gap-2">
          <TeamCrest team={t} size="xs" />
          <span className="truncate font-semibold">{t.name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {t.tag}
          </span>
          {t.blocked && <Badge variant="danger">palabra bloqueada</Badge>}
        </span>
      </SelectButton>
    ),
  },
  {
    id: "leader",
    header: "Líder",
    cell: ({ row: { original: t } }) =>
      t.captain ? t.captain.alias : <Badge variant="warn">sin líder</Badge>,
  },
  {
    id: "members",
    header: "Plantel",
    cellClassName: "font-mono text-xs",
    cell: ({ row: { original: t } }) => `${t.members}/10`,
  },
  {
    id: "five",
    header: "5v5",
    cell: ({ row: { original: t } }) =>
      t.players >= 5 ? (
        <Badge variant="win">apto</Badge>
      ) : (
        <Badge variant="muted">faltan {5 - t.players}</Badge>
      ),
  },
  {
    id: "events",
    header: "Torneos",
    cellClassName: "font-mono text-xs",
    cell: ({ row: { original: t } }) => t.events_active || "—",
  },
  {
    id: "change",
    header: "Último cambio",
    headClassName: "pr-4",
    cellClassName: "pr-4 text-muted-foreground",
    cell: ({ row: { original: t } }) =>
      t.last_change_at ? ago(t.last_change_at) : "—",
  },
]

/** Administración › Equipos: Moderar equipos (moderadores y admins) y Configuración equipo (admin). */
export function AdminTeamsPage({
  search,
  onSearch,
}: {
  search: AdminTeamsSearch
  onSearch: (patch: Partial<AdminTeamsSearch>) => void
}) {
  const isAdmin = useMe().data?.role === "admin"
  const tab = isAdmin ? (search.tab ?? "moderate") : "moderate"
  return (
    <section className="flex flex-col gap-5">
      <AdminHeader
        title="Equipos"
        subtitle={
          isAdmin
            ? "Corregir equipos a mano y las reglas de todos. Cada cambio del staff le avisa al líder y queda en el historial."
            : "Corregir nombres, logos y planteles. Cada cambio le avisa al líder y queda en el historial."
        }
      />
      {isAdmin && (
        <AdminTabs
          label="Equipos"
          value={tab}
          onChange={(t) => onSearch({ tab: t === "moderate" ? undefined : t })}
          tabs={[
            { key: "moderate", label: "Moderar equipos" },
            { key: "config", label: "Configuración equipo" },
          ]}
        />
      )}
      {tab === "config" ? (
        <TeamConfigTab />
      ) : (
        <Moderate search={search} onSearch={onSearch} isAdmin={isAdmin} />
      )}
    </section>
  )
}

function Moderate({
  search,
  onSearch,
  isAdmin,
}: {
  search: AdminTeamsSearch
  onSearch: (patch: Partial<AdminTeamsSearch>) => void
  isAdmin: boolean
}) {
  const page = search.page ?? 1
  const list = useQuery(
    adminTeamsOptions({ filter: search.filter, q: search.q, page })
  )
  const table = useServerTable({
    columns: COLUMNS,
    data: list.data?.items,
    total: list.data?.total,
    page,
    per: ADMIN_TEAMS_PER,
    onPage: (p) => onSearch({ page: p === 1 ? undefined : p }),
    getRowId: (t) => t.id,
  })
  const filter = (patch: Partial<AdminTeamsSearch>) =>
    onSearch({ ...patch, page: undefined })
  const selected = list.data?.items.find((t) => t.id === search.team)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips
          label="Filtrar equipos"
          value={search.filter}
          onChange={(v) => filter({ filter: v })}
          options={[
            { value: undefined, label: "Todos" },
            { value: "blocked", label: "Palabra bloqueada" },
            { value: "incomplete", label: "Incompletos" },
            { value: "no_leader", label: "Sin líder" },
            { value: "in_event", label: "En un torneo" },
          ]}
        />
        <div className="w-full sm:ml-auto sm:w-72">
          <SearchBox
            value={search.q}
            placeholder="Nombre, sigla o jugador"
            label="Buscar equipo"
            onChange={(q) => filter({ q })}
          />
        </div>
      </div>
      <SplitLayout
        asideLabel="Equipo elegido"
        main={
          <AdminTable
            table={table}
            query={list}
            className="min-w-[680px]"
            empty="Ningún equipo con esos filtros."
            selection={{
              isSelected: (t) => t.id === search.team,
              onSelect: (t) => onSearch({ team: t.id }),
            }}
          />
        }
        aside={
          selected ? (
            <TeamPanel key={selected.id} team={selected} isAdmin={isAdmin} />
          ) : (
            <PickHint
              title="Elige un equipo"
              text="Verás su plantel, las acciones que puedes hacer y el historial de cambios."
            />
          )
        }
      />
    </div>
  )
}
