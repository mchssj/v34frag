import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"

import { applyFieldErrors } from "@/api/errors"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUpdateProfile } from "@/features/profile/queries"
import {
  COUNTRIES,
  GAME_ROLES,
  filledFields,
  personalSchema,
  type PersonalValues,
} from "@/features/profile/schemas"
import { FormAlert } from "../FormAlert"
import { TextField } from "../TextField"
import { StepActions } from "./StepActions"

const FIELDS = ["real_name", "country", "game_role"] as const

export function PersonalStep({ onDone }: { onDone: () => void }) {
  const update = useUpdateProfile()
  const [formError, setFormError] = useState<unknown>(null)
  const form = useForm<PersonalValues>({
    resolver: zodResolver(personalSchema),
    defaultValues: { real_name: "", country: "", game_role: "" },
    mode: "onTouched",
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    const body = filledFields(values)
    // Sin datos no se llama a la API (el PATCH exige al menos un campo).
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
          name="real_name"
          label="Nombre real"
          autoComplete="name"
        />
        <ListField
          control={form.control}
          name="country"
          label="País"
          options={COUNTRIES}
        />
        <ListField
          control={form.control}
          name="game_role"
          label="Rol en el juego"
          options={GAME_ROLES}
        />
        <StepActions busy={form.formState.isSubmitting} onSkip={onDone} />
      </FieldGroup>
    </form>
  )
}

function ListField({
  control,
  name,
  label,
  options,
}: {
  control: ReturnType<typeof useForm<PersonalValues>>["control"]
  name: "country" | "game_role"
  label: string
  options: readonly string[]
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          {/* Radix Select no admite "" como valor: vacío = sin elegir. */}
          <Select
            value={field.value || undefined}
            onValueChange={field.onChange}
          >
            <SelectTrigger id={name} aria-invalid={fieldState.invalid}>
              <SelectValue placeholder="Sin especificar" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
