import type { ReactNode } from "react"
import { Controller, type Control } from "react-hook-form"

import { BrandTile, type Brand } from "@/components/brand/BrandTile"
import { Input } from "@/components/ui/input"
import { AuthField } from "@/features/auth/ui"
import type { SocialsInput, SocialsValues } from "./schemas"

type Row = {
  brand: Brand
  name: keyof SocialsInput
  label: string
  placeholder: string
  help: string
}

type ContactControl = Control<SocialsInput, unknown, SocialsValues>

/**
 * Discord, Steam (link del perfil, informativo) y FACEIT, cada uno con su ícono. `stacked`
 * (Bienvenida): label e input en columna. `inline` (Mi perfil): nombre y ayuda a la izquierda,
 * input a la derecha.
 */
export function ContactFields({
  control,
  rows,
  layout,
}: {
  control: ContactControl
  rows: Row[]
  layout: "stacked" | "inline"
}) {
  if (layout === "inline")
    return rows.map((row) => (
      <InlineRow key={row.name} row={row} control={control} />
    ))

  return (
    <div className="flex flex-col rounded-tile border bg-card">
      {rows.map((row) => (
        <div
          key={row.name}
          className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3 border-t px-4 py-3.5 first:border-t-0"
        >
          <BrandTile brand={row.brand} />
          <AuthField
            control={control}
            name={row.name}
            label={row.label}
            placeholder={row.placeholder}
          >
            <Help>{row.help}</Help>
          </AuthField>
        </div>
      ))}
    </div>
  )
}

function Help({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-xs text-muted-foreground">
      {children}
    </p>
  )
}

function InlineRow({ row, control }: { row: Row; control: ContactControl }) {
  const helpId = `${row.name}-help`
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-t px-5 py-4">
      <BrandTile brand={row.brand} className="size-9" />
      <Controller
        control={control}
        name={row.name}
        render={({ field, fieldState }) => (
          <>
            <span className="flex min-w-40 flex-1 flex-col gap-0.5">
              <label htmlFor={row.name} className="text-sm font-medium">
                {row.label}
              </label>
              <Help id={helpId}>{row.help}</Help>
            </span>
            <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-1">
              <Input
                {...field}
                id={row.name}
                placeholder={row.placeholder}
                aria-invalid={fieldState.invalid}
                aria-describedby={helpId}
                className="h-[34px] dark:bg-transparent"
              />
              {fieldState.error && (
                <span role="alert" className="text-xs text-destructive">
                  {fieldState.error.message}
                </span>
              )}
            </span>
          </>
        )}
      />
    </div>
  )
}

const STEAM_PLACEHOLDER = "steamcommunity.com/id/tu-perfil"

/** Textos de las filas en la Bienvenida y en Mi perfil. */
export const WELCOME_CONTACTS: Row[] = [
  {
    brand: "discord",
    name: "discord",
    label: "Discord",
    placeholder: "Ej. zeta.cs",
    help: "Tu nombre de usuario, sin el #.",
  },
  {
    brand: "steam",
    name: "steam",
    label: "Steam",
    placeholder: STEAM_PLACEHOLDER,
    help: "El link de tu perfil de Steam. Es solo informativo: tu jugador se vincula en el siguiente paso.",
  },
  {
    brand: "faceit",
    name: "faceit",
    label: "FACEIT",
    placeholder: "Nick o link",
    help: "Muestra tu nivel FACEIT en tu perfil.",
  },
]

export const PROFILE_CONTACTS: Row[] = [
  {
    brand: "steam",
    name: "steam",
    label: "Steam",
    placeholder: STEAM_PLACEHOLDER,
    help: "El link de tu perfil",
  },
  {
    brand: "discord",
    name: "discord",
    label: "Discord",
    placeholder: "Ej. zeta.cs",
    help: "Tu nombre de usuario, sin el #",
  },
  {
    brand: "faceit",
    name: "faceit",
    label: "FACEIT",
    placeholder: "Nick o link",
    help: "Muestra tu nivel FACEIT en tu ficha",
  },
]
