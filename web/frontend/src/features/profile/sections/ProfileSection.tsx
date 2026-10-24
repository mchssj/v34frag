import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import {
  AtSignIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  LockIcon,
} from "lucide-react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { errorMessage, isApiError } from "@/api/errors"
import { useMe } from "@/auth/queries"
import { CountryFlag } from "@/components/brand/CountryFlag"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useAliasStatus } from "@/features/auth/register/useAliasStatus"
import { AuthField, ErrorAlert } from "@/features/auth/ui"
import { aliasFeedback } from "../alias"
import { AvatarPicker } from "../AvatarPicker"
import { myProfileOptions, useChangeAlias, useUpdateProfile } from "../queries"
import {
  COUNTRIES,
  GAME_ROLES,
  personalSchema,
  type PersonalValues,
} from "../schemas"
import { CardFooter, CardTitle, SectionCard } from "../ui"

export function ProfileSection() {
  const user = useMe().data
  const profile = useQuery(myProfileOptions)
  if (!user || !profile.data)
    return profile.isError ? (
      <ErrorAlert message={errorMessage(profile.error)} />
    ) : (
      <Spinner className="size-6 text-muted-foreground" />
    )
  return (
    <>
      <AliasCard current={user.tag ?? ""} />
      <DataCard
        email={user.email ?? ""}
        alias={user.tag ?? "J"}
        details={profile.data.details}
      />
    </>
  )
}

const ICON = {
  at: AtSignIcon,
  ok: CircleCheckIcon,
  error: CircleXIcon,
  lock: LockIcon,
}
const TONE = {
  muted: "text-muted-foreground",
  win: "text-win",
  destructive: "text-destructive",
}

function AliasCard({ current }: { current: string }) {
  const [value, setValue] = useState(current)
  const [dates, setDates] = useState<{
    changed: string | null
    next: string | null
  }>({
    changed: null,
    next: null,
  })
  const [apiError, setApiError] = useState<string | null>(null)
  const change = useChangeAlias()
  const same = value.trim().toLowerCase() === current.toLowerCase()
  // El propio alias figuraría como "en uso": no se consulta mientras no cambie.
  const state = useAliasStatus(same ? "" : value)
  const fb = aliasFeedback({
    value,
    current,
    state,
    changedAt: dates.changed,
    nextChangeAt: dates.next,
  })
  const locked = fb.icon === "lock"
  const Icon = ICON[fb.icon]

  async function save() {
    setApiError(null)
    try {
      const result = await change.mutateAsync(value.trim())
      setDates({ changed: result.changed_at, next: result.next_change_at })
      setValue(result.alias)
      toast(`Alias cambiado a ${result.alias}`)
    } catch (e) {
      setApiError(
        isApiError(e) && e.code === "CONFLICT"
          ? "Ese alias ya está en uso."
          : errorMessage(e)
      )
    }
  }

  return (
    <SectionCard className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-start gap-3">
        <CardTitle
          className="min-w-[220px] flex-1"
          title="Alias"
          description="Tu nombre en toda la web: ranking, planteles, chat. En el juego puedes usar el que quieras."
        />
        {fb.chip && (
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs text-muted-foreground">
            <ClockIcon className="size-3" aria-hidden />
            {fb.chip}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <div className="relative">
            <Input
              aria-label="Alias"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setApiError(null)
              }}
              maxLength={24}
              disabled={locked}
              aria-invalid={fb.tone === "destructive" || !!apiError}
              aria-describedby="alias-msg"
              className={cn(
                "h-9 pr-9 font-medium dark:bg-transparent",
                fb.tone === "win" && "border-win",
                locked && "bg-muted"
              )}
            />
            <Icon
              aria-hidden
              className={cn("absolute top-2.5 right-2.5 size-4", TONE[fb.tone])}
            />
          </div>
          <p
            id="alias-msg"
            aria-live="polite"
            className={cn(
              "text-xs",
              apiError ? "text-destructive" : TONE[fb.tone]
            )}
          >
            {apiError ?? fb.message}
          </p>
        </div>
        <Button
          className="h-9 px-3.5 text-[13px]"
          disabled={!fb.canSave || change.isPending}
          onClick={() => void save()}
        >
          Cambiar alias
        </Button>
      </div>
    </SectionCard>
  )
}

const NONE = "__none__"

function DataCard({
  email,
  alias,
  details,
}: {
  email: string
  alias: string
  details: {
    avatar_url: string | null
    real_name: string | null
    country: string | null
    game_role: string | null
  } | null
}) {
  const update = useUpdateProfile()
  const form = useForm<PersonalValues>({
    resolver: zodResolver(personalSchema),
    values: {
      real_name: details?.real_name ?? "",
      country: (details?.country ?? "") as PersonalValues["country"],
      game_role: (details?.game_role ?? "") as PersonalValues["game_role"],
    },
  })

  const save = form.handleSubmit(async (v) => {
    try {
      await update.mutateAsync({
        real_name: v.real_name || null,
        country: v.country || null,
        game_role: v.game_role || null,
      })
      toast("Perfil guardado")
    } catch {
      // Se muestra con ErrorAlert.
    }
  })

  return (
    <SectionCard>
      <form onSubmit={save} noValidate>
        <div className="flex flex-col gap-[18px] p-5">
          <AvatarPicker
            url={details?.avatar_url}
            initial={alias.slice(0, 1).toUpperCase()}
            size="md"
            title="Avatar"
            hint="JPEG, PNG o WebP · máximo 1 MB. Se recorta a 256×256."
          />
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[13px] font-medium">
                Email
              </label>
              <Input
                id="email"
                value={email}
                disabled
                className="h-[34px] bg-muted"
              />
            </div>
            <AuthField
              control={form.control}
              name="real_name"
              label="Nombre real"
              autoComplete="name"
              inputProps={{ maxLength: 60, className: "h-[34px]" }}
            />
            <SelectField
              id="country"
              label="País"
              control={form.control}
              name="country"
              options={COUNTRIES}
              withFlags
            />
            <SelectField
              id="game_role"
              label="Puesto preferido"
              control={form.control}
              name="game_role"
              options={GAME_ROLES}
            />
          </div>
          {update.error != null && (
            <ErrorAlert message={errorMessage(update.error)} />
          )}
        </div>
        <CardFooter>
          <Button
            type="submit"
            className="text-[13px]"
            disabled={update.isPending}
          >
            Guardar cambios
          </Button>
        </CardFooter>
      </form>
    </SectionCard>
  )
}

function SelectField({
  id,
  label,
  control,
  name,
  options,
  withFlags,
}: {
  id: string
  label: string
  control: ReturnType<typeof useForm<PersonalValues>>["control"]
  name: "country" | "game_role"
  options: readonly string[]
  withFlags?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          // Radix no admite "" como valor de un ítem: "sin elegir" usa NONE.
          <Select
            value={field.value || NONE}
            onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
          >
            <SelectTrigger
              id={id}
              className="w-full text-sm data-[size=default]:h-[34px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin elegir</SelectItem>
              {options.map((o) => (
                <SelectItem key={o} value={o}>
                  {withFlags ? (
                    <span className="flex items-center gap-2">
                      <CountryFlag country={o as (typeof COUNTRIES)[number]} />
                      {o}
                    </span>
                  ) : (
                    o
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  )
}
