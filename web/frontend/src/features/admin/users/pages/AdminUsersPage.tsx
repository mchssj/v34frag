import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { AdminHeader, AdminTabs } from "../../components/ui"
import { AccountsTab } from "../components/AccountsTab"
import { AuthImageTab } from "../components/AuthImageTab"
import { hitsOptions } from "../api/queries"
import { WordsTab } from "../components/WordsTab"

export const USER_TABS = ["accounts", "words", "login"] as const
export type UserTab = (typeof USER_TABS)[number]

export function AdminUsersPage({
  tab,
  onTab,
}: {
  tab: UserTab
  onTab: (t: UserTab) => void
}) {
  const hits = useQuery(hitsOptions)
  const [selected, setSelected] = useState<string | null>(null)
  // Al llegar desde "Cambiar alias", la lista se abre buscando ese alias.
  const [focus, setFocus] = useState<string | undefined>(undefined)

  return (
    <section className="flex flex-col gap-5">
      <AdminHeader
        title="Usuarios"
        subtitle="Las cuentas con las que la gente entra a la web: alias, rol y VIP. Las palabras que nadie puede usar en su alias ni en un equipo. Y la imagen de la pantalla de inicio de sesión."
      />
      <AdminTabs
        label="Secciones de Usuarios"
        value={tab}
        onChange={onTab}
        tabs={[
          { key: "accounts", label: "Cuentas" },
          {
            key: "words",
            label: "Palabras bloqueadas",
            badge: hits.data?.total,
          },
          { key: "login", label: "Inicio de sesión" },
        ]}
      />
      {tab === "accounts" && (
        <AccountsTab
          key={focus ?? "list"}
          initialQ={focus}
          selected={selected}
          onSelect={setSelected}
        />
      )}
      {tab === "login" && <AuthImageTab />}
      {tab === "words" && (
        <WordsTab
          onEditAlias={(h) => {
            setFocus(h.name)
            setSelected(h.id)
            onTab("accounts")
          }}
        />
      )}
    </section>
  )
}
