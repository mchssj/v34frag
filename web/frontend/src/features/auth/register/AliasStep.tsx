import { cn } from "cn"
import { Controller, type Control } from "react-hook-form"

import type { SignupValues } from "@/auth/schemas"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { Input } from "@/components/ui/input"
import { AuthHeading } from "../ui"
import { ALIAS_LABEL, type AliasState } from "./useAliasStatus"

export function AliasStep({
  control,
  state,
}: {
  control: Control<SignupValues>
  state: AliasState
}) {
  const label = ALIAS_LABEL[state]
  const good = state === "available"
  const bad = state === "taken" || state === "short" || state === "blocked"

  return (
    <>
      <AuthHeading
        size="lg"
        title="Elige tu alias"
        subtitle="Tu único nombre en la web: ranking, planteles y chat. Lo puedes cambiar una vez cada 15 días."
      />
      <Controller
        control={control}
        name="tag"
        render={({ field }) => {
          const alias = field.value.trim()
          return (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="tag" className="text-[13px] font-medium">
                  Alias
                </label>
                <div className="relative">
                  <Input
                    {...field}
                    id="tag"
                    maxLength={24}
                    autoComplete="nickname"
                    placeholder="Ej. Tormenta"
                    aria-invalid={bad}
                    aria-describedby="tag-state tag-help"
                    className={cn(
                      "h-10 pr-[90px] pl-3 font-mono text-base font-semibold md:text-base dark:bg-transparent",
                      good &&
                        "border-win focus-visible:border-win focus-visible:ring-win/30",
                      bad && "border-destructive"
                    )}
                  />
                  <span
                    id="tag-state"
                    aria-live="polite"
                    className={cn(
                      "absolute top-1/2 right-2.5 -translate-y-1/2 text-xs font-medium",
                      good ? "text-win" : "text-destructive",
                      state === "checking" && "text-muted-foreground"
                    )}
                  >
                    {state === "checking" ? "…" : label}
                  </span>
                </div>
                <p id="tag-help" className="text-xs text-muted-foreground">
                  {field.value.length}/24 ·{" "}
                  {state === "blocked"
                    ? "contiene una palabra no permitida"
                    : "entre 2 y 24 caracteres, único en la web"}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">
                  Así te verán
                </span>
                <div className="flex items-center gap-3 rounded-tile border bg-card px-3.5 py-3">
                  <span
                    aria-hidden
                    className="grid size-10 place-items-center rounded-full bg-secondary font-semibold"
                  >
                    {(alias[0] ?? "?").toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold">
                      {alias || "Tu alias"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Nuevo jugador · empieza con 1000 ELO
                    </span>
                  </span>
                  <LevelBadge level={4} />
                </div>
              </div>
            </>
          )
        }}
      />
    </>
  )
}
