import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { BanIcon } from "lucide-react"
import { useState } from "react"
import { z } from "zod"

import { canBanPermanent } from "@/auth/permissions"
import { useMe } from "@/auth/queries"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SelectButton } from "@/components/data-table/DataTable"
import {
  useServerTable,
  type DataColumn,
} from "@/components/data-table/useServerTable"
import { serverStatusOptions } from "@/features/public/api/queries"
import { SearchBox } from "@/components/brand/SearchBox"
import { daysUntil, fmtDate } from "../../lib/format"
import {
  AdminHeader,
  AdminTable,
  AdminTabs,
  Chip,
  PickHint,
  SplitLayout,
} from "../../components/ui"
import { BanDialog } from "../components/BanDialog"
import { BanPanel } from "../components/BanPanel"
import { BAN_STATUS, banLabel, banOrigin } from "../lib/bans"
import {
  BANS_PER,
  banCountOptions,
  banPerson,
  bansOptions,
  personBansOptions,
} from "../api/queries"
import type { Ban, BanFilters, BanStatus } from "../types"
import { banSearchSchema, STATUS_TABS } from "../lib/search"

type StatusTab = (typeof STATUS_TABS)[number]
export type BanSearch = z.infer<typeof banSearchSchema>

const ALL = "all"

const BAN_COLUMNS: DataColumn<Ban>[] = [
  {
    id: "player",
    header: "Jugador",
    headClassName: "pl-4",
    cellClassName: "py-1.5 pl-2",
    cell: ({ row: { original: b } }) => (
      <SelectButton>
        <span
          className={cn(
            "font-semibold break-all",
            !b.player && !b.nick && "font-mono text-[13px] font-normal"
          )}
        >
          {banLabel(b)}
        </span>
        <span className="text-xs text-muted-foreground">
          {b.player ? "Ficha" : "SteamID sin ficha"}
        </span>
      </SelectButton>
    ),
  },
  {
    id: "reason",
    header: "Motivo",
    cellClassName: "max-w-[280px] py-3 whitespace-normal",
    cell: ({ row }) => row.original.reason,
  },
  {
    id: "expires",
    header: "Vence",
    cellClassName: "py-3 whitespace-nowrap",
    cell: ({ row: { original: b } }) => {
      const days = b.expires_at ? daysUntil(b.expires_at) : 0
      return (
        <span className="flex flex-col gap-0.5">
          <span className={cn(b.permanent && "font-semibold text-destructive")}>
            {b.permanent ? "Permanente" : fmtDate(b.expires_at)}
          </span>
          <span className="text-xs text-muted-foreground">
            {b.status === "active" && !b.permanent
              ? days <= 1
                ? "mañana"
                : `en ${days} días`
              : b.status === "lifted" && b.lifted
                ? `${b.lifted.replaced_by ? "Reemplazado" : "Levantado"} el ${fmtDate(b.lifted.at)}`
                : `Desde ${fmtDate(b.created_at)}`}
          </span>
        </span>
      )
    },
  },
  {
    id: "origin",
    header: "Origen",
    cellClassName: "py-3",
    cell: ({ row }) => {
      const origin = banOrigin(row.original)
      return (
        <span className="flex flex-col items-start gap-1">
          <Chip tone={origin.tone}>{origin.label}</Chip>
          <span className="text-xs text-muted-foreground">{origin.by}</span>
        </span>
      )
    },
  },
]

// En "Todos" se suma el estado de cada baneo.
const BAN_COLUMNS_ALL: DataColumn<Ban>[] = [
  ...BAN_COLUMNS,
  {
    id: "status",
    header: "Estado",
    cellClassName: "py-3",
    cell: ({ row }) => {
      const st = BAN_STATUS[row.original.status]
      return <Chip tone={st.tone}>{st.label}</Chip>
    },
  },
]

export function AdminBansPage({
  search,
  onSearch,
}: {
  search: BanSearch
  /** Cambia parte de la búsqueda; `undefined` borra el filtro. */
  onSearch: (patch: Partial<BanSearch>) => void
}) {
  const role = useMe().data?.role ?? "user"
  const canPermanent = canBanPermanent(role)
  const tab: StatusTab = search.status ?? "active"
  const status: BanStatus | undefined = tab === "all" ? undefined : tab
  const page = search.page ?? 1
  const filters: BanFilters = {
    source: search.source,
    server: search.server,
    q: search.q,
    sort: search.sort ?? "recent",
  }
  // Cambiar un filtro vuelve a la primera página.
  const filter = (patch: Partial<BanSearch>) =>
    onSearch({ ...patch, page: undefined })

  const list = useQuery(bansOptions(status, filters, page))
  const table = useServerTable({
    columns: tab === "all" ? BAN_COLUMNS_ALL : BAN_COLUMNS,
    data: list.data?.items,
    total: list.data?.total,
    page,
    per: BANS_PER,
    onPage: (p) => onSearch({ page: p === 1 ? undefined : p }),
    getRowId: (b) => b.id,
  })
  const counts = {
    active: useQuery(banCountOptions("active", filters)).data,
    expired: useQuery(banCountOptions("expired", filters)).data,
    lifted: useQuery(banCountOptions("lifted", filters)).data,
  }
  const servers = useQuery(serverStatusOptions).data?.servers ?? []
  const [banning, setBanning] = useState(false)

  // El baneo elegido sale de la lista, del historial de esa persona o del último que se abrió
  // (la API no tiene GET /bans/{id}).
  const [picked, setPicked] = useState<Ban | null>(null)
  const fromList = list.data?.items.find((b) => b.id === search.ban)
  const base = fromList ?? (picked?.id === search.ban ? picked : null)
  const history = useQuery(personBansOptions(base ? banPerson(base) : null))
  const selected =
    fromList ?? history.data?.items.find((b) => b.id === search.ban) ?? base

  const open = (b: Ban | string) => {
    if (typeof b === "string") {
      onSearch({ ban: b })
      return
    }
    setPicked(b)
    onSearch({ ban: b.id })
  }

  return (
    <section className="flex flex-col gap-5">
      <AdminHeader
        title="Baneos"
        subtitle="Una sola lista para todos los servidores: el nuestro, RBK y flow. Entran los que se ponen desde la web, los !ban del juego y los importados de los servidores viejos."
        action={
          <Button
            size="md"
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => setBanning(true)}
          >
            <BanIcon aria-hidden />
            Banear
          </Button>
        }
      />
      {!canPermanent && (
        <Alert>
          <AlertDescription>
            Entras como moderador: puedes banear, cambiar o levantar cualquier
            baneo que no sea permanente. Los permanentes son de los admins.
          </AlertDescription>
        </Alert>
      )}

      <AdminTabs
        label="Estado de los baneos"
        value={tab}
        onChange={(t) =>
          filter({ status: t === "active" ? undefined : t, ban: undefined })
        }
        tabs={[
          { key: "active", label: "Activos", badge: counts.active },
          { key: "expired", label: "Vencidos", badge: counts.expired },
          { key: "lifted", label: "Levantados", badge: counts.lifted },
          {
            key: "all",
            label: "Todos",
            badge:
              counts.active !== undefined &&
              counts.expired !== undefined &&
              counts.lifted !== undefined
                ? counts.active + counts.expired + counts.lifted
                : undefined,
          },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox
          value={search.q}
          label="Buscar baneos"
          placeholder="Nick, motivo o SteamID"
          onChange={(q) => filter({ q })}
        />
        <FilterSelect
          label="Origen"
          value={search.source ?? ALL}
          onChange={(v) =>
            filter({ source: v === ALL ? undefined : (v as Ban["source"]) })
          }
          options={[
            { value: ALL, label: "Todos" },
            { value: "web", label: "Web" },
            { value: "server", label: "Juego (!ban)" },
            { value: "import", label: "Importados" },
          ]}
        />
        <FilterSelect
          label="Servidor"
          value={search.server ?? ALL}
          onChange={(v) => filter({ server: v === ALL ? undefined : v })}
          options={[
            { value: ALL, label: "Todos" },
            ...servers.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
        <FilterSelect
          className="sm:ml-auto"
          label="Orden"
          value={filters.sort}
          onChange={(v) => filter({ sort: v === "soon" ? "soon" : undefined })}
          options={[
            { value: "recent", label: "Más recientes" },
            { value: "soon", label: "Vencen antes" },
          ]}
        />
      </div>

      <SplitLayout
        asideLabel="Detalle del baneo"
        main={
          <AdminTable
            table={table}
            query={list}
            className="min-w-[700px]"
            empty="Ningún baneo con esos filtros."
            rowClassName={() => "align-top"}
            selection={{
              isSelected: (b) => b.id === search.ban,
              onSelect: open,
            }}
          />
        }
        aside={
          <>
            {selected ? (
              <BanPanel
                key={selected.id}
                ban={selected}
                others={history.data?.items}
                canPermanent={canPermanent}
                onClose={() => onSearch({ ban: undefined })}
                onPick={open}
                onChanged={open}
              />
            ) : (
              <PickHint
                title="Elige un baneo"
                text="Acá ves quién lo puso y dónde, si se levantó o lo reemplazó otro, y los demás baneos de esa persona."
              />
            )}
            <p className="rounded-lg bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              Al conectarse, el servidor lo frena siempre. A quien ya está
              jugando lo echa la próxima sincronización (cada 3 minutos o al
              empezar el mapa), o al momento con{" "}
              <span className="font-mono">!syncbans</span>.
            </p>
          </>
        }
      />

      {banning && (
        <BanDialog
          canPermanent={canPermanent}
          onClose={() => setBanning(false)}
          onSaved={(b) => {
            setPicked(b)
            onSearch({ status: undefined, page: undefined, ban: b.id })
          }}
        />
      )}
    </section>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-[13px] text-muted-foreground",
        className
      )}
    >
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="h-9 w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  )
}
