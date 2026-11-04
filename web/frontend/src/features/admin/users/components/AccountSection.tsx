import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { SecretDialog } from "../../components/dialogs"
import { fmtDate } from "../../lib/format"
import { Chip, PanelSection } from "../../components/ui"
import {
  accountStatusOptions,
  useRandomPassword,
  useResendConfirmation,
  useSendPasswordReset,
} from "../api/queries"
import type { AdminUser } from "../types"

type Action = "resend" | "reset" | "random"

/**
 * Activación y contraseña de una cuenta (plan docs/bitacora/2026-11-03-admin-cuentas-usuarios). Una cuenta admin no acepta
 * la aleatoria: eso también cubre la propia, porque a este panel solo entran admins.
 */
export function AccountSection({ u }: { u: AdminUser }) {
  const status = useQuery(accountStatusOptions(u.id))
  const resend = useResendConfirmation(u.id)
  const reset = useSendPasswordReset(u.id)
  const random = useRandomPassword(u.id)
  const [action, setAction] = useState<Action | null>(null)
  const [secret, setSecret] = useState<{
    password: string
    sessionsClosed: boolean
  } | null>(null)
  const confirmed = status.data?.confirmed
  const close = (o: boolean) => {
    if (!o) setAction(null)
  }

  return (
    <PanelSection
      title="Acceso"
      aside={
        status.isSuccess ? (
          <Chip tone={confirmed ? "neutral" : "primary"}>
            {confirmed ? "Correo confirmado" : "Sin confirmar"}
          </Chip>
        ) : undefined
      }
    >
      {status.data?.email && (
        <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
          <span className="text-muted-foreground">Correo</span>
          {/* Solo lectura: el correo lo cambia el jugador desde su cuenta. */}
          <span className="font-mono break-all select-all">
            {status.data.email}
          </span>
        </div>
      )}
      <span className="text-[13px] leading-relaxed text-muted-foreground">
        {status.isError
          ? errorMessage(status.error)
          : status.data?.last_sign_in_at
            ? `Último inicio de sesión: ${fmtDate(status.data.last_sign_in_at)}.`
            : "Nunca inició sesión."}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={confirmed !== false}
          onClick={() => setAction("resend")}
        >
          Reenviar activación
        </Button>
        <Button variant="outline" onClick={() => setAction("reset")}>
          Enviar correo de contraseña
        </Button>
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={u.role === "admin"}
          onClick={() => setAction("random")}
        >
          Contraseña aleatoria
        </Button>
      </div>
      {u.role === "admin" && (
        <span className="text-xs text-muted-foreground">
          A una cuenta admin no se le pone una contraseña aleatoria. La tuya se
          cambia en Mi perfil.
        </span>
      )}

      <ConfirmDialog
        open={action === "resend"}
        onOpenChange={close}
        title={`¿Reenviar la activación a ${u.alias}?`}
        description="Le llega un correo con el link para activar la cuenta."
        confirmLabel="Reenviar"
        pending={resend.isPending}
        error={resend.error}
        onConfirm={() =>
          resend.mutate(undefined, {
            onSuccess: () => {
              setAction(null)
              toast.success("Correo de activación enviado.")
            },
          })
        }
      />
      <ConfirmDialog
        open={action === "reset"}
        onOpenChange={close}
        title={`¿Enviar el correo de contraseña a ${u.alias}?`}
        description="Le llega un link para que elija una contraseña nueva. La actual sigue valiendo hasta que la cambie."
        confirmLabel="Enviar"
        pending={reset.isPending}
        error={reset.error}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSuccess: () => {
              setAction(null)
              toast.success("Correo de contraseña enviado.")
            },
          })
        }
      />
      <ConfirmDialog
        open={action === "random"}
        onOpenChange={close}
        title={`¿Cambiar la contraseña de ${u.alias} por una aleatoria?`}
        description="Deja de valer la que tiene ahora y se cierran sus sesiones. La nueva se muestra una sola vez, para que se la pases. Queda registrado que lo hiciste."
        confirmLabel="Cambiar contraseña"
        danger
        pending={random.isPending}
        error={random.error}
        onConfirm={() =>
          random.mutate(undefined, {
            onSuccess: (r) => {
              setAction(null)
              setSecret({
                password: r.password,
                sessionsClosed: r.sessions_closed,
              })
            },
          })
        }
      />
      <SecretDialog
        open={secret !== null}
        title={`Contraseña nueva de ${u.alias}`}
        intro={
          secret?.sessionsClosed === false
            ? "La contraseña cambió, pero no se pudieron cerrar sus sesiones abiertas. Pásasela y recomiéndale cambiarla en Mi perfil."
            : "Pásasela por un canal privado y recomiéndale cambiarla en Mi perfil."
        }
        blocks={secret ? [{ label: "Contraseña", text: secret.password }] : []}
        onDone={() => setSecret(null)}
      />
    </PanelSection>
  )
}
