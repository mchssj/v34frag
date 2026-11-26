import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { useMe } from "@/auth/queries"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CardTitle, SectionCard } from "@/features/profile/components/ui"
import { catalogOptions } from "@/features/shop/api"
import { inLauncher, launcherSetTheme } from "@/lib/launcher"
import { useLauncherPrefs } from "../lib/useLauncherPrefs"

const OFF = "off"
const PROFILE = "profile"

/**
 * Solo dentro del launcher: qué tema de la tienda usa el launcher. Lista solo los que tienes; no cambia tu perfil ni
 * la web en el navegador.
 */
export function LauncherThemeCard() {
  const launcher = inLauncher()
  const [prefs, setPrefs] = useLauncherPrefs()
  const me = useMe().data
  const themes =
    useQuery({
      ...catalogOptions(me?.id ?? null),
      enabled: launcher,
    }).data?.items.filter((i) => i.kind === "theme" && i.owned) ?? []

  if (!launcher || !prefs) return null

  const value = !prefs.shop_theme ? OFF : (prefs.shop_theme_id ?? PROFILE)
  const pick = async (v: string) => {
    try {
      setPrefs(await launcherSetTheme(v === OFF ? null : v))
      toast("Tema del launcher guardado")
    } catch {
      toast.error("No se pudo guardar el tema del launcher")
    }
  }

  return (
    <SectionCard className="px-5 py-1">
      <div className="flex flex-wrap items-center justify-between gap-4 py-4">
        <CardTitle
          className="min-w-[200px] flex-1"
          title="Tema del launcher"
          description="Uno de los temas de la tienda que tienes, solo en el launcher. No cambia tu perfil ni la web en el navegador."
        />
        <Select value={value} onValueChange={(v) => void pick(v)}>
          <SelectTrigger className="w-56" aria-label="Tema del launcher">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={OFF}>Sin tema</SelectItem>
            <SelectItem value={PROFILE}>El de mi perfil</SelectItem>
            {themes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </SectionCard>
  )
}
