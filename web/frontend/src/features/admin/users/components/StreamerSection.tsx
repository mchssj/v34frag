import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { fmtDate } from "../../lib/format"
import { Chip, PanelSection } from "../../components/ui"
import {
  streamerOptions,
  useGrantStreamer,
  useRevokeStreamer,
} from "../api/queries"
import type { AdminUser } from "../types"

/** La marca de streamer del HUD (bitácora 2026-10-29-frontend-hud), con el mismo patrón que el VIP. */
export function StreamerSection({ u }: { u: AdminUser }) {
  const detail = useQuery(streamerOptions(u.id, u.alias))
  const grant = useGrantStreamer(u.id)
  const revoke = useRevokeStreamer(u.id)
  const [confirm, setConfirm] = useState<"grant" | "revoke" | null>(null)
  const s = detail.data
  const active = u.streamer

  const line = active
    ? [
        s?.granted_by ? `Se la dio ${s.granted_by}.` : null,
        s?.has_link
          ? `Generó su link el ${fmtDate(s.link_created_at)}.`
          : "Todavía no generó su link.",
        "Quitarla corta su link en 30 segundos; si se la vuelves a dar, tiene que generar uno nuevo.",
      ]
        .filter(Boolean)
        .join(" ")
    : `${s?.revoked_at ? `Se la quitaron el ${fmtDate(s.revoked_at)}. ` : ""}Con la marca puede generar su link de OBS desde Mi perfil y transmitir cualquier servidor con el HUD activo.`

  return (
    <PanelSection
      title="Streamer del HUD"
      aside={
        active ? (
          <Chip tone="primary">
            {s ? `Desde el ${fmtDate(s.granted_at)}` : "Streamer"}
          </Chip>
        ) : (
          <Chip>No</Chip>
        )
      }
    >
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {line} Se le avisa a la cuenta.
      </p>
      <div className="flex flex-wrap gap-2">
        {active ? (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirm("revoke")}
          >
            Quitar streamer
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setConfirm("grant")}>
            Dar streamer
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirm === "grant"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Darle la marca de streamer a ${u.alias}?`}
        description="Podrá generar su link de OBS desde Mi perfil. Se le avisa a la cuenta."
        confirmLabel="Dar streamer"
        pending={grant.isPending}
        error={grant.error}
        onConfirm={() =>
          grant.mutate(undefined, {
            onSuccess: () => {
              setConfirm(null)
              toast.success(`${u.alias} ya es streamer.`)
            },
          })
        }
      />
      <ConfirmDialog
        open={confirm === "revoke"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Quitarle la marca de streamer a ${u.alias}?`}
        description="Su link deja de andar en 30 segundos. Se le avisa a la cuenta."
        confirmLabel="Quitar streamer"
        danger
        pending={revoke.isPending}
        error={revoke.error}
        onConfirm={() =>
          revoke.mutate(undefined, {
            onSuccess: () => {
              setConfirm(null)
              toast.success("Marca de streamer quitada.")
            },
          })
        }
      />
    </PanelSection>
  )
}
