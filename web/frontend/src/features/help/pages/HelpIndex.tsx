import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { BookOpenIcon, ChevronRightIcon, SearchIcon } from "lucide-react"
import { useState } from "react"

import { FilterChips } from "@/components/brand/FilterChips"
import { EmptyState } from "@/components/brand/EmptyState"
import { QueryErrorMessage } from "@/components/brand/QueryState"
import { Card } from "@/components/ui/card"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { manualIndexOptions } from "../api/queries"
import { fragmento, type Fragmento } from "../lib/fragmento"
import { normalize } from "../lib/links"
import type {
  ManualIndice,
  ManualPaginaResumen,
  ManualSeccionId,
} from "../types"

/** Ayuda: el índice del manual que ve la cuenta, por sección, con buscador. */
export function HelpIndex({
  seccion,
  onSeccion,
}: {
  seccion: ManualSeccionId | undefined
  onSeccion: (s: ManualSeccionId) => void
}) {
  const index = useQuery(manualIndexOptions())
  const [q, setQ] = useState("")

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.5px]">Ayuda</h1>
        <p className="text-sm text-muted-foreground">
          Cómo se usa CM League, paso a paso.
        </p>
      </header>

      {index.isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : index.isError ? (
        <Card variant="outline" className="p-5">
          <QueryErrorMessage error={index.error} onRetry={index.refetch} />
        </Card>
      ) : index.data.secciones.length === 0 ? (
        <Card variant="outline">
          <EmptyState icon={BookOpenIcon} title="Todavía no hay páginas">
            El manual se está escribiendo.
          </EmptyState>
        </Card>
      ) : (
        <>
          <InputGroup className="max-w-[420px]">
            <InputGroupAddon>
              <SearchIcon aria-hidden className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Buscar en la ayuda"
              placeholder="Buscar en la ayuda…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </InputGroup>
          {q.trim() ? (
            <Results index={index.data} q={q} />
          ) : (
            <Sections
              index={index.data}
              seccion={seccion}
              onSeccion={onSeccion}
            />
          )}
        </>
      )}
    </section>
  )
}

function Sections({
  index,
  seccion,
  onSeccion,
}: {
  index: ManualIndice
  seccion: ManualSeccionId | undefined
  onSeccion: (s: ManualSeccionId) => void
}) {
  const current =
    index.secciones.find((s) => s.id === seccion) ??
    index.secciones.find((s) => s.id === index.inicio) ??
    index.secciones[0]!
  return (
    <>
      {index.secciones.length > 1 && (
        <FilterChips
          label="Sección de la ayuda"
          options={index.secciones.map((s) => ({
            value: s.id,
            label: s.titulo,
          }))}
          value={current.id}
          onChange={onSeccion}
        />
      )}
      <PageList seccion={current.id} paginas={current.paginas} />
    </>
  )
}

function Results({ index, q }: { index: ManualIndice; q: string }) {
  const n = normalize(q.trim())
  const found = index.secciones
    .map((s) => {
      // Primero lo que coincide en el título o el resumen; después, lo que coincide solo en el texto, con el fragmento.
      const enTitulo = s.paginas.filter((p) =>
        normalize(`${p.titulo} ${p.resumen}`).includes(n)
      )
      const enTexto = s.paginas
        .filter((p) => !enTitulo.includes(p))
        .map((p) => ({ ...p, fragmento: fragmento(p.texto ?? "", n) }))
        .filter((p) => p.fragmento !== null)
      return { ...s, paginas: [...enTitulo, ...enTexto] }
    })
    .filter((s) => s.paginas.length > 0)
  if (found.length === 0)
    return (
      <Card variant="outline">
        <EmptyState icon={SearchIcon} title="Sin resultados">
          No hay ninguna página que hable de “{q.trim()}”.
        </EmptyState>
      </Card>
    )
  return found.map((s) => (
    <div key={s.id} className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{s.titulo}</h2>
      <PageList seccion={s.id} paginas={s.paginas} />
    </div>
  ))
}

function PageList({
  seccion,
  paginas,
}: {
  seccion: ManualSeccionId
  paginas: (ManualPaginaResumen & { fragmento?: Fragmento | null })[]
}) {
  return (
    <ul className="flex flex-col gap-2">
      {paginas.map((p) => (
        <li key={p.tarea}>
          <Card variant="outline" asChild>
            <Link
              to="/help/$seccion/$tarea"
              params={{ seccion, tarea: p.tarea }}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.titulo}</p>
                <p className="text-sm text-muted-foreground">{p.resumen}</p>
                {p.fragmento && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.fragmento.antes}
                    <mark className="rounded-sm bg-primary/15 px-0.5 text-foreground">
                      {p.fragmento.match}
                    </mark>
                    {p.fragmento.despues}
                  </p>
                )}
              </div>
              <ChevronRightIcon
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  )
}
