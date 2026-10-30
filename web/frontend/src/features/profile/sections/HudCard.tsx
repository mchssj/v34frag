import { CastIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog, SecretDialog } from "@/features/admin/dialogs"
import { fmtDate } from "@/features/admin/format"
import { useNewHudLink, type MyProfile } from "../queries"
import { CardTitle, SectionCard } from "../ui"

type Link = { hud_url: string; control_url: string }

/** HUD para OBS (bitácora 2026-10-29-frontend-hud): solo para cuentas con la marca de streamer. */
export function HudCard({
  streamer,
}: {
  streamer: NonNullable<MyProfile["streamer"]>
}) {
  const create = useNewHudLink()
  const [confirm, setConfirm] = useState(false)
  const [link, setLink] = useState<Link | null>(null)

  const generate = () =>
    create.mutate(undefined, {
      onSuccess: (l) => {
        setConfirm(false)
        setLink(l)
      },
    })

  return (
    <SectionCard>
      <div className="flex flex-wrap items-center gap-3.5 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted">
          <CastIcon className="size-[18px]" aria-hidden />
        </span>
        <CardTitle
          className="min-w-[180px] flex-1"
          title="HUD para OBS"
          description={
            streamer.has_link
              ? `Streamer desde el ${fmtDate(streamer.since)}. Tu link es del ${fmtDate(streamer.link_created_at)}.`
              : `Streamer desde el ${fmtDate(streamer.since)}. Genera tu link para usarlo en OBS: se muestra una sola vez.`
          }
        />
        <Button
          variant={streamer.has_link ? "outline" : "default"}
          className="text-[13px]"
          disabled={create.isPending}
          onClick={() => (streamer.has_link ? setConfirm(true) : generate())}
        >
          {streamer.has_link ? "Generar otro link" : "Generar mi link"}
        </Button>
      </div>
      <p className="border-t px-5 py-3.5 text-[13px] leading-relaxed text-pretty text-muted-foreground">
        En OBS, agrega una fuente{" "}
        <b className="font-semibold text-foreground">Navegador</b> encima de la
        captura del juego, de 1920 × 1080 y con «Apagar la fuente cuando no está
        visible» sin marcar. El servidor y el jugador enfocado se eligen en el
        panel.
      </p>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="¿Generar otro link?"
        description="El que tienes ahora deja de andar en 30 segundos: hay que cambiarlo en OBS."
        confirmLabel="Generar otro"
        pending={create.isPending}
        error={create.error}
        onConfirm={generate}
      />
      <SecretDialog
        open={link !== null}
        title="Tu link del HUD"
        intro="El primero va en la fuente Navegador de OBS. El segundo es tu panel: ahí eliges el servidor y a quién enfocar. Funcionan como una contraseña: no los muestres en pantalla."
        blocks={
          link
            ? [
                { label: "OBS (fuente Navegador)", text: link.hud_url },
                { label: "Panel", text: link.control_url },
              ]
            : []
        }
        doneLabel="Ya los guardé"
        onDone={() => setLink(null)}
      />
    </SectionCard>
  )
}
