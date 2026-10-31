import { cn } from "cn"
import type { ComponentProps, ReactNode } from "react"
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type FieldProps<T extends FieldValues> = {
  control: Control<T>
  name: Path<T>
  label: ReactNode
  type?: "text" | "email" | "password"
  autoComplete?: string
  placeholder?: string
  /** Muestra el error solo cuando el formulario ya intentó enviarse. */
  showError?: boolean
  children?: ReactNode
  inputProps?: Omit<ComponentProps<typeof Input>, "name" | "type">
}

export function AuthField<T extends FieldValues>({
  control,
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  showError = true,
  children,
  inputProps,
}: FieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const invalid = showError && fieldState.invalid
        const errorId = `${field.name}-error`
        return (
          <Field>
            <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
            <Input
              {...field}
              {...inputProps}
              id={field.name}
              type={type}
              autoComplete={autoComplete}
              placeholder={placeholder}
              aria-invalid={invalid}
              aria-describedby={invalid ? errorId : undefined}
              className={cn(
                "h-9 text-sm dark:bg-transparent",
                inputProps?.className
              )}
            />
            {children}
            {invalid && (
              <FieldError id={errorId}>{fieldState.error?.message}</FieldError>
            )}
          </Field>
        )
      }}
    />
  )
}
