import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { applyFieldErrors } from "@/api/errors"
import { FieldGroup } from "@/components/ui/field"
import { useUpdateProfile } from "@/features/profile/queries"
import {
  filledFields,
  socialsSchema,
  type SocialsValues,
} from "@/features/profile/schemas"
import { FormAlert } from "../FormAlert"
import { TextField } from "../TextField"
import { StepActions } from "./StepActions"

const FIELDS = ["steam", "faceit", "discord"] as const

export function SocialsStep({ onDone }: { onDone: () => void }) {
  const update = useUpdateProfile()
  const [formError, setFormError] = useState<unknown>(null)
  const form = useForm<SocialsValues>({
    resolver: zodResolver(socialsSchema),
    defaultValues: { steam: "", faceit: "", discord: "" },
    mode: "onTouched",
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    const body = filledFields(values)
    if (Object.keys(body).length === 0) return onDone()
    try {
      await update.mutateAsync(body)
      onDone()
    } catch (e) {
      if (!applyFieldErrors(e, form.setError, FIELDS)) setFormError(e)
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <FormAlert error={formError} />
        <TextField
          control={form.control}
          name="steam"
          label="Steam"
          placeholder="SteamID64, link o nombre de perfil"
          description="Solo se muestra en tu perfil. No vincula tu cuenta con el servidor."
        />
        <TextField
          control={form.control}
          name="faceit"
          label="FACEIT"
          placeholder="Nickname o link"
        />
        <TextField
          control={form.control}
          name="discord"
          label="Discord"
          placeholder="Nombre de usuario"
        />
        <StepActions busy={form.formState.isSubmitting} onSkip={onDone} />
      </FieldGroup>
    </form>
  )
}
