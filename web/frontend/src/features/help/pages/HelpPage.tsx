import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { BookOpenIcon } from "lucide-react"

import { isApiError } from "@/api/errors"
import { BackButton } from "@/components/brand/BackButton"
import { EmptyState } from "@/components/brand/EmptyState"
import { QueryErrorMessage } from "@/components/brand/QueryState"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { manualIndexOptions, manualPageOptions } from "../api/queries"
import { ManualMarkdown } from "../components/ManualMarkdown"
import type { ManualSeccionId } from "../types"

/** Una página del manual, con las demás de su sección al costado. */
export function HelpPage({
  seccion,
  tarea,
}: {
  seccion: string
  tarea: string
}) {
  const page = useQuery(manualPageOptions(seccion, tarea))
  const index = useQuery(manualIndexOptions())
  const section = index.data?.secciones.find((s) => s.id === seccion)

  if (page.isError && isApiError(page.error, "NOT_FOUND"))
    return (
      <Card variant="outline">
        <EmptyState
          icon={BookOpenIcon}
          title="No encontramos esa página"
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/help">Ir a la ayuda</Link>
            </Button>
          }
        >
          Puede que se haya movido. Búscala en la ayuda.
        </EmptyState>
      </Card>
    )

  return (
    <div className="flex flex-col gap-4">
      <BackButton
        fallback={{
          to: "/help",
          search: { seccion: seccion as ManualSeccionId },
        }}
        label="Ayuda"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <article className="min-w-0">
          {page.isPending ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : page.isError ? (
            <Card variant="outline" className="p-5">
              <QueryErrorMessage error={page.error} onRetry={page.refetch} />
            </Card>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-[-0.5px]">
                {page.data.titulo}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {page.data.resumen}
              </p>
              <div className="mt-5 max-w-[720px]">
                <ManualMarkdown
                  markdown={page.data.markdown}
                  seccion={page.data.seccion}
                />
              </div>
            </>
          )}
        </article>
        {section && section.paginas.length > 1 && (
          <nav aria-label={`Más en ${section.titulo}`} className="lg:pt-1">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {section.titulo}
            </p>
            <ul className="flex flex-col gap-0.5 text-sm">
              {section.paginas.map((p) => (
                <li key={p.tarea}>
                  <Link
                    to="/help/$seccion/$tarea"
                    params={{ seccion: section.id, tarea: p.tarea }}
                    className="block rounded-md px-2 py-1.5 hover:bg-muted data-[status=active]:bg-muted data-[status=active]:font-medium"
                  >
                    {p.titulo}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  )
}
