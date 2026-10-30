import { createFileRoute, notFound } from "@tanstack/react-router"
import { LockIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { BioWidget, THEMES } from "@/features/bio/BioWidget"
import type { BioData } from "@/features/bio/draw"
import type { CardTheme } from "@/features/export/card"
import { DEMO_STATS } from "@/features/export/demo"
import { vipToast } from "@/features/vip/upsell"

// Ejemplo del widget para la bio de Twitch y Twitter para VIP sin API ni sesión
// (docs/bitacora/2026-10-29-widget-bio en kyan/pruebas). Solo en `pnpm dev`.
export const Route = createFileRoute("/demo/bio")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoBio,
})

function DemoBio() {
  const [vip, setVip] = useState(true)
  const [theme, setTheme] = useState<CardTheme>("cm")
  const [noPhoto, setNoPhoto] = useState(false)
  const data = useMemo<BioData>(
    () => ({
      ...DEMO_STATS.season,
      avatar_url: noPhoto ? null : DEMO_STATS.season.avatar_url,
      rank: 14,
      url: "https://cmleague.lat/pepon",
    }),
    [noPhoto]
  )
  const pick = (t: CardTheme) => {
    if (THEMES[t].vip && !vip)
      return vipToast("El tema dorado es solo para VIP.")
    setTheme(t)
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
        <span className="mr-2 font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
          Demo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Switch
            id="demo-vip"
            size="sm"
            checked={vip}
            onCheckedChange={(v) => {
              setVip(v)
              if (!v && THEMES[theme].vip) setTheme("cm")
            }}
          />
          <Label htmlFor="demo-vip" className="text-xs">
            Ser VIP
          </Label>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Switch
            id="demo-nophoto"
            size="sm"
            checked={noPhoto}
            onCheckedChange={setNoPhoto}
          />
          <Label htmlFor="demo-nophoto" className="text-xs">
            Jugador sin foto
          </Label>
        </span>
        <span className="ml-auto inline-flex rounded-lg border p-0.5">
          {(Object.keys(THEMES) as CardTheme[]).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={theme === t ? "secondary" : "ghost"}
              aria-pressed={theme === t}
              onClick={() => pick(t)}
            >
              {THEMES[t].vip && !vip && (
                <LockIcon aria-hidden className="size-3" />
              )}
              {THEMES[t].label}
            </Button>
          ))}
        </span>
      </div>
      <section className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold">
          Widget para tu bio
        </h1>
        <p className="text-sm text-muted-foreground">
          Mostrá tu nivel y tus stats en Twitch, Twitter o tu web, con un link a
          tu perfil. Distinto del widget para OBS: este va en la bio, no encima
          del stream.
        </p>
      </section>
      <BioWidget data={data} theme={theme} vip={vip} />
    </div>
  )
}
