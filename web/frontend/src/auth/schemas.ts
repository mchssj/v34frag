import { z } from "zod"

// Mismas reglas que web/backend/src/schemas/auth.ts y el contrato (sección 2).

export const emailField = z
  .string()
  .trim()
  .min(1, "Escribe tu email.")
  .max(254, "El email puede tener hasta 254 caracteres.")
  .pipe(z.email("El email no es válido."))

export const newPasswordField = z
  .string()
  .min(6, "La contraseña tiene que tener al menos 6 caracteres.")
  .max(72, "La contraseña puede tener hasta 72 caracteres.")

export const aliasField = z
  .string()
  .trim()
  .min(2, "El alias tiene que tener al menos 2 caracteres.")
  .max(24, "El alias puede tener hasta 24 caracteres.")
  .refine((v) => !/[<>]/.test(v), "El alias no puede tener < ni >.")

export const loginSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(1, "Escribe tu contraseña.")
    .max(72, "La contraseña puede tener hasta 72 caracteres."),
  remember: z.boolean(),
})
export type LoginValues = z.infer<typeof loginSchema>

export const signupSchema = z.object({
  email: emailField,
  password: newPasswordField,
  tag: aliasField,
})
export type SignupValues = z.infer<typeof signupSchema>
