import { CopyIcon, TriangleAlertIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfirmDialog } from "../../components/dialogs"
import { ago } from "../../lib/format"
import { Chip, PanelSection } from "../../components/ui"
import { useNewHudKey, useSetServerHud } from "../api/queries"
import type { AdminServer } from "../types"
import { HUD_PORT_MIN, HUD_PORT_MAX, hudChip, parseHudPort } from "../lib/hud"

export function HudSection({ server }: { server: AdminServer }) {
  const id = useId()
  const hud = server.hud
  const [port, setPort] = useState(hud.port === null ? "" : String(hud.port))
  const [enabled, setEnabled] = useState(hud.enabled)
  const [confirm, setConfirm] = useState<"key" | "remove" | null>(null)
  const [copied, setCopied] = useState(false)
  const save = useSetServerHud()
  const newKey = useNewHudKey()

  const parsed = parseHudPort(port)
  const portErr = "error" in parsed ? parsed.error : null
  const nextPort = "port" in parsed ? parsed.port : null
  const dirty =
    nextPort !== hud.port || (nextPort !== null && enabled !== hud.enabled)
  const chip = hudChip(hud)
  const watching = hud.streaming.map((s) => s.alias).join(", ")

  async function copyCfg() {
    if (!hud.cfg) return
    try {
      await navigator.clipboard.writeText(hud.cfg)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  function saveHud() {
    save.mutate(
      {
        id: server.id,
        port: nextPort,
        enabled: nextPort === null ? false : enabled,
      },
      {
        onSuccess: () =>
          toast.success("HUD guardado. El relay lo toma en 30 segundos."),
      }
    )
  }

  return (
    <PanelSection
      title="HUD para streamers"
      aside={<Chip tone={chip.tone}>{chip.text}</Chip>}
    >
      {hud.port !== null && (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {hud.last_packet_at
            ? `Último paquete ${ago(hud.last_packet_at)}.`
            : "Todavía no llegó ningún paquete."}{" "}
          {watching ? (
            <>
              Transmitiendo ahora:{" "}
              <span className="font-medium text-foreground">{watching}</span>.
            </>
          ) : (
            "Nadie lo está transmitiendo."
          )}{" "}
          Los cambios llegan al relay en 30 segundos.
        </p>
      )}

      {!hud.can_enable && (
        <Alert variant="warning">
          <TriangleAlertIcon aria-hidden />
          <AlertDescription>
            Para activar el HUD, carga arriba la dirección y el puerto de
            SourceTV.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-port`}>Puerto del relay</Label>
          <Input
            id={`${id}-port`}
            inputMode="numeric"
            placeholder={String(HUD_PORT_MIN)}
            value={port}
            onChange={(e) => setPort(e.target.value)}
            aria-invalid={!!portErr}
            className="font-mono text-[13px]"
          />
          <span className="text-xs text-muted-foreground">
            De {HUD_PORT_MIN} a {HUD_PORT_MAX}, uno por servidor. Vacío: sin
            HUD.
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span id={`${id}-state`} className="text-sm leading-none font-medium">
            Estado
          </span>
          <div
            role="radiogroup"
            aria-labelledby={`${id}-state`}
            className="flex gap-1.5"
          >
            {([true, false] as const).map((on) => (
              <Button
                key={String(on)}
                type="button"
                role="radio"
                aria-checked={enabled === on}
                variant={enabled === on ? "default" : "outline"}
                className="flex-1"
                disabled={on && (!hud.can_enable || nextPort === null)}
                onClick={() => setEnabled(on)}
              >
                {on ? "Activo" : "Apagado"}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {hud.cfg && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">
            cfg/sourcemod/csstv_hud.cfg
          </span>
          <pre className="rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
            {hud.cfg}
          </pre>
          <span className="text-xs leading-relaxed text-muted-foreground">
            Súbelas a este servidor: valen desde el próximo cambio de mapa. Un
            cambio de configuración va en todos los servidores en la misma
            tanda.
          </span>
        </div>
      )}

      {(portErr || save.error) && (
        <p role="alert" className="text-sm text-destructive">
          {portErr ?? errorMessage(save.error)}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={saveHud}
          disabled={!!portErr || !dirty || save.isPending}
        >
          Guardar HUD
        </Button>
        {hud.cfg && (
          <Button variant="outline" onClick={() => void copyCfg()}>
            <CopyIcon aria-hidden />
            {copied ? "Copiado" : "Copiar líneas"}
          </Button>
        )}
        {hud.port !== null && (
          <>
            <Button variant="outline" onClick={() => setConfirm("key")}>
              Clave nueva
            </Button>
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirm("remove")}
            >
              Sacar el HUD
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirm === "key"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Clave nueva del HUD para ${server.name}?`}
        description="Hasta que la subas a su csstv_hud.cfg, el relay descarta los paquetes de este servidor."
        confirmLabel="Generar clave"
        pending={newKey.isPending}
        error={newKey.error}
        onConfirm={() =>
          newKey.mutate(server.id, {
            onSuccess: () => {
              setConfirm(null)
              toast.success(
                "Clave nueva. Copia las líneas del cfg al servidor."
              )
            },
          })
        }
      />
      <ConfirmDialog
        open={confirm === "remove"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Sacar el HUD de ${server.name}?`}
        description="El relay deja de atenderlo en 30 segundos y se borra su clave. Los streamers que lo transmitían quedan sin datos."
        confirmLabel="Sacar el HUD"
        danger
        pending={save.isPending}
        error={save.error}
        onConfirm={() =>
          save.mutate(
            { id: server.id, port: null, enabled: false },
            {
              onSuccess: () => {
                setConfirm(null)
                setPort("")
                setEnabled(false)
                toast.success("HUD sacado.")
              },
            }
          )
        }
      />
    </PanelSection>
  )
}
