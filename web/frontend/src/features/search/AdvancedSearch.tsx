import { cn } from "cn"
import {
  BookmarkIcon,
  CrownIcon,
  FilmIcon,
  LockIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import { CountryFlag } from "@/components/brand/CountryFlag"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SearchBox } from "@/features/ranking/SearchBox"

import {
  DEMO_COUNTRIES,
  DEMO_MAPS,
  MATCHES,
  PLAYERS,
  type SearchMatch,
} from "./demo"
import {
  activeChips,
  filterMatches,
  filterPlayers,
  KIND_LABEL,
  MATCH_ADVANCED,
  MATCH_SORTS,
  PER,
  PLAYER_ADVANCED,
  PLAYER_SORTS,
  type Search,
} from "./filters"

// Buscador con filtros avanzados para VIP (docs/bitacora/2026-10-29-buscador-avanzado en
// kyan/pruebas). Filtra en memoria; en la versión real los mismos parámetros van a la API.

type Patch = Partial<Search>
type Tab = "jugadores" | "partidas"
const ANY = "__any"
const MAX_SAVED = 5
const SAVED_KEY = "demo-buscador-guardadas"

interface Saved {
  name: string
  search: Search
}

function loadSaved(): Saved[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]") as Saved[]
  } catch {
    return []
  }
}
function storeSaved(list: Saved[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list))
  } catch {
    // Sin almacenamiento (ventana privada): las búsquedas duran lo que dura la página.
  }
}

function FilterField({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between text-xs">
        <span className="font-semibold tracking-[0.4px] text-muted-foreground uppercase">
          {label}
        </span>
        {value && <span className="font-mono text-foreground">{value}</span>}
      </span>
      {children}
    </div>
  )
}

/** Slider que muestra el valor mientras se arrastra y escribe en la URL al soltar. */
function SliderField({
  label,
  min,
  max,
  step,
  value,
  format,
  onCommit,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number[]
  format: (v: number[]) => string
  onCommit: (v: number[]) => void
}) {
  const [local, setLocal] = useState(value)
  // Si la URL cambia por otro lado (chip, limpiar, búsqueda guardada), se toma el valor nuevo.
  const [urlKey, setUrlKey] = useState(value.join())
  if (value.join() !== urlKey) {
    setUrlKey(value.join())
    setLocal(value)
  }
  return (
    <FilterField label={label} value={format(local)}>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={local}
        onValueChange={setLocal}
        onValueCommit={onCommit}
      />
    </FilterField>
  )
}

function SelectField<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: V | undefined
  options: Record<V, string>
  onChange: (v: V | undefined) => void
}) {
  return (
    <FilterField label={label}>
      <Select
        value={value ?? ANY}
        onValueChange={(v) => onChange(v === ANY ? undefined : (v as V))}
      >
        <SelectTrigger
          size="sm"
          aria-label={label}
          className="h-8 w-full text-[13px]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Cualquiera</SelectItem>
          {(Object.keys(options) as V[]).map((k) => (
            <SelectItem key={k} value={k}>
              {options[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  )
}

function SwitchField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <span className="flex items-center gap-2 self-end pb-1">
      <Switch id={id} size="sm" checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
    </span>
  )
}

/** Campo de texto que escribe en la URL al salir o con Enter. */
function TextField({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string
  value?: string
  placeholder: string
  onCommit: (v: string | undefined) => void
}) {
  const [local, setLocal] = useState(value ?? "")
  const [urlValue, setUrlValue] = useState(value)
  if (value !== urlValue) {
    setUrlValue(value)
    setLocal(value ?? "")
  }
  const commit = () => onCommit(local.trim() || undefined)
  return (
    <FilterField label={label}>
      <Input
        aria-label={label}
        value={local}
        placeholder={placeholder}
        className="h-8 text-[13px]"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    </FilterField>
  )
}

const options = (xs: readonly string[]): Record<string, string> =>
  Object.fromEntries(xs.map((x) => [x, x]))

function PlayerFilters({ s, set }: { s: Search; set: (p: Patch) => void }) {
  return (
    <>
      <SliderField
        label="Nivel"
        min={1}
        max={10}
        step={1}
        value={[s.lvMin ?? 1, s.lvMax ?? 10]}
        format={([a, b]) => `${a}–${b}`}
        onCommit={([a, b]) =>
          set({
            lvMin: a === 1 ? undefined : a,
            lvMax: b === 10 ? undefined : b,
          })
        }
      />
      <SliderField
        label="ELO"
        min={0}
        max={2500}
        step={50}
        value={[s.eloMin ?? 0, s.eloMax ?? 2500]}
        format={([a, b]) => `${a}–${b}`}
        onCommit={([a, b]) =>
          set({ eloMin: a || undefined, eloMax: b === 2500 ? undefined : b })
        }
      />
      <SliderField
        label="K/D mínimo"
        min={0}
        max={2}
        step={0.05}
        value={[s.kd ?? 0]}
        format={([v]) => v!.toFixed(2)}
        onCommit={([v]) => set({ kd: v || undefined })}
      />
      <SliderField
        label="Rating mínimo"
        min={0}
        max={2}
        step={0.05}
        value={[s.rt ?? 0]}
        format={([v]) => v!.toFixed(2)}
        onCommit={([v]) => set({ rt: v || undefined })}
      />
      <SliderField
        label="HS % mínimo"
        min={0}
        max={75}
        step={1}
        value={[s.hs ?? 0]}
        format={([v]) => `${v}%`}
        onCommit={([v]) => set({ hs: v || undefined })}
      />
      <SliderField
        label="Mixes jugados"
        min={0}
        max={200}
        step={5}
        value={[s.mx ?? 0]}
        format={([v]) => `≥ ${v}`}
        onCommit={([v]) => set({ mx: v || undefined })}
      />
      <SelectField
        label="Activo en los últimos"
        value={s.act ? (String(s.act) as "7" | "30" | "90") : undefined}
        options={{ "7": "7 días", "30": "30 días", "90": "90 días" }}
        onChange={(v) =>
          set({ act: v ? (Number(v) as 7 | 30 | 90) : undefined })
        }
      />
      <SelectField
        label="Mapa favorito"
        value={s.fav}
        options={options(DEMO_MAPS)}
        onChange={(v) => set({ fav: v })}
      />
      <SelectField
        label="País"
        value={s.ct}
        options={options(DEMO_COUNTRIES)}
        onChange={(v) => set({ ct: v })}
      />
      <SelectField
        label="Equipo"
        value={s.team}
        options={{ with: "Con equipo", without: "Sin equipo" }}
        onChange={(v) => set({ team: v })}
      />
      <SwitchField
        id="f-vip"
        label="Solo VIP"
        checked={!!s.vip}
        onChange={(v) => set({ vip: v || undefined })}
      />
    </>
  )
}

function MatchFilters({ s, set }: { s: Search; set: (p: Patch) => void }) {
  return (
    <>
      <TextField
        label="Con el jugador"
        value={s.with}
        placeholder="Nick"
        onCommit={(v) => set({ with: v })}
      />
      <TextField
        label="Contra el jugador"
        value={s.vs}
        placeholder="Nick (en el otro bando)"
        onCommit={(v) => set({ vs: v })}
      />
      <SelectField
        label="Mapa"
        value={s.map}
        options={options(DEMO_MAPS)}
        onChange={(v) => set({ map: v })}
      />
      <SelectField
        label="Tipo"
        value={s.kind}
        options={KIND_LABEL}
        onChange={(v) => set({ kind: v })}
      />
      <FilterField label="Desde">
        <Input
          type="date"
          aria-label="Desde"
          value={s.from ?? ""}
          className="h-8 text-[13px]"
          onChange={(e) => set({ from: e.target.value || undefined })}
        />
      </FilterField>
      <FilterField label="Hasta">
        <Input
          type="date"
          aria-label="Hasta"
          value={s.to ?? ""}
          className="h-8 text-[13px]"
          onChange={(e) => set({ to: e.target.value || undefined })}
        />
      </FilterField>
      <SliderField
        label="Diferencia de rondas"
        min={0}
        max={16}
        step={1}
        value={[s.diff ?? 16]}
        format={([v]) => (v === 16 ? "cualquiera" : `≤ ${v}`)}
        onCommit={([v]) => set({ diff: v === 16 ? undefined : v })}
      />
      <SwitchField
        id="f-demo"
        label="Solo con demo"
        checked={!!s.demo}
        onChange={(v) => set({ demo: v || undefined })}
      />
      <SwitchField
        id="f-cancel"
        label="Incluir canceladas"
        checked={!!s.cancel}
        onChange={(v) => set({ cancel: v || undefined })}
      />
    </>
  )
}

const lastPlayed = (d: number) =>
  d === 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`
const head =
  "h-9 text-[11px] font-semibold tracking-[0.4px] text-muted-foreground uppercase"

function PlayersTable({ rows }: { rows: typeof PLAYERS }) {
  return (
    <Table className="min-w-[860px] text-sm">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(head, "pl-4")}>Jugador</TableHead>
          <TableHead className={head}>País</TableHead>
          <TableHead className={cn(head, "text-right")}>ELO</TableHead>
          <TableHead className={cn(head, "text-right")}>K/D</TableHead>
          <TableHead className={cn(head, "text-right")}>Rating</TableHead>
          <TableHead className={cn(head, "text-right")}>HS %</TableHead>
          <TableHead className={cn(head, "text-right")}>Mixes</TableHead>
          <TableHead className={head}>Mapa favorito</TableHead>
          <TableHead className={cn(head, "pr-4")}>Última partida</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="pl-4">
              <span className="flex items-center gap-2.5">
                <LevelBadge level={p.level} size={24} />
                {p.team_tag && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {p.team_tag}
                  </span>
                )}
                <span className="font-medium">{p.nick}</span>
                {p.vip && (
                  <CrownIcon
                    aria-label="VIP"
                    className="size-3.5 text-amber-400"
                  />
                )}
              </span>
            </TableCell>
            <TableCell>
              <CountryFlag country={p.country} />
            </TableCell>
            <TableCell className="text-right font-mono font-semibold">
              {p.elo}
            </TableCell>
            <TableCell
              className={cn(
                "text-right font-mono",
                p.kd >= 1 ? "text-win" : "text-primary"
              )}
            >
              {p.kd.toFixed(2)}
            </TableCell>
            <TableCell className="text-right font-mono">
              {p.rating.toFixed(2)}
            </TableCell>
            <TableCell className="text-right font-mono">
              {p.hs.toFixed(1)}
            </TableCell>
            <TableCell className="text-right font-mono">{p.matches}</TableCell>
            <TableCell className="text-muted-foreground">{p.fav_map}</TableCell>
            <TableCell className="pr-4 text-muted-foreground">
              {lastPlayed(p.last_days)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function Lineup({
  nicks,
  mark,
}: {
  nicks: string[]
  mark: (n: string) => boolean
}) {
  const shown = nicks
    .filter(mark)
    .concat(nicks.filter((n) => !mark(n)))
    .slice(0, 2)
  return (
    <span className="truncate">
      {shown.map((n, i) => (
        <span key={n} className={cn(mark(n) && "font-semibold text-primary")}>
          {i > 0 && ", "}
          {n}
        </span>
      ))}
      <span className="text-muted-foreground">
        {" "}
        +{nicks.length - shown.length}
      </span>
    </span>
  )
}

function MatchesTable({ rows, s }: { rows: SearchMatch[]; s: Search }) {
  const terms = [s.with, s.vs, s.q].filter(Boolean).map((t) => t!.toLowerCase())
  const mark = (n: string) => terms.some((t) => n.toLowerCase().includes(t))
  return (
    <Table className="min-w-[860px] text-sm">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(head, "pl-4")}>Fecha</TableHead>
          <TableHead className={head}>Mapa</TableHead>
          <TableHead className={head}>Tipo</TableHead>
          <TableHead className={cn(head, "text-center")}>Resultado</TableHead>
          <TableHead className={head}>Bando A</TableHead>
          <TableHead className={head}>Bando B</TableHead>
          <TableHead className={head}>MVP</TableHead>
          <TableHead className={cn(head, "pr-4 text-center")}>Demo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((m) => (
          <TableRow key={m.id} className={cn(m.cancelled && "opacity-50")}>
            <TableCell className="pl-4 font-mono text-xs">{m.date}</TableCell>
            <TableCell>{m.map}</TableCell>
            <TableCell className="text-muted-foreground">
              {m.cancelled ? "Cancelada" : KIND_LABEL[m.kind]}
            </TableCell>
            <TableCell className="text-center font-mono font-semibold">
              {m.score[0]}–{m.score[1]}
            </TableCell>
            <TableCell className="max-w-44">
              <Lineup nicks={m.team_a} mark={mark} />
            </TableCell>
            <TableCell className="max-w-44">
              <Lineup nicks={m.team_b} mark={mark} />
            </TableCell>
            <TableCell>
              {m.mvp}{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {m.mvp_rating.toFixed(2)}
              </span>
            </TableCell>
            <TableCell className="pr-4 text-center">
              {m.has_demo ? (
                <FilmIcon aria-label="Tiene demo" className="mx-auto size-4" />
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function AdvancedSearch({
  search,
  onChange,
  vip,
}: {
  search: Search
  onChange: (p: Patch) => void
  vip: boolean
}) {
  const tab: Tab = search.tab ?? "jugadores"
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<Saved[]>(loadSaved)
  const [naming, setNaming] = useState<string | null>(null)

  // Cambiar un filtro vuelve a la primera página.
  const set = (p: Patch) => onChange({ ...p, page: undefined })
  const advanced = tab === "jugadores" ? PLAYER_ADVANCED : MATCH_ADVANCED
  const chips = activeChips(search, tab)
  const ignored = !vip && chips.length > 0

  const results =
    tab === "jugadores"
      ? filterPlayers(PLAYERS, search, vip)
      : filterMatches(MATCHES, search, vip)
  const pages = Math.max(1, Math.ceil(results.length / PER))
  const page = Math.min(search.page ?? 1, pages)
  const slice = results.slice((page - 1) * PER, page * PER)

  const clearAll = () =>
    set(Object.fromEntries(advanced.map((k) => [k, undefined])) as Patch)
  const saveCurrent = () => {
    const name = naming?.trim()
    if (!name) return
    const next = [
      { name, search: { ...search, page: undefined } },
      ...saved.filter((x) => x.name !== name),
    ].slice(0, MAX_SAVED)
    setSaved(next)
    storeSaved(next)
    setNaming(null)
    toast.success(`Búsqueda "${name}" guardada.`)
  }
  const removeSaved = (name: string) => {
    const next = saved.filter((x) => x.name !== name)
    setSaved(next)
    storeSaved(next)
  }
  // Aplica una búsqueda guardada: reemplaza todos los filtros.
  const applySaved = (x: Saved) =>
    onChange({
      ...(Object.fromEntries(
        (Object.keys(search) as (keyof Search)[]).map((k) => [k, undefined])
      ) as Patch),
      ...x.search,
    })

  return (
    <div className="flex flex-col gap-4">
      <span className="inline-flex self-start rounded-lg border p-0.5">
        {(["jugadores", "partidas"] as const).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? "secondary" : "ghost"}
            aria-pressed={tab === t}
            onClick={() =>
              onChange({
                tab: t === "jugadores" ? undefined : t,
                page: undefined,
              })
            }
          >
            {t === "jugadores" ? "Jugadores" : "Partidas"}
          </Button>
        ))}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox
          value={search.q}
          placeholder={
            tab === "jugadores"
              ? "Nick o tag del equipo"
              : "Mapa o nick de un jugador"
          }
          label={tab === "jugadores" ? "Buscar jugadores" : "Buscar partidas"}
          onChange={(q) => set({ q })}
        />
        {tab === "jugadores" ? (
          <Select
            value={search.psort ?? "elo"}
            onValueChange={(v) =>
              set({ psort: v === "elo" ? undefined : (v as Search["psort"]) })
            }
          >
            <SelectTrigger
              size="sm"
              aria-label="Ordenar por"
              className="h-8 text-[13px]"
            >
              <span className="text-muted-foreground">Orden:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PLAYER_SORTS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={search.msort ?? "date"}
            onValueChange={(v) =>
              set({ msort: v === "date" ? undefined : (v as Search["msort"]) })
            }
          >
            <SelectTrigger
              size="sm"
              aria-label="Ordenar por"
              className="h-8 text-[13px]"
            >
              <span className="text-muted-foreground">Orden:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MATCH_SORTS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          size="sm"
          variant={open ? "secondary" : "outline"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {vip ? (
            <SlidersHorizontalIcon aria-hidden />
          ) : (
            <LockIcon aria-hidden />
          )}
          Filtros avanzados
          {vip && chips.length > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
              {chips.length}
            </span>
          )}
        </Button>
        {vip &&
          (naming === null ? (
            <Button size="sm" variant="ghost" onClick={() => setNaming("")}>
              <BookmarkIcon aria-hidden />
              Guardar búsqueda
            </Button>
          ) : (
            <span className="flex items-center gap-1">
              <Input
                autoFocus
                aria-label="Nombre de la búsqueda"
                placeholder="Nombre"
                value={naming}
                maxLength={30}
                className="h-8 w-40 text-[13px]"
                onChange={(e) => setNaming(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCurrent()
                  if (e.key === "Escape") setNaming(null)
                }}
              />
              <Button size="sm" onClick={saveCurrent}>
                Guardar
              </Button>
            </span>
          ))}
      </div>

      {vip && saved.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Guardadas:</span>
          {saved.map((x) => (
            <span
              key={x.name}
              className="inline-flex items-center rounded-full border"
            >
              <button
                type="button"
                className="py-1 pr-1 pl-2.5 hover:text-primary"
                onClick={() => applySaved(x)}
              >
                {x.name}
              </button>
              <button
                type="button"
                aria-label={`Borrar ${x.name}`}
                className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                onClick={() => removeSaved(x.name)}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="relative rounded-xl border p-4">
          <fieldset
            disabled={!vip}
            className={cn(
              "grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4",
              !vip && "pointer-events-none opacity-40 blur-[1px]"
            )}
          >
            {tab === "jugadores" ? (
              <PlayerFilters s={search} set={set} />
            ) : (
              <MatchFilters s={search} set={set} />
            )}
          </fieldset>
          {!vip && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="flex max-w-sm flex-col items-center gap-2 rounded-xl border bg-background/95 p-5 text-center shadow-lg">
                <CrownIcon aria-hidden className="size-6 text-amber-400" />
                <p className="font-semibold">
                  Los filtros avanzados son para VIP
                </p>
                <p className="text-sm text-muted-foreground">
                  Buscá por nivel, ELO, K/D, mapa, país, con quién jugaste y
                  mucho más. Buscar por texto y ordenar sigue siendo gratis.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {chips.map((c) => (
            <span
              key={c.label}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border bg-muted/50 py-1 pr-1 pl-2.5",
                ignored && "line-through opacity-60"
              )}
            >
              {c.label}
              <button
                type="button"
                aria-label={`Sacar ${c.label}`}
                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  set(
                    Object.fromEntries(
                      c.clear.map((k) => [k, undefined])
                    ) as Patch
                  )
                }
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
          <Button
            size="sm"
            variant="link"
            className="h-auto px-1 text-xs"
            onClick={clearAll}
          >
            Limpiar filtros
          </Button>
          {ignored && (
            <span className="text-muted-foreground">
              No se aplican sin VIP.
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
          <span>
            {results.length} {tab === "jugadores" ? "jugadores" : "partidas"}
          </span>
          <span className="flex items-center gap-2">
            Página {page} de {pages}
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              disabled={page <= 1}
              onClick={() =>
                onChange({ page: page - 1 === 1 ? undefined : page - 1 })
              }
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              disabled={page >= pages}
              onClick={() => onChange({ page: page + 1 })}
            >
              Siguiente
            </Button>
          </span>
        </div>
        {slice.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nada coincide con esos filtros.
          </p>
        ) : tab === "jugadores" ? (
          <PlayersTable rows={slice as typeof PLAYERS} />
        ) : (
          <MatchesTable
            rows={slice as SearchMatch[]}
            s={vip ? search : { q: search.q }}
          />
        )}
      </div>
    </div>
  )
}
