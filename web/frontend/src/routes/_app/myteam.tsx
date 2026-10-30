import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"

import { Spinner } from "@/components/ui/spinner"
import { CreateTeam } from "@/features/teams/CreateTeam"
import { FindTeam } from "@/features/teams/FindTeam"
import { NoTeam } from "@/features/teams/NoTeam"
import { myTeamsOptions } from "@/features/teams/queries"
import { TeamSwitcher, type MyTeam } from "@/features/teams/TeamSwitcher"
import { TeamView } from "@/features/teams/TeamView"

// ?team: el equipo elegido entre los propios; ?view: Crear o Buscar (así funciona Atrás).
const searchSchema = z.object({
  team: z.string().optional().catch(undefined),
  view: z.enum(["create", "find"]).optional().catch(undefined),
  // Con view=create: abre la solicitud pendiente directo para editarla.
  edit: z.boolean().optional().catch(undefined),
})

export const Route = createFileRoute("/_app/myteam")({
  validateSearch: searchSchema,
  component: MyTeamPage,
})

function MyTeamPage() {
  const { team: chosen, view, edit } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const mine = useQuery(myTeamsOptions).data

  // Los equipos que lidera, primero.
  const myTeams: MyTeam[] = (mine ?? [])
    .map((t) => ({
      id: t.id,
      name: t.name,
      tag: t.tag,
      logo_url: t.logo_url,
      role: t.my_role,
    }))
    .sort((a, b) => Number(b.role === "leader") - Number(a.role === "leader"))

  const go = (search: z.infer<typeof searchSchema>) => void navigate({ search })

  if (!mine) return <Spinner className="size-6 text-muted-foreground" />
  if (view === "create")
    return <CreateTeam startEditing={edit} onCancel={() => go({})} />
  if (view === "find")
    return (
      <FindTeam onBack={() => go({})} myTeamIds={myTeams.map((t) => t.id)} />
    )
  if (myTeams.length === 0)
    return (
      <NoTeam
        onCreate={() => go({ view: "create" })}
        onEdit={() => go({ view: "create", edit: true })}
        onFind={() => go({ view: "find" })}
      />
    )

  const current = myTeams.find((t) => t.id === chosen) ?? myTeams[0]
  return (
    <TeamView
      key={current.id}
      teamId={current.id}
      mode="mine"
      switcher={
        <TeamSwitcher
          teams={myTeams}
          currentId={current.id}
          onSelect={(id) => go({ team: id })}
          onFind={() => go({ view: "find" })}
        />
      }
    />
  )
}
