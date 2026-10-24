import {
  CrosshairIcon,
  FootprintsIcon,
  MegaphoneIcon,
  ShieldIcon,
  TargetIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CountryFlag } from "@/components/brand/CountryFlag"
import { AuthHeading } from "@/features/auth/ui"
import { Greeting } from "./Greeting"
import { COUNTRIES, GAME_ROLES } from "@/features/profile/schemas"

export type GameRole = (typeof GAME_ROLES)[number]
export type Country = (typeof COUNTRIES)[number]

// Los 6 puestos del handoff ("Otro" queda para Mi perfil).
const ROLES: { value: GameRole; hint: string; icon: LucideIcon }[] = [
  { value: "IGL", hint: "Lidera las llamadas", icon: MegaphoneIcon },
  { value: "AWPer", hint: "Francotirador", icon: CrosshairIcon },
  { value: "Entry fragger", hint: "Abre los sitios", icon: ZapIcon },
  { value: "Rifler", hint: "Línea principal", icon: TargetIcon },
  { value: "Support", hint: "Utilidad y trade", icon: ShieldIcon },
  { value: "Lurker", hint: "Flancos y timing", icon: FootprintsIcon },
]

export function PlayStyleStep({
  greetAlias,
  role,
  country,
  onRole,
  onCountry,
}: {
  /** Alias para el saludo, si este es el primer paso que se ve. */
  greetAlias: string | null
  role: GameRole
  country: Country
  onRole: (role: GameRole) => void
  onCountry: (country: Country) => void
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        {greetAlias && <Greeting alias={greetAlias} />}
        <AuthHeading
          size="lg"
          title="¿Cómo juegas?"
          subtitle="Ayuda a los capitanes a encontrarte para sus PCW. Es opcional."
        />
      </div>

      <fieldset>
        <legend className="sr-only">Puesto preferido</legend>
        <div className="grid grid-cols-3 gap-2">
          {ROLES.map(({ value, hint, icon: Icon }) => (
            <label
              key={value}
              className="flex cursor-pointer flex-col items-start gap-2 rounded-tile border bg-card p-3 text-left transition-colors hover:bg-muted/50 has-checked:border-primary has-checked:bg-primary/8 has-checked:ring-1 has-checked:ring-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input
                type="radio"
                name="game_role"
                value={value}
                checked={role === value}
                onChange={() => onRole(value)}
                className="sr-only"
              />
              <Icon className="size-[18px]" aria-hidden />
              <span className="text-[13px] font-semibold hyphens-auto">
                {value}
              </span>
              <span className="text-[11px] leading-[1.35] hyphens-auto text-muted-foreground">
                {hint}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="country" className="text-[13px] font-medium">
          País
        </label>
        <Select value={country} onValueChange={(v) => onCountry(v as Country)}>
          <SelectTrigger
            id="country"
            className="w-full text-sm data-[size=default]:h-9"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>
                <span className="flex items-center gap-2">
                  <CountryFlag country={c} />
                  {c}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  )
}
