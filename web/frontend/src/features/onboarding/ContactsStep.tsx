import { EyeIcon } from "lucide-react"
import type { Control } from "react-hook-form"

import { AuthHeading } from "@/features/auth/ui"
import {
  ContactFields,
  WELCOME_CONTACTS,
} from "@/features/profile/ContactFields"
import type { SocialsInput, SocialsValues } from "@/features/profile/schemas"
import { Greeting } from "./Greeting"

/** Paso "Contactos": Discord, Steam y FACEIT, todos opcionales. */
export function ContactsStep({
  control,
  greetAlias,
}: {
  control: Control<SocialsInput, unknown, SocialsValues>
  greetAlias: string | null
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        {greetAlias && <Greeting alias={greetAlias} />}
        <AuthHeading
          size="lg"
          title="¿Dónde te encuentran?"
          subtitle="Los capitanes usan estos datos para invitarte a PCW y mixes. Completa los que uses."
        />
      </div>
      <ContactFields
        control={control}
        rows={WELCOME_CONTACTS}
        layout="stacked"
      />
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <EyeIcon className="size-3.5 shrink-0" aria-hidden />
        Visibles para usuarios con sesión iniciada. Cámbialo desde Mi perfil.
      </p>
    </>
  )
}
