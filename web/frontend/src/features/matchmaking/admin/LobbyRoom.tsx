import { useQuery } from "@tanstack/react-query"
import { BanIcon, CopyIcon, RefreshCwIcon, ShieldIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BanDialog } from "@/features/admin/bans/components/BanDialog"
import { fmtDateTime } from "../labels"
import { adminLobbyOptions, useMmAdminMutation } from "../queries"
import { MatchRoom } from "../room/MatchRoom"
import { useMmSource } from "../source"
import type { MmLobby, MmPlayer } from "../types"

/**
 * Salas › Ver sala (replanteo 116): la sala como la ve un jugador ("Tu última partida"), con lo que le sirve al admin:
 * cancelarla, el servidor con la contraseña y banear a un jugador.
 */
export function LobbyRoom({
  lobbyId,
  onBack,
}: {
  lobbyId: string
  onBack: () => void
}) {
  const source = useMmSource()
  const q = useQuery(adminLobbyOptions(source, lobbyId))
  const [banning, setBanning] = useState<MmPlayer | null>(null)

  if (q.isPending) return <Skeleton className="h-80 w-full rounded-xl" />
  if (q.error || !q.data)
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="destructive">
          <AlertTitle>No se pudo abrir la sala</AlertTitle>
          <AlertDescription>{errorMessage(q.error)}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={onBack}>
          Volver a Salas
        </Button>
      </div>
    )

  return (
    <>
      <MatchRoom
        lobby={q.data}
        mode="admin"
        onBack={onBack}
        extra={
          <AdminCard
            lobby={q.data}
            refreshing={q.isFetching}
            onRefresh={() => void q.refetch()}
          />
        }
        playerExtra={(p) => (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Banear a ${p.nick}`}
            title="Banear de los servidores"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={() => setBanning(p)}
          >
            <BanIcon />
          </Button>
        )}
      />
      {banning && (
        <BanDialog
          fixed={{ kind: "player", id: banning.player_id, label: banning.nick }}
          canPermanent
          onClose={() => setBanning(null)}
        />
      )}
    </>
  )
}

function AdminCard({
  lobby,
  refreshing,
  onRefresh,
}: {
  lobby: MmLobby
  refreshing: boolean
  onRefresh: () => void
}) {
  const source = useMmSource()
  const [confirm, setConfirm] = useState(false)
  const cancel = useMmAdminMutation(() => source.cancelLobby(lobby.id))
  const ended = lobby.status === "finished" || lobby.status === "cancelled"
  const connected = lobby.players.filter((p) => p.connected).length

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(lobby.id)
      toast.success("ID de la sala copiado")
    } catch {
      toast.error("No se pudo copiar")
    }
  }

  return (
    <section
      aria-label="Administración de la sala"
      className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-card p-4"
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <ShieldIcon aria-hidden className="size-4 text-primary" />
        Administración
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Sala</dt>
        <dd className="truncate font-mono">{lobby.id}</dd>
        <dt className="text-muted-foreground">Jugadores</dt>
        <dd className="font-mono tabular-nums">
          {lobby.players.length}
          {!ended && ` · ${connected} conectados`}
        </dd>
        {lobby.match?.played_at && (
          <>
            <dt className="text-muted-foreground">Partida</dt>
            <dd>{fmtDateTime(lobby.match.played_at)}</dd>
          </>
        )}
      </dl>
      <div className="flex flex-wrap gap-2">
        {!ended && (
          <Button
            variant="destructive"
            size="sm"
            disabled={cancel.isPending}
            onClick={() => setConfirm(true)}
          >
            Cancelar sala
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => void copyId()}>
          <CopyIcon aria-hidden />
          Copiar ID
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshCwIcon aria-hidden />
          Actualizar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {ended
          ? "La sala ya terminó."
          : "Se actualiza sola cada 5 segundos. La IP y la contraseña de abajo sirven para entrar a moderar."}
      </p>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="¿Cancelar la sala?"
        description="Libera el servidor y no sanciona a nadie."
        confirmLabel="Cancelar sala"
        danger
        pending={cancel.isPending}
        error={cancel.error}
        onConfirm={() =>
          cancel.mutate(undefined, {
            onSuccess: () => {
              setConfirm(false)
              toast.success("Sala cancelada")
            },
          })
        }
      />
    </section>
  )
}
