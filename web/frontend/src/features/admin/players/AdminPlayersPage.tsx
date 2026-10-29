import { useQuery } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { AdminHeader, AdminTabs } from "../ui"
import { FichasTab } from "./FichasTab"
import { steamRequestsOptions } from "./queries"
import { SteamRequestsTab, UnlinkedTab } from "./SteamTabs"

export const PLAYER_TABS = ["fichas", "requests", "unlinked"] as const
export type PlayerTab = (typeof PLAYER_TABS)[number]

export function AdminPlayersPage({
  tab,
  onTab,
}: {
  tab: PlayerTab
  onTab: (t: PlayerTab) => void
}) {
  const pending = useQuery(steamRequestsOptions(true))
  const [creating, setCreating] = useState(false)
  // Una ficha recién creada desde "SteamID sin vincular" se abre en Fichas.
  const [open, setOpen] = useState<string | null>(null)

  return (
    <section className="flex flex-col gap-5">
      <AdminHeader
        title="Jugadores"
        subtitle="Las fichas del juego: sus SteamID, sus datos públicos y medallas. La cuenta con la que alguien entra a la web se administra en Usuarios y moderación."
        action={
          <Button
            size="md"
            onClick={() => {
              onTab("fichas")
              setCreating(true)
            }}
          >
            <PlusIcon aria-hidden />
            Nueva ficha
          </Button>
        }
      />
      <AdminTabs
        label="Secciones de Jugadores"
        value={tab}
        onChange={onTab}
        tabs={[
          { key: "fichas", label: "Fichas" },
          {
            key: "requests",
            label: "Pedidos de SteamID",
            badge: pending.data?.total,
          },
          { key: "unlinked", label: "SteamID sin vincular" },
        ]}
      />
      {tab === "fichas" && (
        <FichasTab
          key={open ?? "list"}
          initial={open}
          creating={creating}
          onCreatingDone={() => setCreating(false)}
          onGoUnlinked={() => onTab("unlinked")}
        />
      )}
      {tab === "requests" && <SteamRequestsTab />}
      {tab === "unlinked" && (
        <UnlinkedTab
          onOpenFicha={(id) => {
            setOpen(id)
            onTab("fichas")
          }}
        />
      )}
    </section>
  )
}
