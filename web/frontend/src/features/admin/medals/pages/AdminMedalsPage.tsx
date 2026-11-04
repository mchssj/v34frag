import { useQuery } from "@tanstack/react-query"
import { SearchIcon, XIcon } from "lucide-react"
import { cn } from "cn"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { FilterChips } from "@/components/brand/FilterChips"
import { MedalImage } from "@/components/brand/MedalImage"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import {
  useServerTable,
  type DataColumn,
} from "@/components/data-table/useServerTable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  seasonShort,
  useMedalCatalog,
  useMedalsByKey,
  type MedalDef,
} from "@/lib/medals"
import {
  AdminHeader,
  AdminTable,
  AdminTabs,
  PanelSection,
  QueryError,
  SplitLayout,
} from "../../components/ui"
import {
  findByAlias,
  GRANTED_PER,
  grantedOptions,
  playerSearchOptions,
  rulesOptions,
  seasonsOptions,
  seasonTop10,
  useGrant,
  usePatchMedal,
  usePatchRule,
  useRecalculate,
  useRemoveMedals,
} from "../api/queries"
import type {
  AdminMedal,
  GrantedFilter,
  MedalRule,
  Pick,
  Season,
} from "../types"

// Administración › Medallas: dar a varios con temporada, ver y corregir las otorgadas, y las reglas de las
// automáticas (docs/bitacora/2026-11-04-medallas-automaticas).

export const MEDAL_TABS = ["give", "granted", "rules"] as const
export type MedalTab = (typeof MEDAL_TABS)[number]

const NONE = "none"
const SOURCE_LABEL = {
  admin: "A mano",
  auto: "Automática",
  temporada: "Temporada",
} as const
// Las que da el cierre de temporada (las automáticas de carrera salen de medal_rules).
const SEASON_AUTO = new Set([
  "podio_puesto_1",
  "podio_puesto_2",
  "podio_puesto_3",
  "top10_temporada",
  "mvp_temporada",
  "top_fragger_temporada",
  "rey_hs_temporada",
  "mejor_awp_temporada",
  "mas_mejorado_temporada",
])

export function AdminMedalsPage({
  tab,
  onTab,
}: {
  tab: MedalTab
  onTab: (t: MedalTab) => void
}) {
  const seasons = useQuery(seasonsOptions).data ?? []
  return (
    <div className="flex flex-col gap-5">
      <AdminHeader
        title="Medallas"
        subtitle="Las de las stats se dan solas al terminar cada mix y las de temporada, al cerrarla. Acá das las que van a mano (torneos, staff, eventos…), corregís las otorgadas y ajustás las reglas."
      />
      <AdminTabs
        label="Secciones de Medallas"
        value={tab}
        onChange={onTab}
        tabs={[
          { key: "give", label: "Dar medallas" },
          { key: "granted", label: "Otorgadas" },
          { key: "rules", label: "Automáticas" },
        ]}
      />
      {tab === "give" && (
        <Give seasons={seasons} onDone={() => onTab("granted")} />
      )}
      {tab === "granted" && <Granted seasons={seasons} />}
      {tab === "rules" && <Rules />}
    </div>
  )
}

// ---------- Dar medallas ----------

function Give({ seasons, onDone }: { seasons: Season[]; onDone: () => void }) {
  const catalog = useMedalCatalog()
  const rules = useQuery(rulesOptions).data
  const grant = useGrant()
  // Por defecto solo las manuales: las automáticas se dan solas y acá hacen falta solo para corregir.
  const [onlyManual, setOnlyManual] = useState(true)
  const auto = useMemo(
    () => new Set([...SEASON_AUTO, ...(rules ?? []).map((r) => r.medal_key)]),
    [rules]
  )
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("all")
  const [kind, setKind] = useState<"player" | "team">("player")
  const [medal, setMedal] = useState<MedalDef | null>(null)
  const [title, setTitle] = useState("")
  const [season, setSeason] = useState<string>(
    () => seasons.find((s) => s.status === "active")?.id ?? NONE
  )
  const [picked, setPicked] = useState<Pick[]>([])

  const categories = useMemo(
    () => [
      ...new Set(
        catalog
          .filter((m) => m.equipo === (kind === "team"))
          .map((m) => m.categoria)
      ),
    ],
    [catalog, kind]
  )
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return catalog.filter(
      (m) =>
        m.equipo === (kind === "team") &&
        (!onlyManual || !auto.has(m.clave)) &&
        (cat === "all" || m.categoria === cat) &&
        (!t || m.titulo.toLowerCase().includes(t) || m.clave.includes(t))
    )
  }, [catalog, q, cat, kind, onlyManual, auto])

  const seasonObj = seasons.find((s) => s.id === season) ?? null
  const label = seasonShort(seasonObj) ?? "CM LEAGUE"

  function give() {
    if (!medal || picked.length === 0) return
    grant.mutate(
      {
        title: title.trim() || medal.titulo,
        medal_key: medal.clave,
        season_id: seasonObj?.id ?? null,
        player_ids: picked.map((p) => p.id),
        icon: "🏅",
      },
      {
        onSuccess: (r) => {
          toast.success(
            `Diste "${title.trim() || medal.titulo}" a ${r.given} ${r.given === 1 ? "jugador" : "jugadores"}.` +
              (r.skipped.length ? ` ${r.skipped.length} ya la tenían.` : ""),
            { action: { label: "Ver otorgadas", onClick: onDone } }
          )
          setPicked([])
        },
        onError: (e) => toast.error(errorMessage(e)),
      }
    )
  }

  return (
    <SplitLayout
      asideLabel="Resumen"
      main={
        <>
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">1. Medalla</h2>
              <FilterChips
                label="Medallas de"
                size="sm"
                value={kind}
                onChange={(v) => {
                  setKind(v)
                  setCat("all")
                  setMedal(null)
                }}
                options={[
                  { value: "player", label: "Jugador" },
                  { value: "team", label: "Equipo" },
                ]}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <InputGroup className="max-w-[320px] min-w-[200px] flex-1">
                <InputGroupAddon>
                  <SearchIcon aria-hidden className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar medalla"
                  aria-label="Buscar medalla"
                  className="text-[13px]"
                />
              </InputGroup>
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger className="w-[220px]" aria-label="Categoría">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FilterChips
                label="Qué medallas mostrar"
                size="sm"
                value={onlyManual ? "manual" : "all"}
                onChange={(v) => setOnlyManual(v === "manual")}
                options={[
                  { value: "manual", label: "Manuales" },
                  { value: "all", label: "Todas (para corregir)" },
                ]}
              />
            </div>
            <div className="grid max-h-[360px] grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 overflow-y-auto pr-1">
              {list.map((m) => (
                <button
                  key={m.clave}
                  type="button"
                  onClick={() => {
                    setMedal(m)
                    setTitle(m.titulo)
                  }}
                  aria-pressed={medal?.clave === m.clave}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border border-transparent p-2 text-center hover:bg-muted",
                    medal?.clave === m.clave && "border-primary bg-primary/10"
                  )}
                >
                  <MedalImage
                    medal={m}
                    season={label}
                    className="h-16 w-auto"
                  />
                  <span className="line-clamp-2 text-[11px] leading-tight">
                    {m.titulo}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">2. Temporada y título</h2>
            <div className="flex flex-wrap gap-3">
              <label className="flex min-w-[200px] flex-1 flex-col gap-1.5 text-xs text-muted-foreground">
                Temporada
                <Select value={season} onValueChange={setSeason}>
                  <SelectTrigger aria-label="Temporada">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={NONE}>
                      Sin temporada (para siempre)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="flex min-w-[240px] flex-[2] flex-col gap-1.5 text-xs text-muted-foreground">
                Título que se ve en el perfil
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    medal ? medal.titulo : "Elegí una medalla primero"
                  }
                  disabled={!medal}
                  maxLength={80}
                />
              </label>
            </div>
          </section>

          <PlayerPicker
            picked={picked}
            setPicked={setPicked}
            season={seasonObj}
          />
        </>
      }
      aside={
        <>
          <div className="flex items-center gap-4">
            {medal ? (
              <MedalImage
                medal={medal}
                season={label}
                className="h-28 w-auto"
              />
            ) : (
              <span className="grid h-28 w-24 place-items-center rounded-xl border border-dashed text-xs text-muted-foreground">
                Sin medalla
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-base font-semibold">
                {medal ? title || medal.titulo : "Elegí una medalla"}
              </span>
              <Badge variant="soft" className="w-fit">
                {seasonObj?.name ?? "Sin temporada"}
              </Badge>
            </div>
          </div>
          <PanelSection title={`Se la das a ${picked.length}`}>
            {picked.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                Todavía no elegiste jugadores.
              </span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {picked.map((p) => (
                  <Badge key={p.id} variant="soft" className="gap-1 pr-1">
                    {p.alias}
                    <button
                      type="button"
                      aria-label={`Quitar a ${p.alias}`}
                      onClick={() =>
                        setPicked((x) => x.filter((y) => y.id !== p.id))
                      }
                      className="rounded-full p-0.5 hover:bg-background/60"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              Los que ya la tienen en esa temporada se saltean.
            </span>
          </PanelSection>
          <Button
            disabled={!medal || picked.length === 0 || grant.isPending}
            onClick={give}
          >
            {picked.length === 0
              ? "Dar medalla"
              : `Dar a ${picked.length} ${picked.length === 1 ? "jugador" : "jugadores"}`}
          </Button>
        </>
      }
    />
  )
}

function PlayerPicker({
  picked,
  setPicked,
  season,
}: {
  picked: Pick[]
  setPicked: (f: (p: Pick[]) => Pick[]) => void
  season: Season | null
}) {
  const [q, setQ] = useState("")
  const [paste, setPaste] = useState("")
  const [missing, setMissing] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const results = useQuery(playerSearchOptions(q))
  const has = (id: string) => picked.some((p) => p.id === id)
  const add = (ps: Pick[]) =>
    setPicked((x) => [...x, ...ps.filter((p) => !x.some((y) => y.id === p.id))])
  const toggle = (p: Pick) =>
    setPicked((x) =>
      x.some((y) => y.id === p.id) ? x.filter((y) => y.id !== p.id) : [...x, p]
    )

  async function run(task: () => Promise<void>) {
    setBusy(true)
    try {
      await task()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">3. A quiénes</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!season || busy}
            onClick={() =>
              void run(async () => add(await seasonTop10(season!.id)))
            }
          >
            Top 10 de {season?.name ?? "la temporada"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={picked.length === 0}
            onClick={() => setPicked(() => [])}
          >
            Limpiar
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por alias"
            aria-label="Buscar jugador"
          />
          <div className="flex max-h-[260px] min-h-[120px] flex-col overflow-y-auto rounded-lg border">
            {!q.trim() ? (
              <span className="p-4 text-center text-sm text-muted-foreground">
                Escribí un alias.
              </span>
            ) : (
              (results.data ?? []).map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={has(p.id)}
                    onCheckedChange={() =>
                      toggle({
                        id: p.id,
                        alias: p.alias,
                        photo_url: p.photo_url,
                      })
                    }
                  />
                  <PlayerAvatar
                    alias={p.alias}
                    photo={p.photo_url}
                    size="row"
                  />
                  <span className="flex-1 text-sm font-medium">{p.alias}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {p.elo ?? "—"}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={"Pegá una lista: un alias por línea"}
            aria-label="Lista de jugadores"
            className="min-h-[200px] font-mono text-xs"
          />
          <Button
            variant="secondary"
            disabled={!paste.trim() || busy}
            onClick={() =>
              void run(async () => {
                const lines = paste
                  .split(/[\n,;]+/)
                  .map((l) => l.trim())
                  .filter(Boolean)
                const r = await findByAlias(lines)
                add(r.found)
                setMissing(r.missing)
                setPaste(r.missing.join("\n"))
              })
            }
          >
            Agregar la lista
          </Button>
          {missing.length > 0 && (
            <span className="text-xs text-destructive">
              No encontré: {missing.join(", ")}. Quedaron en el cuadro para
              corregirlos.
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

// ---------- Otorgadas ----------

function Granted({ seasons }: { seasons: Season[] }) {
  const catalog = useMedalsByKey()
  const [f, setF] = useState<GrantedFilter>({})
  const [page, setPage] = useState(1)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<string[] | null>(null)
  const list = useQuery(grantedOptions(f, page))
  const patch = usePatchMedal()
  const remove = useRemoveMedals()
  const filter = (p: Partial<GrantedFilter>) => {
    setF((x) => ({ ...x, ...p }))
    setPage(1)
    setSel(new Set())
  }
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const move = (ids: string[], season: string | null) =>
    Promise.all(
      ids.map((id) => patch.mutateAsync({ id, body: { season_id: season } }))
    )
      .then(() =>
        toast.success(
          ids.length === 1
            ? "Temporada cambiada."
            : `Cambiaste ${ids.length} medallas.`
        )
      )
      .catch((e) => toast.error(errorMessage(e)))

  const columns = useMemo<DataColumn<AdminMedal>[]>(
    () => [
      {
        id: "sel",
        header: "",
        headClassName: "w-10 pl-4",
        cellClassName: "pl-4",
        cell: ({ row: { original: m } }) => (
          <Checkbox
            aria-label={`Elegir ${m.title}`}
            checked={sel.has(m.id)}
            onCheckedChange={() => toggle(m.id)}
          />
        ),
      },
      {
        id: "medal",
        header: "Medalla",
        cell: ({ row: { original: m } }) => {
          const def = m.medal_key ? catalog.get(m.medal_key) : undefined
          return (
            <div className="flex items-center gap-2.5">
              {def ? (
                <MedalImage
                  medal={def}
                  season={seasonShort(m.season)}
                  className="h-9 w-auto"
                />
              ) : (
                <span className="grid size-9 place-items-center text-lg">
                  {m.icon ?? "🏅"}
                </span>
              )}
              <span className="font-medium">{m.title}</span>
            </div>
          )
        },
      },
      {
        id: "player",
        header: "Jugador",
        cell: ({ row: { original: m } }) => (
          <div className="flex items-center gap-2">
            <PlayerAvatar
              alias={m.player.nick}
              photo={m.player.photo_url}
              size="row"
            />
            {m.player.nick}
          </div>
        ),
      },
      {
        id: "season",
        header: "Temporada",
        cell: ({ row: { original: m } }) =>
          m.source === "admin" ? (
            <Select
              value={m.season?.id ?? NONE}
              onValueChange={(v) => void move([m.id], v === NONE ? null : v)}
            >
              <SelectTrigger
                size="sm"
                className="w-[170px]"
                aria-label="Temporada"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
                <SelectItem value={NONE}>Sin temporada</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground">
              {m.season?.name ?? "—"}
            </span>
          ),
      },
      {
        id: "source",
        header: "Origen",
        cell: ({ row: { original: m } }) => (
          <Badge variant="muted">{SOURCE_LABEL[m.source]}</Badge>
        ),
      },
      {
        id: "at",
        header: "Fecha",
        cellClassName: "font-mono text-xs text-muted-foreground",
        cell: ({ row: { original: m } }) => m.created_at.slice(0, 10),
      },
      {
        id: "actions",
        header: "",
        cellClassName: "pr-4 text-right",
        cell: ({ row: { original: m } }) => (
          <Button size="sm" variant="ghost" onClick={() => setConfirm([m.id])}>
            Quitar
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- move y toggle no cambian lo que se dibuja
    [catalog, seasons, sel]
  )
  const table = useServerTable({
    columns,
    data: list.data?.items,
    total: list.data?.total,
    page,
    per: GRANTED_PER,
    onPage: setPage,
    getRowId: (m) => m.id,
  })
  const selectedAdmin = (list.data?.items ?? []).filter(
    (m) => sel.has(m.id) && m.source === "admin"
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="max-w-[280px] min-w-[200px] flex-1">
          <InputGroupAddon>
            <SearchIcon aria-hidden className="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={f.q ?? ""}
            onChange={(e) => filter({ q: e.target.value || undefined })}
            placeholder="Buscar jugador"
            aria-label="Buscar jugador"
            className="text-[13px]"
          />
        </InputGroup>
        <Select
          value={f.season ?? "all"}
          onValueChange={(v) => filter({ season: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-[200px]" aria-label="Temporada">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las temporadas</SelectItem>
            {seasons.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
            <SelectItem value={NONE}>Sin temporada</SelectItem>
          </SelectContent>
        </Select>
        <FilterChips
          label="Origen"
          size="sm"
          value={f.source}
          onChange={(v) => filter({ source: v })}
          options={[
            { value: undefined, label: "Todas" },
            { value: "admin", label: "A mano" },
            { value: "auto", label: "Automáticas" },
            { value: "temporada", label: "Temporada" },
          ]}
        />
      </div>

      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{sel.size} elegidas</span>
          <Select
            disabled={selectedAdmin.length === 0}
            onValueChange={(v) =>
              void move(
                selectedAdmin.map((m) => m.id),
                v === NONE ? null : v
              )
            }
          >
            <SelectTrigger
              size="sm"
              className="w-[220px]"
              aria-label="Pasar a temporada"
            >
              <SelectValue placeholder="Pasar a temporada (a mano)…" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
              <SelectItem value={NONE}>Sin temporada</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setConfirm([...sel])}
          >
            Quitar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>
            Cancelar
          </Button>
        </div>
      )}

      <AdminTable
        table={table}
        query={list}
        className="min-w-[860px]"
        empty="No hay medallas con estos filtros."
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm && confirm.length > 1
            ? `¿Quitar ${confirm.length} medallas?`
            : "¿Quitar la medalla?"
        }
        description="Una automática vuelve a darse en el próximo mix del jugador si sigue cumpliendo la regla. Para que no vuelva, desactivá la regla en Automáticas."
        confirmLabel="Quitar"
        danger
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          remove.mutate(confirm ?? [], {
            onSuccess: (r) => {
              toast.success(
                r.deleted === 1
                  ? "Quitaste la medalla."
                  : `Quitaste ${r.deleted} medallas.`
              )
              setConfirm(null)
              setSel(new Set())
            },
          })
        }
      />
    </div>
  )
}

// ---------- Automáticas ----------

function Rules() {
  const rules = useQuery(rulesOptions)
  const catalog = useMedalsByKey()
  const patch = usePatchRule()
  const recalc = useRecalculate()
  const save = (
    r: MedalRule,
    body: Parameters<typeof patch.mutate>[0]["body"]
  ) =>
    patch.mutate(
      { key: r.medal_key, body },
      { onError: (e) => toast.error(errorMessage(e)) }
    )

  if (rules.isError)
    return (
      <QueryError error={rules.error} onRetry={() => void rules.refetch()} />
    )
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <p className="max-w-[640px] text-sm text-muted-foreground">
          Se dan solas al terminar cada mix. Si cambiás un umbral o activás una
          regla, las nuevas llegan en el próximo mix de cada jugador; para
          darlas ya a todos, usá el botón. Nunca se quitan solas. KDA, % de HS y
          ADR piden un mínimo de mixes.
        </p>
        <Button
          variant="secondary"
          disabled={recalc.isPending}
          onClick={() =>
            recalc.mutate(undefined, {
              onSuccess: (r) =>
                toast.success(
                  r.given === 0
                    ? "No faltaba ninguna."
                    : `Se dieron ${r.given} medallas.`
                ),
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        >
          Dar las que falten a todos
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Medalla</TableHead>
              <TableHead>Métrica</TableHead>
              <TableHead>Umbral</TableHead>
              <TableHead>Mínimo de mixes</TableHead>
              <TableHead className="pr-4">Activa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rules.data ?? []).map((r) => {
              const def = catalog.get(r.medal_key)
              return (
                <TableRow key={r.medal_key}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2.5">
                      {def && <MedalImage medal={def} className="h-9 w-auto" />}
                      <span className="font-medium">{r.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.metric}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      defaultValue={r.threshold}
                      min={0}
                      step="any"
                      aria-label={`Umbral de ${r.title}`}
                      className="h-8 w-28"
                      onBlur={(e) => {
                        const v = Number(e.target.value)
                        if (v > 0 && v !== r.threshold)
                          save(r, { threshold: v })
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      defaultValue={r.min_matches}
                      min={0}
                      aria-label={`Mínimo de mixes de ${r.title}`}
                      className="h-8 w-24"
                      onBlur={(e) => {
                        const v = Number(e.target.value)
                        if (
                          Number.isInteger(v) &&
                          v >= 0 &&
                          v !== r.min_matches
                        )
                          save(r, { min_matches: v })
                      }}
                    />
                  </TableCell>
                  <TableCell className="pr-4">
                    <Switch
                      checked={r.active}
                      aria-label={`${r.title} activa`}
                      onCheckedChange={(active) => save(r, { active })}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
