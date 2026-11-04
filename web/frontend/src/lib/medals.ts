import { useEffect, useMemo, useState } from "react"

// Catálogo de medallas de public/medallas/catalogo.json (SVG con brillo solo en el marco). Lo usan el perfil
// (Logros) y Administración › Medallas; la API guarda la clave (`medal_key`).
// `archivo` es relativo a /medallas/; la bloqueada es bloqueada_<archivo>.

export type MetalTier = "bronce" | "plata" | "oro" | "platino" | "diamante"

export type MedalDef = {
  archivo: string
  clave: string
  titulo: string
  categoria: string
  grupo: "Entregadas" | "Nuevas"
  nivel: MetalTier | null
  equipo: boolean
  /** Muestra la temporada en la etiqueta de arriba ("S1" en el archivo). */
  temporada: boolean
}

export function medalSrc(m: Pick<MedalDef, "archivo">, locked = false) {
  const i = m.archivo.lastIndexOf("/")
  const file = (locked ? "bloqueada_" : "") + m.archivo.slice(i + 1)
  return `/medallas/${m.archivo.slice(0, i + 1)}${file}`
}

export const levelSrc = (n: number) =>
  `/niveles/nivel_${String(n).padStart(2, "0")}.svg`

// Se baja una sola vez por pestaña.
let catalog: Promise<MedalDef[]> | null = null
const loadCatalog = () =>
  (catalog ??= fetch("/medallas/catalogo.json")
    .then((r) => r.json())
    .then((c: { medallas: MedalDef[] }) => c.medallas))

export function useMedalCatalog() {
  const [medals, setMedals] = useState<MedalDef[]>([])
  useEffect(() => {
    let alive = true
    void loadCatalog().then((m) => alive && setMedals(m))
    return () => {
      alive = false
    }
  }, [])
  return medals
}

/** Catálogo por clave; vacío mientras carga. */
export function useMedalsByKey() {
  const medals = useMedalCatalog()
  return useMemo(() => new Map(medals.map((m) => [m.clave, m])), [medals])
}

/** Lo que va en la etiqueta de una medalla de temporada: "BETA" si el nombre lo dice, si no "S<número>". */
export function seasonShort(
  season: { number: number; name: string } | null | undefined
) {
  if (!season) return undefined
  return /beta/i.test(season.name) ? "BETA" : `S${season.number}`
}
