import { cn } from "cn"
import { useState } from "react"

import { GeneralForm } from "./GeneralForm"
import { LobbiesPanel } from "./LobbiesPanel"
import { MapsPanel } from "./MapsPanel"
import { ReportsPanel } from "./ReportsPanel"
import { ServerPasswords } from "./ServerPasswords"
import { StatsPanel } from "./StatsPanel"

// Administración › Matchmaking (plan, sección 7): todo lo del matchmaking, en seis pestañas.

const TABS = [
  { key: "general", label: "General" },
  { key: "maps", label: "Mapas" },
  { key: "servers", label: "Servidores" },
  { key: "lobbies", label: "Salas" },
  { key: "reports", label: "Reportes" },
  { key: "stats", label: "Métricas" },
] as const

type Tab = (typeof TABS)[number]["key"]

export function AdminMatchmaking() {
  const [tab, setTab] = useState<Tab>("general")
  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-[-0.5px]">Matchmaking</h1>
      <div
        role="tablist"
        aria-label="Secciones del matchmaking"
        className="flex gap-1 border-b"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`mm-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`mm-panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium text-muted-foreground transition",
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`mm-panel-${tab}`}
        aria-labelledby={`mm-tab-${tab}`}
      >
        {tab === "general" && <GeneralForm />}
        {tab === "maps" && <MapsPanel />}
        {tab === "servers" && <ServerPasswords />}
        {tab === "lobbies" && <LobbiesPanel />}
        {tab === "reports" && <ReportsPanel />}
        {tab === "stats" && <StatsPanel />}
      </div>
    </section>
  )
}
