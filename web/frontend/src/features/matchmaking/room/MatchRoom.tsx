import { cn } from "cn"
import { MessageSquareIcon, Share2Icon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { LobbyChat } from "../LobbyChat"
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
}: {
  lobby: MmLobby
  onBack: () => void
}) {
  const [tab, setTab] = useState<Tab>("overview")
  const [chatOpen, setChatOpen] = useState(false)
  const map = lobby.veto?.pool.find((m) => m.name === lobby.map) ?? null
  const backdrop = map?.background_url ?? map?.image_url ?? null
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
    <section aria-label="Sala de la partida" className="flex flex-col gap-5">
      <div className="flex items-center gap-3 border-b pb-2">
        <h1 className="text-lg font-bold">Sala de la partida</h1>
        <div role="tablist" aria-label="Sala" className="mx-auto flex gap-5">
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
        <span className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Chat de la sala"
            onClick={() => setChatOpen(true)}
          >
            <MessageSquareIcon />
            {lobby.chat.length > 0 && (
              <span className="sr-only">{lobby.chat.length} mensajes</span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Compartir"
            onClick={() => void share()}
          >
            <Share2Icon />
          </Button>
          {ended && (
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
        <RoomOverview lobby={lobby} map={map} onBack={onBack} />
      ) : (
        <RoomStats
          lobby={lobby}
          match={lobby.match!}
          backdrop={backdrop}
          mapName={map?.label ?? null}
        />
      )}

      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent className="w-full sm:max-w-[400px]">
          <SheetHeader>
            <SheetTitle>Chat de la sala</SheetTitle>
            <SheetDescription>A todos o solo a tu equipo.</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <LobbyChat lobby={lobby} />
          </div>
        </SheetContent>
      </Sheet>
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
        "-mb-[9px] border-b-2 pb-2 text-sm font-semibold tracking-wide uppercase transition disabled:opacity-40",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
