import { cn } from "cn"
import { Share2Icon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import heroImage from "@/assets/landing-bg.webp"
import { BackButton } from "@/components/brand/BackButton"
import { Button, buttonVariants } from "@/components/ui/button"
import type { MmLobby } from "../types"
import { RoomHeader } from "./RoomHeader"
import { RoomOverview } from "./RoomOverview"
import { RoomStats } from "./RoomStats"

// Sala de la partida (plan, sección 7): la misma pantalla desde el veto hasta después del
// resultado, con "Descripción general" y "Estadísticas" (esta, recién cuando la partida terminó).

type Tab = "overview" | "stats"

export function MatchRoom({
  lobby,
  onBack,
  mode = "live",
  initialTab = "overview",
}: {
  lobby: MmLobby
  onBack?: () => void
  /** detail: el detalle de una partida terminada (`/match/<id>`, replanteo 78), con "Partidas" para volver. */
  mode?: "live" | "detail"
  /** La pestaña con que abre (replanteo 83: el aviso de jugadas lleva a Estadísticas). */
  initialTab?: Tab
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const map = lobby.veto?.pool.find((m) => m.name === lobby.map) ?? null
  const backdrop = map?.image_url ?? heroImage
  // Las estadísticas son postpartido: con la partida en vivo solo se ve el marcador.
  const hasStats = lobby.status === "finished" && !!lobby.match
  const ended = lobby.status === "finished" || lobby.status === "cancelled"
  const current = hasStats ? tab : "overview"

  const share = async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      toast.success("Link de la sala copiado")
    } catch {
      toast.error("No se pudo copiar")
    }
  }

  return (
    <section aria-label="Sala de la partida" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {mode === "detail" && (
          <BackButton
            fallback={{ to: "/matches" }}
            label="Partidas"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-[30px] gap-1.5 pr-2.5 pl-1.5 text-[13px]"
            )}
          />
        )}
        <h1 className="text-[13px] text-muted-foreground">
          {mode === "detail" ? "Partida del matchmaking" : "Sala de la partida"}
        </h1>
        <div
          role="tablist"
          aria-label="Sala"
          className="inline-flex gap-0.5 rounded-lg bg-muted p-[3px] sm:ml-3"
        >
          <RoomTab
            active={current === "overview"}
            onClick={() => setTab("overview")}
          >
            Descripción general
          </RoomTab>
          <RoomTab
            active={current === "stats"}
            disabled={!hasStats}
            onClick={() => setTab("stats")}
          >
            Estadísticas
          </RoomTab>
        </div>
        <span className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Compartir"
            onClick={() => void share()}
          >
            <Share2Icon />
          </Button>
          {ended && onBack && mode === "live" && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cerrar la sala"
              onClick={onBack}
            >
              <XIcon />
            </Button>
          )}
        </span>
      </div>

      <RoomHeader
        lobby={lobby}
        backdrop={backdrop}
        mapName={map?.label ?? null}
      />

      {current === "overview" ? (
        <RoomOverview lobby={lobby} map={map} onBack={onBack} mode={mode} />
      ) : (
        <RoomStats
          lobby={lobby}
          match={lobby.match!}
          backdrop={backdrop}
          mapName={map?.label ?? null}
        />
      )}
    </section>
  )
}

function RoomTab({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      title={disabled ? "Cuando termine la partida" : undefined}
      onClick={onClick}
      className={cn(
        "h-7 rounded-md px-3 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50",
        active && "bg-card text-foreground shadow-xs"
      )}
    >
      {children}
    </button>
  )
}
