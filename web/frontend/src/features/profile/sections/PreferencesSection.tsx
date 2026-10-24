import { TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { THEME_MODES } from "@/components/brand/ThemeSwitch"
import { useTheme } from "@/components/theme-provider"
import { THEME_FX_OPTIONS, useThemeFxPref } from "@/features/theme-fx/pref"
import { errorMessage } from "@/api/errors"
import { useMediaQuery } from "@/lib/useMediaQuery"
import { useUpdateProfile } from "../queries"
import { CardTitle, SectionCard, Segmented } from "../ui"

/** Tema y efectos al cambiar de tema (handoff de efectos, sección Preferencias). */
export function PreferencesSection() {
  const { theme, setTheme } = useTheme()
  const [fx, setFx] = useThemeFxPref()
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)")
  const update = useUpdateProfile()

  // Se aplica enseguida en el navegador y se guarda en la cuenta; si falla, vuelve atrás.
  async function pickFx(value: NonNullable<typeof fx>) {
    const previous = fx
    setFx(value)
    try {
      await update.mutateAsync({ preferences: { theme_fx: value } })
      toast("Preferencia guardada")
    } catch (e) {
      setFx(previous)
      toast.error(errorMessage(e))
    }
  }

  return (
    <SectionCard className="px-5 py-1">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b py-4">
        <CardTitle
          className="min-w-[200px] flex-1"
          title="Tema"
          description="Apariencia de la web en este dispositivo."
        />
        <Segmented
          label="Tema"
          value={theme}
          options={THEME_MODES}
          onChange={setTheme}
        />
      </div>
      <div className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle
            className="min-w-[200px] flex-1"
            title="Efectos al cambiar de tema"
            description="Flashbang al pasar a claro, smoke al pasar a oscuro."
          />
          <Segmented
            label="Efectos al cambiar de tema"
            // Sin preferencia guardada se marca "Con sonido", sin guardarlo.
            value={fx ?? "full"}
            options={THEME_FX_OPTIONS}
            onChange={(v) => void pickFx(v)}
            disabled={reduced}
          />
        </div>
        {reduced && (
          <p className="text-[13px] text-muted-foreground">
            Desactivado por la configuración de movimiento reducido de tu
            sistema.
          </p>
        )}
        <p
          role="note"
          className="flex items-start gap-2 rounded-lg bg-muted p-3 text-[13px] leading-[1.45] text-pretty"
        >
          <TriangleAlertIcon
            className="mt-px size-[15px] shrink-0 text-primary"
            aria-hidden
          />
          <span>
            <strong className="font-semibold">
              Aviso de fotosensibilidad:
            </strong>{" "}
            los efectos incluyen un destello blanco a pantalla completa. Si
            tienes epilepsia fotosensible o eres sensible a destellos de luz, te
            recomendamos desactivarlos.
          </span>
        </p>
      </div>
    </SectionCard>
  )
}
