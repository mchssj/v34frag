import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { BackButton } from "@/components/brand/BackButton"
import { toast } from "sonner"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { eventDetailOptions } from "@/features/events/api/queries"
import { AdminHeader, AdminTabs, QueryError } from "../../components/ui"
import { useCreateEvent } from "../api/queries"
import { EventForm } from "../components/EventForm"
import {
  ConfigTab,
  RegistrationsTab,
  SummaryTab,
} from "../components/ManageTabs"
import { MatchesTab } from "../components/MatchesTab"
import { SeedingTab } from "../components/SeedingTab"
import { STATUS_LABEL, TEMPLATE_LABEL } from "../lib/model"

/** Crear un torneo: el formulario y, al guardar, a gestionarlo. */
export function AdminEventNewPage() {
  const create = useCreateEvent()
  const navigate = useNavigate()
  return (
    <section className="flex flex-col gap-5">
      <BackLink />
      <AdminHeader
        title="Crear torneo"
        subtitle="Formato primero: a la derecha, el resumen de cómo se va a jugar. Después se abren las inscripciones y se gestiona desde su página."
      />
      <EventForm
        submitLabel="Crear torneo"
        pending={create.isPending}
        error={create.error}
        onCancel={() => void navigate({ to: "/admin/events" })}
        onSubmit={(v) =>
          create.mutate(v, {
            onSuccess: ({ id }) => {
              toast.success("Torneo creado: las inscripciones están abiertas.")
              void navigate({ to: "/admin/events/$id", params: { id } })
            },
          })
        }
      />
    </section>
  )
}

export const MANAGE_TABS = [
  "summary",
  "regs",
  "seed",
  "matches",
  "config",
] as const
export type ManageTab = (typeof MANAGE_TABS)[number]
export const adminEventSearch = z.object({
  tab: z.enum(MANAGE_TABS).optional().catch(undefined),
})

/** Gestionar un torneo: Resumen, Inscripciones, Siembra, Partidas y Configuración. */
export function AdminEventPage({
  id,
  tab,
  onTab,
}: {
  id: string
  tab: ManageTab | undefined
  onTab: (t: ManageTab) => void
}) {
  const detail = useQuery(eventDetailOptions(id))
  if (detail.isError)
    return (
      <QueryError error={detail.error} onRetry={() => void detail.refetch()} />
    )
  if (!detail.data) return <Skeleton className="h-96 rounded-xl" />
  const event = detail.data
  if (event.viewer && !event.viewer.can_manage)
    return (
      <section className="flex flex-col gap-4">
        <BackLink />
        <p className="text-sm text-muted-foreground">
          No gestionas este torneo.
        </p>
      </section>
    )
  // Mientras hay inscripciones, la pestaña por defecto es la siembra; después, las partidas.
  const current =
    tab ??
    (event.status === "registration"
      ? "seed"
      : event.status === "in_progress"
        ? "matches"
        : "summary")
  return (
    <section className="flex flex-col gap-5">
      <BackLink />
      <AdminHeader
        title={event.name}
        subtitle={`${TEMPLATE_LABEL[event.template]} · ${event.game_mode} · ${event.teams} equipos inscritos`}
        action={
          <div className="flex items-center gap-2">
            <Badge
              variant={
                event.status === "registration"
                  ? "primary"
                  : event.status === "in_progress"
                    ? "win"
                    : "muted"
              }
            >
              {STATUS_LABEL[event.status]}
            </Badge>
            <Button asChild variant="outline" size="md">
              <Link to="/events/$id" params={{ id: event.id }}>
                Ver página pública
              </Link>
            </Button>
          </div>
        }
      />
      <AdminTabs
        label="Gestionar torneo"
        value={current}
        onChange={onTab}
        tabs={[
          { key: "summary", label: "Resumen" },
          { key: "regs", label: "Inscripciones", badge: event.teams },
          { key: "seed", label: "Siembra" },
          { key: "matches", label: "Partidas" },
          { key: "config", label: "Configuración" },
        ]}
      />
      {current === "summary" && <SummaryTab event={event} onTab={onTab} />}
      {current === "regs" && <RegistrationsTab event={event} />}
      {current === "seed" && <SeedingTab event={event} />}
      {current === "matches" && <MatchesTab event={event} />}
      {current === "config" && <ConfigTab event={event} />}
    </section>
  )
}

function BackLink() {
  return (
    <BackButton
      fallback={{ to: "/admin/events" }}
      label="Torneos"
      className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    />
  )
}
