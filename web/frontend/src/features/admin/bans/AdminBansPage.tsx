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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { serverStatusOptions } from "@/features/public/queries"
import { SearchBox } from "@/features/ranking/SearchBox"
import { daysUntil, fmtDate } from "../format"
import {
  AdminHeader,
  AdminTabs,
  Chip,
  EmptyState,
  Pager,
  PickHint,
  QueryError,
  SplitLayout,
  TableBox,
  headCell,
} from "../ui"
import { BanDialog } from "./BanDialog"
import { BanPanel } from "./BanPanel"
import { BAN_STATUS, banLabel, banOrigin } from "./bans"
import {
  BANS_PER,
  banCountOptions,
  banPerson,
  bansOptions,
  personBansOptions,
  type Ban,
  type BanFilters,
  type BanStatus,
} from "./queries"

const STATUS_TABS = ["active", "expired", "lifted", "all"] as const
type StatusTab = (typeof STATUS_TABS)[number]

/** Filtros de la URL de `/admin/bans` (todos opcionales; sin estado = Activos). */
export const banSearchSchema = z.object({
  status: z.enum(STATUS_TABS).optional().catch(undefined),
  source: z.enum(["web", "server", "import"]).optional().catch(undefined),
  server: z.uuid().optional().catch(undefined),
  q: z.string().max(60).optional().catch(undefined),
  sort: z.enum(["recent", "soon"]).optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
  ban: z.uuid().optional().catch(undefined),
})
export type BanSearch = z.infer<typeof banSearchSchema>

const ALL = "all"

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
          list.isError ? (
            <QueryError
              error={list.error}
              onRetry={() => void list.refetch()}
            />
          ) : list.isPending ? (
            <Skeleton className="h-80 rounded-xl" />
          ) : list.data.items.length === 0 ? (
            <EmptyState>Ningún baneo con esos filtros.</EmptyState>
          ) : (
            <TableBox>
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={cn(headCell, "pl-4")}>
                      Jugador
                    </TableHead>
                    <TableHead className={headCell}>Motivo</TableHead>
                    <TableHead className={headCell}>Vence</TableHead>
                    <TableHead className={headCell}>Origen</TableHead>
                    {tab === "all" && (
                      <TableHead className={headCell}>Estado</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.items.map((b) => (
                    <BanRow
                      key={b.id}
                      b={b}
                      on={b.id === search.ban}
                      showStatus={tab === "all"}
                      onSelect={() => open(b)}
                    />
                  ))}
                </TableBody>
              </Table>
              <Pager
                page={page}
                total={list.data.total}
                per={BANS_PER}
                onPage={(p) => onSearch({ page: p === 1 ? undefined : p })}
              />
            </TableBox>
          )
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

function BanRow({
  b,
  on,
  showStatus,
  onSelect,
}: {
  b: Ban
  on: boolean
  showStatus: boolean
  onSelect: () => void
}) {
  const origin = banOrigin(b)
  const st = BAN_STATUS[b.status]
  const days = b.expires_at ? daysUntil(b.expires_at) : 0
  return (
    <TableRow className={cn("align-top", on && "bg-primary/[0.08]")}>
      <TableCell className="py-1.5 pl-2">
        <button
          type="button"
          aria-pressed={on}
          onClick={onSelect}
          className="flex w-full flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
        >
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
        </button>
      </TableCell>
      <TableCell className="max-w-[280px] py-3 whitespace-normal">
        {b.reason}
      </TableCell>
      <TableCell className="py-3 whitespace-nowrap">
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
      </TableCell>
      <TableCell className="py-3">
        <span className="flex flex-col items-start gap-1">
          <Chip tone={origin.tone}>{origin.label}</Chip>
          <span className="text-xs text-muted-foreground">{origin.by}</span>
        </span>
      </TableCell>
      {showStatus && (
        <TableCell className="py-3">
          <Chip tone={st.tone}>{st.label}</Chip>
        </TableCell>
      )}
    </TableRow>
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
