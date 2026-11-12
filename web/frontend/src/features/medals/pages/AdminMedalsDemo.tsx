import { SearchIcon, XIcon } from "lucide-react"
import { cn } from "cn"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { FilterChips } from "@/components/brand/FilterChips"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
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
  AdminHeader,
  AdminTabs,
  EmptyState,
  PanelSection,
  SplitLayout,
} from "@/features/admin/components/ui"
import { MedalImage } from "@/components/brand/MedalImage"
import { useMedalCatalog, type MedalDef } from "@/lib/medals"
import {
  GRANTS,
  matchPasted,
  PLAYERS,
  SEASONS,
  type DemoGrant,
  type DemoPlayer,
} from "../lib/demo"

// Demo de Administración › Medallas: elegir medalla, temporada y jugadores, y darla a todos de una.
// Todo en memoria: la versión real necesita cambios en la API y la base (bitácora 2026-11-03-medallas-en-la-web).

type Tab = "give" | "granted"
const NONE = "none"
const seasonLabel = (id: string | null) =>
  SEASONS.find((s) => s.id === id)?.label ?? "Sin temporada"
// Lo que muestra la etiqueta de una medalla de temporada; sin temporada, el nombre de la liga.
const seasonShort = (id: string | null) =>
  SEASONS.find((s) => s.id === id)?.short ?? "CM LEAGUE"
const today = () => new Date().toLocaleDateString("sv-SE") // AAAA-MM-DD en la hora local

export function AdminMedalsDemo() {
  const catalog = useMedalCatalog()
  const byKey = useMemo(
    () => new Map(catalog.map((m) => [m.clave, m])),
    [catalog]
  )
  const [tab, setTab] = useState<Tab>("give")
  const [grants, setGrants] = useState<DemoGrant[]>(GRANTS)

  return (
    <div className="flex flex-col gap-5">
      <AdminHeader
        title="Medallas"
        subtitle="Elegí la medalla, la temporada y a quiénes se la das. Se la das a todos de una vez y después la podés cambiar o quitar."
      />
      <AdminTabs
        label="Secciones de Medallas"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "give", label: "Dar medallas" },
          { key: "granted", label: "Otorgadas", badge: grants.length },
        ]}
      />
      {tab === "give" ? (
        <GiveMedals
          catalog={catalog}
          grants={grants}
          onGive={(nuevas) => {
            setGrants((g) => [...nuevas, ...g])
            toast.success(
              `Diste "${nuevas[0]!.title}" a ${nuevas.length} ${nuevas.length === 1 ? "jugador" : "jugadores"}.`,
              {
                action: {
                  label: "Deshacer",
                  onClick: () =>
                    setGrants((g) => g.filter((x) => !nuevas.includes(x))),
                },
              }
            )
          }}
        />
      ) : (
        <Granted grants={grants} setGrants={setGrants} byKey={byKey} />
      )}
    </div>
  )
}

// ---------- Dar medallas ----------

function GiveMedals({
  catalog,
  grants,
  onGive,
}: {
  catalog: MedalDef[]
  grants: DemoGrant[]
  onGive: (g: DemoGrant[]) => void
}) {
  const [q, setQ] = useState("")
  const [cat, setCat] = useState<string>("all")
  const [kind, setKind] = useState<"player" | "team">("player")
  const [medal, setMedal] = useState<MedalDef | null>(null)
  const [title, setTitle] = useState("")
  const [season, setSeason] = useState<string>(SEASONS[0]!.id)
  const [picked, setPicked] = useState<DemoPlayer[]>([])

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
        (cat === "all" || m.categoria === cat) &&
        (!t || m.titulo.toLowerCase().includes(t) || m.clave.includes(t))
    )
  }, [catalog, q, cat, kind])

  const seasonId = season === NONE ? null : season
  const already = picked.filter((p) =>
    grants.some(
      (g) =>
        g.medal === medal?.clave && g.player === p.id && g.season === seasonId
    )
  )
  const toGive = picked.filter((p) => !already.includes(p))

  function choose(m: MedalDef) {
    setMedal(m)
    setTitle(m.titulo)
  }

  function give() {
    if (!medal || toGive.length === 0) return
    onGive(
      toGive.map((p, i) => ({
        id: `n${Date.now()}-${i}`,
        medal: medal.clave,
        title: title.trim() || medal.titulo,
        player: p.id,
        season: seasonId,
        at: today(),
      }))
    )
    setPicked([])
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
            </div>
            <div className="grid max-h-[360px] grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 overflow-y-auto pr-1">
              {list.map((m) => (
                <button
                  key={m.clave}
                  type="button"
                  onClick={() => choose(m)}
                  aria-pressed={medal?.clave === m.clave}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border border-transparent p-2 text-center hover:bg-muted",
                    medal?.clave === m.clave && "border-primary bg-primary/10"
                  )}
                >
                  <MedalImage
                    medal={m}
                    season={seasonShort(seasonId)}
                    className="h-16 w-auto"
                  />
                  <span className="line-clamp-2 text-[11px] leading-tight">
                    {m.titulo}
                  </span>
                </button>
              ))}
              {list.length === 0 && (
                <span className="col-span-full py-6 text-center text-sm text-muted-foreground">
                  No hay medallas con esa búsqueda.
                </span>
              )}
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
                    {SEASONS.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
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
            seasonId={seasonId}
          />
        </>
      }
      aside={
        <>
          <div className="flex items-center gap-4">
            {medal ? (
              <MedalImage
                medal={medal}
                season={seasonShort(seasonId)}
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
                {seasonLabel(seasonId)}
              </Badge>
              {medal && (
                <span className="text-xs text-muted-foreground">
                  {medal.categoria}
                </span>
              )}
            </div>
          </div>

          <PanelSection title={`Se la das a ${toGive.length}`}>
            {picked.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                Todavía no elegiste jugadores.
              </span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {picked.map((p) => (
                  <Badge
                    key={p.id}
                    variant={already.includes(p) ? "muted" : "soft"}
                    className="gap-1 pr-1"
                    title={
                      already.includes(p)
                        ? "Ya la tiene en esta temporada"
                        : undefined
                    }
                  >
                    {p.alias}
                    <button
                      type="button"
                      aria-label={`Quitar a ${p.alias}`}
                      onClick={() => setPicked((x) => x.filter((y) => y !== p))}
                      className="rounded-full p-0.5 hover:bg-background/60"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {already.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {already.length === 1
                  ? `${already[0]!.alias} ya la tiene en esta temporada: se saltea.`
                  : `${already.length} ya la tienen en esta temporada: se saltean.`}
              </span>
            )}
          </PanelSection>

          <PanelSection title="Así se ve en Logros">
            {medal ? (
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid size-9 place-items-center rounded-lg bg-primary/12"
                >
                  <MedalImage
                    medal={medal}
                    season={seasonShort(seasonId)}
                    className="h-8 w-auto"
                  />
                </span>
                <span className="flex-1 text-sm font-medium">
                  {title || medal.titulo}
                </span>
                {seasonId && (
                  <Badge variant="muted">
                    {SEASONS.find((s) => s.id === seasonId)?.label}
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                Elegí una medalla para ver cómo queda.
              </span>
            )}
          </PanelSection>

          <Button disabled={!medal || toGive.length === 0} onClick={give}>
            {toGive.length === 0
              ? "Dar medalla"
              : `Dar a ${toGive.length} ${toGive.length === 1 ? "jugador" : "jugadores"}`}
          </Button>
        </>
      }
    />
  )
}

function PlayerPicker({
  picked,
  setPicked,
  seasonId,
}: {
  picked: DemoPlayer[]
  setPicked: (f: (p: DemoPlayer[]) => DemoPlayer[]) => void
  seasonId: string | null
}) {
  const [q, setQ] = useState("")
  const [paste, setPaste] = useState("")
  const [missing, setMissing] = useState<string[]>([])
  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    return PLAYERS.filter(
      (p) => !t || p.alias.includes(t) || p.steam.toLowerCase().includes(t)
    )
  }, [q])
  const add = (ps: DemoPlayer[]) =>
    setPicked((x) => [...x, ...ps.filter((p) => !x.includes(p))])
  const toggle = (p: DemoPlayer) =>
    setPicked((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]))

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">3. A quiénes</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              add([...PLAYERS].sort((a, b) => b.elo - a.elo).slice(0, 10))
            }
          >
            Top 10 de {seasonId ? seasonLabel(seasonId) : "la temporada actual"}
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
            placeholder="Buscar por alias o SteamID"
            aria-label="Buscar jugador"
          />
          <div className="flex max-h-[260px] flex-col overflow-y-auto rounded-lg border">
            {results.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/50"
              >
                <Checkbox
                  checked={picked.includes(p)}
                  onCheckedChange={() => toggle(p)}
                />
                <PlayerAvatar alias={p.alias} size="row" />
                <span className="flex-1 text-sm font-medium">{p.alias}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {p.steam}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={
              "Pegá una lista: un alias o SteamID por línea\npepon\nSTEAM_0:1:4100237"
            }
            aria-label="Lista de jugadores"
            className="min-h-[200px] font-mono text-xs"
          />
          <Button
            variant="secondary"
            disabled={!paste.trim()}
            onClick={() => {
              const r = matchPasted(paste, PLAYERS)
              add(r.found)
              setMissing(r.missing)
              setPaste(r.missing.join("\n"))
            }}
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

function Granted({
  grants,
  setGrants,
  byKey,
}: {
  grants: DemoGrant[]
  setGrants: (f: (g: DemoGrant[]) => DemoGrant[]) => void
  byKey: Map<string, MedalDef>
}) {
  const [q, setQ] = useState("")
  // "all" = todas; NONE = las que no tienen temporada.
  const [season, setSeason] = useState<string>("all")
  const [sel, setSel] = useState<Set<string>>(new Set())
  const playerOf = (id: string) => PLAYERS.find((p) => p.id === id)

  const rows = grants.filter((g) => {
    const t = q.trim().toLowerCase()
    const p = playerOf(g.player)
    return (
      (season === "all" || (g.season ?? NONE) === season) &&
      (!t || g.title.toLowerCase().includes(t) || !!p?.alias.includes(t))
    )
  })
  const allSel = rows.length > 0 && rows.every((r) => sel.has(r.id))

  function remove(ids: string[]) {
    const gone = grants.filter((g) => ids.includes(g.id))
    setGrants((g) => g.filter((x) => !ids.includes(x.id)))
    setSel(new Set())
    toast(
      `Quitaste ${gone.length} ${gone.length === 1 ? "medalla" : "medallas"}.`,
      {
        action: {
          label: "Deshacer",
          onClick: () => setGrants((g) => [...gone, ...g]),
        },
      }
    )
  }
  function moveSeason(ids: string[], s: string | null) {
    setGrants((g) =>
      g.map((x) => (ids.includes(x.id) ? { ...x, season: s } : x))
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="max-w-[320px] min-w-[200px] flex-1">
          <InputGroupAddon>
            <SearchIcon aria-hidden className="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar jugador o medalla"
            aria-label="Buscar en otorgadas"
            className="text-[13px]"
          />
        </InputGroup>
        <FilterChips
          label="Temporada"
          size="sm"
          value={season}
          onChange={setSeason}
          options={[
            { value: "all", label: "Todas" },
            ...SEASONS.map((s) => ({ value: s.id, label: s.label })),
            { value: NONE, label: "Sin temporada" },
          ]}
        />
      </div>

      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{sel.size} elegidas</span>
          <Select
            onValueChange={(v) => moveSeason([...sel], v === NONE ? null : v)}
          >
            <SelectTrigger
              size="sm"
              className="w-[200px]"
              aria-label="Pasar a temporada"
            >
              <SelectValue placeholder="Pasar a temporada…" />
            </SelectTrigger>
            <SelectContent>
              {SEASONS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
              <SelectItem value={NONE}>Sin temporada</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => remove([...sel])}
          >
            Quitar
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState>No hay medallas otorgadas con estos filtros.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    aria-label="Elegir todas"
                    checked={allSel}
                    onCheckedChange={() =>
                      setSel(
                        allSel ? new Set() : new Set(rows.map((r) => r.id))
                      )
                    }
                  />
                </TableHead>
                <TableHead>Medalla</TableHead>
                <TableHead>Jugador</TableHead>
                <TableHead>Temporada</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="pr-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((g) => {
                const m = byKey.get(g.medal)
                const p = playerOf(g.player)
                return (
                  <TableRow key={g.id}>
                    <TableCell className="pl-4">
                      <Checkbox
                        aria-label={`Elegir ${g.title} de ${p?.alias}`}
                        checked={sel.has(g.id)}
                        onCheckedChange={() =>
                          setSel((s) => {
                            const n = new Set(s)
                            if (n.has(g.id)) n.delete(g.id)
                            else n.add(g.id)
                            return n
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {m && (
                          <MedalImage
                            medal={m}
                            season={seasonShort(g.season)}
                            className="h-9 w-auto"
                          />
                        )}
                        <span className="font-medium">{g.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p && <PlayerAvatar alias={p.alias} size="row" />}
                        {p?.alias}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={g.season ?? NONE}
                        onValueChange={(v) =>
                          moveSeason([g.id], v === NONE ? null : v)
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          className="w-[170px]"
                          aria-label="Temporada"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SEASONS.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.label}
                            </SelectItem>
                          ))}
                          <SelectItem value={NONE}>Sin temporada</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {g.at}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove([g.id])}
                      >
                        Quitar
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
