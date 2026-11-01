import { createFileRoute, notFound } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { cn } from "cn"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { Button } from "@/components/ui/button"

// Ejemplo de las medallas de CM League en el frontend, en la versión elegida por Kyan: el mismo diseño de
// siempre con brillo solo en el marco. Sin API: lee los SVG de public/demo-medallas. Solo en `pnpm dev`.
export const Route = createFileRoute("/demo/medallas")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoMedallas,
})

const BASE = "/demo-medallas"

type Medalla = {
  archivo: string
  nombre: string
  titulo: string
  categoria: string
  grupo: "Entregadas" | "Nuevas"
  nivel: string
  equipo: boolean
}

const VIEWS = {
  perfil: "En el perfil",
  todas: "Todas",
  niveles: "Niveles",
} as const

const card = "rounded-xl border bg-card"

function src(m: Medalla, bloqueada = false) {
  const i = m.archivo.lastIndexOf("/")
  const file = (bloqueada ? "bloqueada_" : "") + m.archivo.slice(i + 1)
  return `${BASE}/medallas/${m.archivo.slice(0, i + 1)}${file}`
}

function DemoMedallas() {
  const [view, setView] = useState<keyof typeof VIEWS>("perfil")
  const [medallas, setMedallas] = useState<Medalla[]>([])
  useEffect(() => {
    fetch(`${BASE}/manifiesto.json`)
      .then((r) => r.json())
      .then(setMedallas)
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
        <span className="mr-2 font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
          Demo
        </span>
        <span className="inline-flex flex-wrap rounded-lg border p-0.5">
          {Object.entries(VIEWS).map(([k, v]) => (
            <Button
              key={k}
              size="sm"
              variant={view === k ? "secondary" : "ghost"}
              aria-pressed={view === k}
              onClick={() => setView(k as keyof typeof VIEWS)}
            >
              {v}
            </Button>
          ))}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {medallas.length} medallas · brillo solo en el marco
        </span>
      </div>
      {view === "perfil" && <EnPerfil medallas={medallas} />}
      {view === "todas" && <Todas medallas={medallas} />}
      {view === "niveles" && <Niveles />}
    </div>
  )
}

function buscar(medallas: Medalla[], nombres: string[]) {
  return nombres
    .map((n) => medallas.find((m) => m.nombre === n))
    .filter((m): m is Medalla => !!m)
}

// ---------- En el perfil: la tarjeta "Logros" con el emoji de hoy y con las medallas ----------

const LOGROS = ["kills_5000", "hs_45", "awp_500", "mapa_dust2_50", "clutch_10", "campeon_torneo", "vip_mes_06"]
const VITRINA = ["mvp_temporada", "aces_100", "elo_2000", "prestigio_III", "vip"]

function EnPerfil({ medallas }: { medallas: Medalla[] }) {
  const items = useMemo(() => buscar(medallas, LOGROS), [medallas])
  const vitrina = useMemo(() => buscar(medallas, VITRINA), [medallas])
  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Logros titulo="Hoy (emoji)" items={items} medalla={false} />
        <Logros titulo="Con medallas" items={items} medalla destacado />
      </div>

      <div className={cn(card, "flex flex-col gap-4 p-4")}>
        <span className="text-sm font-semibold">Vitrina del perfil</span>
        <div className="flex flex-wrap items-end gap-6">
          {vitrina.map((m) => (
            <div key={m.nombre} className="flex w-32 flex-col items-center gap-2 text-center">
              <img src={src(m)} alt={m.titulo} className="h-36 w-auto" />
              <span className="text-xs font-medium">{m.titulo}</span>
            </div>
          ))}
        </div>
        {vitrina[0] && (
          <div className="flex max-w-md items-center gap-4 rounded-xl border bg-background p-3 shadow-lg">
            <img src={src(vitrina[0])} alt="" className="h-16 w-auto" />
            <div className="flex flex-col">
              <span className="font-mono text-[11px] font-semibold tracking-[1px] text-primary uppercase">
                Medalla desbloqueada
              </span>
              <span className="text-sm font-semibold">{vitrina[0].titulo}</span>
              <span className="text-xs text-muted-foreground">Ya la podés mostrar en tu perfil.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Logros({
  titulo,
  items,
  medalla,
  destacado,
}: {
  titulo: string
  items: Medalla[]
  medalla: boolean
  destacado?: boolean
}) {
  return (
    <div className={cn(card, "flex flex-col gap-3 p-4", destacado && "ring-1 ring-primary/40")}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Logros</span>
        <span className="font-mono text-[11px] text-muted-foreground uppercase">{titulo}</span>
      </div>
      {items.map((m) => (
        <div key={m.nombre} className="flex items-center gap-3">
          <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-primary/12 text-lg">
            {medalla ? <img src={src(m)} alt="" className="h-8 w-auto" /> : "🏅"}
          </span>
          <span className="flex-1 text-sm font-medium">{m.titulo}</span>
          <span className="font-mono text-xs font-semibold text-muted-foreground">×1</span>
        </div>
      ))}
    </div>
  )
}

// ---------- Todas, por categoría ----------

function Todas({ medallas }: { medallas: Medalla[] }) {
  const [grupo, setGrupo] = useState<"Todas" | Medalla["grupo"]>("Todas")
  const [bloqueadas, setBloqueadas] = useState(false)
  const porCategoria = useMemo(() => {
    const map = new Map<string, Medalla[]>()
    for (const m of medallas) {
      if (grupo !== "Todas" && m.grupo !== grupo) continue
      const k = `${m.grupo} · ${m.categoria}`
      map.set(k, [...(map.get(k) ?? []), m])
    }
    return [...map.entries()]
  }, [medallas, grupo])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-lg border p-0.5">
          {(["Todas", "Entregadas", "Nuevas"] as const).map((g) => (
            <Button
              key={g}
              size="sm"
              variant={grupo === g ? "secondary" : "ghost"}
              onClick={() => setGrupo(g)}
            >
              {g}
            </Button>
          ))}
        </span>
        <Button size="sm" variant="outline" onClick={() => setBloqueadas((b) => !b)}>
          {bloqueadas ? "Ver desbloqueadas" : "Ver bloqueadas"}
        </Button>
      </div>
      {porCategoria.map(([cat, items]) => (
        <div key={cat} className={cn(card, "flex flex-col gap-3 p-4")}>
          <span className="text-sm font-semibold">{cat}</span>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
            {items.map((m) => (
              <div key={m.archivo} className="flex flex-col items-center gap-1 text-center">
                <img src={src(m, bloqueadas)} alt="" title={m.titulo} className="h-24 w-auto" />
                <span className="line-clamp-2 text-[11px] text-muted-foreground">{m.titulo}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- Niveles: el LevelBadge de hoy contra el anillo con colores de FACEIT ----------

const JUGADORES = [
  { nick: "kyan", nivel: 3, elo: 1120 },
  { nick: "killuaz", nivel: 7, elo: 1585 },
  { nick: "daniel", nivel: 10, elo: 2140 },
  { nick: "pepon", nivel: 1, elo: 640 },
  { nick: "mecha", nivel: 5, elo: 1310 },
  { nick: "rbk", nivel: 8, elo: 1790 },
]

function nivelSrc(n: number) {
  return `${BASE}/niveles/nivel_${String(n).padStart(2, "0")}.svg`
}

function Niveles() {
  return (
    <div className="flex flex-col gap-4">
      <div className={cn(card, "flex flex-col gap-4 p-4")}>
        <span className="text-sm font-semibold">Del 1 al 10</span>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="w-40 text-xs text-muted-foreground">LevelBadge de hoy</span>
            {Array.from({ length: 10 }, (_, i) => (
              <LevelBadge key={i} level={i + 1} size={30} />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="w-40 text-xs text-muted-foreground">Anillo (colores FACEIT)</span>
            {Array.from({ length: 10 }, (_, i) => (
              <img key={i} src={nivelSrc(i + 1)} alt={`Nivel ${i + 1}`} className="size-[30px]" />
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(["hoy", "anillo"] as const).map((tipo) => (
          <div key={tipo} className={cn(card, "overflow-hidden")}>
            <div className="border-b px-4 py-2 text-sm font-semibold">
              Ranking · {tipo === "hoy" ? "LevelBadge de hoy" : "Anillo"}
            </div>
            {JUGADORES.map((j, i) => (
              <div key={j.nick} className="flex items-center gap-3 border-b px-4 py-2 last:border-b-0">
                <span className="w-5 font-mono text-xs text-muted-foreground">{i + 1}</span>
                {tipo === "hoy" ? (
                  <LevelBadge level={j.nivel} size={24} />
                ) : (
                  <img src={nivelSrc(j.nivel)} alt={`Nivel ${j.nivel}`} className="size-6" />
                )}
                <span className="flex-1 text-sm font-medium">{j.nick}</span>
                <span className="font-mono text-xs text-muted-foreground">{j.elo}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
