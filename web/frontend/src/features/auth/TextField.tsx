import type { ReactNode } from "react"
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Props<T extends FieldValues> = {
  control: Control<T>
  name: Path<T>
  label: string
  type?: "text" | "email" | "password"
  autoComplete?: string
  placeholder?: string
  description?: ReactNode
  /** Contenido extra debajo del input (por ejemplo, el estado del alias). */
  children?: ReactNode
}

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  description,
  children,
}: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Input
            {...field}
            id={field.name}
            type={type}
            autoComplete={autoComplete}
            placeholder={placeholder}
            aria-invalid={fieldState.invalid}
          />
          {description && <FieldDescription>{description}</FieldDescription>}
          {children}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
