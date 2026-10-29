import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Controller, useForm, type Control } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { adminConfigOptions, useMmAdminMutation } from "../queries"
import { useMmSource } from "../source"
import type { MmAdminConfig } from "../types"

// Administración › Matchmaking › General: todo `mm_config` y los modos (plan, sección 7).

const int = (min: number, max: number) =>
  z.coerce
    .number<string | number>({ message: "Tiene que ser un número" })
    .int("Sin decimales")
    .min(min, `Mínimo ${min}`)
    .max(max, `Máximo ${max}`)

const schema = z
  .object({
    open: z.boolean(),
    modes: z.array(
      z.object({
        mode: z.string(),
        players_per_team: z.number(),
        enabled: z.boolean(),
        affects_elo: z.boolean(),
      })
    ),
    min_mixes: int(0, 100),
    min_account_days: int(0, 365),
    reconnect_minutes: int(1, 10),
    season_queue_close_minutes: int(0, 120),
    max_party_size: int(1, 5),
    party_max_elo_gap: int(0, 3000),
    accept_seconds: int(10, 60),
    veto_seconds: int(5, 60),
    connect_minutes: int(1, 15),
    server_wait_minutes: int(1, 15),
    elo_window_start: int(0, 1000),
    elo_window_step: int(0, 500),
    elo_window_every_s: int(5, 300),
    elo_window_max: int(0, 3000),
    elo_unlimited_after_s: int(30, 3600),
    // "5, 15, 60, 1440": minutos de cada escalón.
    penalty_ladder: z
      .string()
      .regex(/^\s*\d+(\s*,\s*\d+)*\s*$/, "Minutos separados por coma"),
  })
  .refine((v) => v.modes.some((m) => m.enabled), {
    path: ["modes"],
    message: "Tiene que quedar al menos un modo habilitado",
  })
  .refine((v) => v.elo_window_max >= v.elo_window_start, {
    path: ["elo_window_max"],
    message: "No puede ser menor que el inicio",
  })

type Values = z.input<typeof schema>

const toValues = (c: MmAdminConfig): Values => ({
  ...c,
  penalty_ladder: c.penalty_ladder.join(", "),
})

export function GeneralForm() {
  const source = useMmSource()
  const { data } = useQuery(adminConfigOptions(source))
  if (!data) return <Skeleton className="h-96 w-full rounded-xl" />
  return <Form initial={data} />
}

function Form({ initial }: { initial: MmAdminConfig }) {
  const source = useMmSource()
  const save = useMmAdminMutation((c: MmAdminConfig) => source.saveConfig(c))
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: toValues(initial),
    mode: "onTouched",
  })

  const onSubmit = form.handleSubmit((v) =>
    save.mutateAsync(
      {
        ...v,
        penalty_ladder: v.penalty_ladder.split(",").map((x) => Number(x)),
      },
      {
        onSuccess: (saved) => {
          form.reset(toValues(saved))
          toast.success("Configuración guardada")
        },
        onError: (e) => toast.error(errorMessage(e)),
      }
    )
  )

  const c = form.control
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Section
        title="Cola"
        description="Cerrarla impide entrar, sin cancelar las salas armadas."
      >
        <Controller
          control={c}
          name="open"
          render={({ field }) => (
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={field.value} onCheckedChange={field.onChange} />
              {field.value ? "Abierta" : "Cerrada"}
            </label>
          )}
        />
        <Controller
          control={c}
          name="modes"
          render={({ field, fieldState }) => (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[13px] font-medium">Modos</legend>
              <div className="flex flex-wrap gap-4">
                {field.value.map((m, i) => {
                  const set = (patch: Partial<typeof m>) =>
                    field.onChange(
                      field.value.map((x, j) =>
                        j === i ? { ...x, ...patch } : x
                      )
                    )
                  return (
                    <div
                      key={m.mode}
                      className="flex flex-col gap-2 rounded-lg border p-3"
                    >
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Switch
                          checked={m.enabled}
                          onCheckedChange={(on) => set({ enabled: on })}
                        />
                        {m.mode}
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch
                          size="sm"
                          aria-label={`${m.mode} da ELO`}
                          checked={m.affects_elo}
                          onCheckedChange={(on) => set({ affects_elo: on })}
                        />
                        Da ELO
                      </label>
                    </div>
                  )
                })}
              </div>
              {fieldState.error && (
                <p className="text-xs text-destructive">
                  {fieldState.error.message}
                </p>
              )}
            </fieldset>
          )}
        />
      </Section>

      <Section
        title="Quién puede jugar"
        description="Cuentas nuevas: mixes jugados en nuestros servidores y días de cuenta. En 0 no se exige."
      >
        <Grid>
          <NumberField control={c} name="min_mixes" label="Mixes mínimos" />
          <NumberField
            control={c}
            name="min_account_days"
            label="Días de cuenta mínimos"
          />
        </Grid>
      </Section>

      <Section
        title="Grupos"
        description="1 = sin grupos; 2 = dúo. Nunca más que un equipo del modo."
      >
        <Grid>
          <NumberField
            control={c}
            name="max_party_size"
            label="Tamaño máximo del grupo"
          />
          <NumberField
            control={c}
            name="party_max_elo_gap"
            label="Diferencia de ELO máxima en el grupo"
          />
        </Grid>
      </Section>

      <Section title="Tiempos">
        <Grid>
          <NumberField
            control={c}
            name="accept_seconds"
            label="Para aceptar (s)"
          />
          <NumberField
            control={c}
            name="veto_seconds"
            label="Por baneo del veto (s)"
          />
          <NumberField
            control={c}
            name="connect_minutes"
            label="Para conectarse (min)"
          />
          <NumberField
            control={c}
            name="server_wait_minutes"
            label="Esperando servidor (min)"
          />
          <NumberField
            control={c}
            name="reconnect_minutes"
            label="Para volver si se desconecta (min)"
          />
          <NumberField
            control={c}
            name="season_queue_close_minutes"
            label="Cierre de cola antes de la temporada (min)"
          />
        </Grid>
      </Section>

      <Section
        title="Ventana de ELO"
        description="Arranca en el inicio y se abre un paso cada tantos segundos, hasta el tope."
      >
        <Grid>
          <NumberField control={c} name="elo_window_start" label="Inicio (±)" />
          <NumberField control={c} name="elo_window_step" label="Paso" />
          <NumberField control={c} name="elo_window_every_s" label="Cada (s)" />
          <NumberField control={c} name="elo_window_max" label="Tope (±)" />
          <NumberField
            control={c}
            name="elo_unlimited_after_s"
            label="Sin límite después de (s)"
          />
        </Grid>
      </Section>

      <Section
        title="Sanciones"
        description="Minutos de cada escalón; baja uno cada 7 días sin faltas."
      >
        <Controller
          control={c}
          name="penalty_ladder"
          render={({ field, fieldState }) => (
            <div className="flex max-w-sm flex-col gap-1.5">
              <label
                htmlFor="penalty_ladder"
                className="text-[13px] font-medium"
              >
                Escalones (min)
              </label>
              <Input
                {...field}
                id="penalty_ladder"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.error && (
                <p className="text-xs text-destructive">
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />
      </Section>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={!form.formState.isDirty}
          onClick={() => form.reset()}
        >
          Descartar
        </Button>
        <Button
          type="submit"
          disabled={!form.formState.isDirty || save.isPending}
        >
          {save.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  )
}

type NumberName = Exclude<keyof Values, "open" | "modes" | "penalty_ladder">

function NumberField({
  control,
  name,
  label,
}: {
  control: Control<Values>
  name: NumberName
  label: string
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={name} className="text-[13px] font-medium">
            {label}
          </label>
          <Input
            {...field}
            id={name}
            type="number"
            inputMode="numeric"
            aria-invalid={fieldState.invalid}
            className="h-9 font-mono tabular-nums"
          />
          {fieldState.error && (
            <p className="text-xs text-destructive">
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  )
}
