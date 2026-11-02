import { useQuery } from "@tanstack/react-query"
import { CopyIcon, KeyRoundIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { ErrorAlert } from "@/components/brand/ErrorAlert"
import { Button } from "@/components/ui/button"
import {
  steamStatusOptions,
  useCreateClaimCode,
} from "@/features/onboarding/api/queries"
import {
  currentCode,
  expiryText,
  useSecondsLeft,
  type ClaimCode,
} from "@/features/onboarding/lib/claim"
import type { MmLobby } from "../types"

// Matchmaking sin SteamID vinculado (bitácora 2026-11-02-mm-claim-en-sala): quien entra a una sala sin
// SteamID lo vincula con !claim en el servidor de la sala. Hasta entonces el servidor lo deja de
// espectador; cuando lo hace, el plugin lo pasa a su equipo y la tarjeta desaparece.

/** Estados de la sala en los que se muestra: del veto hasta que arranca la partida. */
const CLAIM_STATUSES: MmLobby["status"][] = [
  "veto",
  "waiting_server",
  "assigned",
  "connecting",
]

/** Si quien mira está en la sala sin SteamID vinculado. Sin `linked` (API vieja, demo), se toma como vinculado. */
export function needsClaim(lobby: MmLobby) {
  return (
    CLAIM_STATUSES.includes(lobby.status) &&
    lobby.players.some((p) => p.is_me && p.linked === false)
  )
}

export function ClaimCard() {
  const status = useQuery(steamStatusOptions)
  if (status.isPending) return <ClaimFrame code={null} />
  // El código vigente queda fijo al montar: si vence, se ofrece otro en vez de esperar uno nuevo.
  return <ClaimBody initial={currentCode(status.data)} />
}

function ClaimBody({ initial }: { initial: ClaimCode | null }) {
  const create = useCreateClaimCode()
  const [shown, setShown] = useState<ClaimCode | null>(initial)
  const requested = useRef(false)
  const seconds = useSecondsLeft(shown?.expiresAt)
  const expired = shown !== null && seconds === 0

  async function newCode() {
    try {
      const c = await create.mutateAsync()
      setShown({ code: c.code, expiresAt: Date.parse(c.expires_at) })
    } catch {
      // El error se muestra con ErrorAlert.
    }
  }

  // Sin código vigente, se pide uno (una sola vez, aunque StrictMode monte dos veces).
  useEffect(() => {
    if (initial || requested.current) return
    requested.current = true
    void newCode()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, [])

  return (
    <ClaimFrame
      code={shown?.code ?? null}
      footer={
        expired ? (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            El código venció.
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void newCode()}
              disabled={create.isPending}
            >
              Generar otro código
            </Button>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {shown && seconds !== null
              ? expiryText(seconds)
              : "Generando código…"}
          </span>
        )
      }
      disabled={expired}
    >
      {create.error != null && (
        <ErrorAlert message={errorMessage(create.error)} />
      )}
    </ClaimFrame>
  )
}

function ClaimFrame({
  code,
  footer,
  disabled = false,
  children,
}: {
  code: string | null
  footer?: React.ReactNode
  disabled?: boolean
  children?: React.ReactNode
}) {
  const command = code ? `!claim ${code}` : "!claim …"
  return (
    <section
      aria-label="Vincula tu SteamID"
      className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/8 p-3 text-sm"
    >
      <h3 className="flex items-center gap-2 font-semibold">
        <KeyRoundIcon aria-hidden className="size-4 text-amber-500" />
        Vincula tu SteamID para jugar
      </h3>
      <p className="text-xs text-muted-foreground">
        Tu cuenta todavía no tiene un SteamID. Entra al servidor de la sala y
        escribe esto en el chat: el servidor te pasa a tu equipo enseguida. Si
        no lo haces antes de que se acabe el tiempo para entrar, cuenta como que
        no te presentaste.
      </p>
      <span className="flex items-center gap-2">
        <code
          aria-label={code ? `Comando ${command}` : "Generando código"}
          className="flex-1 rounded-md border bg-background px-2 py-1.5 font-mono text-base font-bold tracking-wider"
        >
          {command}
        </code>
        <Button
          variant="outline"
          size="sm"
          disabled={!code || disabled}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(command)
              toast.success("Comando copiado: pégalo en el chat del juego")
            } catch {
              toast.error("No se pudo copiar")
            }
          }}
        >
          <CopyIcon aria-hidden />
          Copiar
        </Button>
      </span>
      {footer ?? (
        <span className="text-xs text-muted-foreground">Generando código…</span>
      )}
      {children}
    </section>
  )
}
