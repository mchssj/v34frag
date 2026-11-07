import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { ErrorAlert } from "@/components/brand/ErrorAlert"
import { Button } from "@/components/ui/button"
import type { EventDetail } from "@/features/events/types"
import {
  useResubmitEvent,
  useReviewEvent,
  useUpdateEvent,
} from "../api/queries"

/**
 * Lo que espera aprobación y la fase de testing (replanteo 80): el torneo pendiente o rechazado,
 * los mixes vinculados por aprobar y si está en testing. Aprueba y rechaza el staff
 * (`viewer.can_review`); el organizador vuelve a enviar un rechazado.
 */
export function ReviewPanel({
  event,
  onTab,
}: {
  event: EventDetail
  onTab: (t: "matches") => void
}) {
  const staff = !!event.viewer?.can_review
  const review = useReviewEvent(event.id)
  const resubmit = useResubmitEvent(event.id)
  const update = useUpdateEvent(event.id)
  const [rejecting, setRejecting] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const blocks = []
  if (event.approval === "pending")
    blocks.push(
      <Block key="pending" tone="amber">
        <p>
          <b>Pendiente de aprobación.</b>{" "}
          {staff
            ? "Lo creó un organizador: solo lo ven él, los moderadores y los admins. Revísalo y apruébalo o recházalo con un motivo. Aprobarlo aprueba también los mixes que dejó vinculados."
            : "Lo puedes preparar entero; cuando un admin o moderador lo apruebe, se publica. Te avisamos por notificación."}
        </p>
        {staff && (
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={review.isPending}
              onClick={() =>
                review.mutate(
                  { approve: true },
                  {
                    onSuccess: () =>
                      toast.success("Torneo aprobado: ya está publicado."),
                  }
                )
              }
            >
              Aprobar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRejecting(true)}
            >
              Rechazar
            </Button>
          </div>
        )}
      </Block>
    )
  if (event.approval === "rejected")
    blocks.push(
      <Block key="rejected" tone="red">
        <p>
          <b>Rechazado.</b> {event.approval_note}
          {!staff && " Corrígelo y vuelve a enviarlo."}
        </p>
        {!staff && (
          <Button
            size="sm"
            disabled={resubmit.isPending}
            onClick={() =>
              resubmit.mutate(undefined, {
                onSuccess: () =>
                  toast.success("Lo volviste a enviar a aprobación."),
              })
            }
          >
            Volver a enviar
          </Button>
        )}
      </Block>
    )
  if (staff && event.pending_games > 0)
    blocks.push(
      <Block key="games" tone="amber">
        <p>
          <b>
            {event.pending_games} mix{event.pending_games === 1 ? "" : "es"}{" "}
            vinculado
            {event.pending_games === 1 ? "" : "s"} por aprobar.
          </b>{" "}
          Ya cuenta{event.pending_games === 1 ? "" : "n"} en la llave, pero sus
          stats no se ven hasta que lo{event.pending_games === 1 ? "" : "s"}{" "}
          apruebes.
        </p>
        <Button size="sm" variant="outline" onClick={() => onTab("matches")}>
          Ver partidas
        </Button>
      </Block>
    )
  if (event.testing)
    blocks.push(
      <Block key="testing" tone="violet">
        <p>
          <b>En fase de testing.</b> Solo lo ven y lo gestionan admins y
          moderadores. No suma al ranking ni manda avisos.
        </p>
        {staff && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPublishing(true)}
          >
            Publicar (sacar de testing)
          </Button>
        )}
      </Block>
    )
  if (!blocks.length) return null
  const error = review.error ?? resubmit.error
  return (
    <div className="flex flex-col gap-2">
      {blocks}
      {error != null && !rejecting && (
        <ErrorAlert message={errorMessage(error)} />
      )}
      <ConfirmDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title={`¿Rechazar «${event.name}»?`}
        description="El organizador ve el motivo, lo corrige y lo vuelve a enviar."
        confirmLabel="Rechazar"
        danger
        reason={{ label: "Motivo (lo ve el organizador)", required: true }}
        pending={review.isPending}
        error={review.error}
        onConfirm={(note) =>
          review.mutate(
            { approve: false, note },
            {
              onSuccess: () => {
                setRejecting(false)
                toast.success("Torneo rechazado.")
              },
            }
          )
        }
      />
      <ConfirmDialog
        open={publishing}
        onOpenChange={setPublishing}
        title="¿Sacarlo de la fase de testing?"
        description={
          event.approval === "approved"
            ? "Lo empiezan a ver todos, con todo lo que tenga. Sus partidas empiezan a sumar al ranking" +
              (event.status === "registration"
                ? " y se anuncia como torneo nuevo."
                : ".")
            : "Sale de testing, pero sigue sin publicarse hasta que se apruebe."
        }
        confirmLabel="Publicar"
        pending={update.isPending}
        error={update.error}
        onConfirm={() =>
          update.mutate(
            { testing: false },
            {
              onSuccess: () => {
                setPublishing(false)
                toast.success("Ya no está en fase de testing.")
              },
            }
          )
        }
      />
    </div>
  )
}

function Block({
  tone,
  children,
}: {
  tone: "amber" | "red" | "violet"
  children: ReactNode
}) {
  const cls = {
    amber: "border-amber-500/40 bg-amber-500/10",
    red: "border-destructive/40 bg-destructive/10",
    violet: "border-violet-500/40 bg-violet-500/10",
  }[tone]
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${cls}`}
    >
      {children}
    </div>
  )
}
