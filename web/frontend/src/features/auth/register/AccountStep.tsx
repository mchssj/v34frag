import { cn } from "cn"
import { useWatch, type Control } from "react-hook-form"

import type { SignupValues } from "@/auth/schemas"
import { AuthField, AuthHeading } from "../ui"
import { passwordLabel, passwordScore } from "./helpers"

export function AccountStep({
  control,
  tried,
}: {
  control: Control<SignupValues>
  /** Los errores se muestran recién después del primer intento de continuar. */
  tried: boolean
}) {
  const password = useWatch({ control, name: "password" })
  const score = passwordScore(password)

  return (
    <>
      <AuthHeading
        size="lg"
        title="Crea tu cuenta"
        subtitle="Con tu email y una contraseña. Te enviaremos un correo para confirmarla."
      />
      <AuthField
        control={control}
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="tu@email.com"
        showError={tried}
      />
      <AuthField
        control={control}
        name="password"
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        placeholder="Mínimo 8 caracteres"
        showError={tried}
      >
        <div className="mt-0.5 flex gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={cn(
                "h-[3px] flex-1 rounded-[2px]",
                i > score
                  ? "bg-muted"
                  : score >= 3
                    ? "bg-win"
                    : "bg-sidebar-primary"
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {passwordLabel(password)}
        </p>
      </AuthField>
    </>
  )
}
