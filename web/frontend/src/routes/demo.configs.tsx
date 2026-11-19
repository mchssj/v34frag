import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ConfigsTab } from "@/features/configs/ConfigsTab"
import { DEMO_CONFIGS, type PublishedConfig } from "@/features/configs/demo"

// Ejemplo de la pestaña Config del perfil, sin API ni sesión (docs/bitacora/2026-10-29-configs-jugadores en
// kyan/pruebas). Solo en `pnpm dev`.
export const Route = createFileRoute("/demo/configs")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoConfigs,
})

const ME = "tu.nick"

function DemoConfigs() {
  const [vip, setVip] = useState(false)
  const [who, setWho] = useState<string>(DEMO_CONFIGS[0]!.nick)
  const [mine, setMine] = useState<PublishedConfig | null>(null)
  const isMe = who === ME
  const config = isMe
    ? mine
    : (DEMO_CONFIGS.find((c) => c.nick === who) ?? null)

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
        <span className="mr-2 font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
          Demo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Switch
            id="demo-vip"
            size="sm"
            checked={vip}
            onCheckedChange={setVip}
          />
          <Label htmlFor="demo-vip" className="text-xs">
            Ser VIP
          </Label>
        </span>
        <span className="text-xs text-muted-foreground">Perfil de:</span>
        <span className="inline-flex flex-wrap rounded-lg border p-0.5">
          {[ME, ...DEMO_CONFIGS.map((c) => c.nick)].map((n) => (
            <Button
              key={n}
              size="sm"
              variant={who === n ? "secondary" : "ghost"}
              aria-pressed={who === n}
              onClick={() => setWho(n)}
            >
              {n === ME ? "Vos" : n}
            </Button>
          ))}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.4px]">
          {isMe ? "Tu perfil" : who} · Config
        </h1>
        <p className="text-sm text-muted-foreground">
          La pestaña Config del perfil. Cualquiera sube la suya; los VIP ven el
          contenido y descargan las de los demás.
        </p>
      </div>

      <ConfigsTab
        config={config}
        vip={vip}
        mine={isMe}
        onPublish={(files, flagged) => {
          setMine({
            nick: ME,
            uploaded_at: new Date().toISOString().slice(0, 10),
            files,
            flagged,
          })
          toast.success(
            flagged.length
              ? "Config publicada. Queda en revisión por los scripts."
              : "Config publicada."
          )
        }}
      />
    </div>
  )
}
