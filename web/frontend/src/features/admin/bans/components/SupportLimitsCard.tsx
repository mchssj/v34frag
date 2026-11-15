import { useQuery } from "@tanstack/react-query"
import { useId, useState } from "react"
import { toast } from "sonner"

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
import { fmtDateTime } from "../../lib/format"
import { QueryError } from "../../components/ui"
import { banLimitsOptions, useSaveBanLimits } from "../api/queries"
import { supportLimitsText } from "../lib/bans"
import type { BanLimitsInput } from "../types"

// Administración › Baneos › Actividad del soporte: los límites de los baneos del soporte (replanteo 121, bitácora
// 2026-11-14-limites-baneo-soporte). El moderador los ve; solo un admin los cambia. La base los hace cumplir.

type Key = keyof BanLimitsInput
const FIELDS: { key: Key; label: string; min: number; max: number }[] = [
  { key: "max_minutes", label: "Minutos máximos", min: 1, max: 1440 },
  { key: "max_bans", label: "Baneos por jugador", min: 1, max: 20 },
  { key: "window_days", label: "En cuántos días", min: 1, max: 90 },
]

const valid = (v: string, min: number, max: number) => {
  const n = Number(v)
  return v.trim() !== "" && Number.isInteger(n) && n >= min && n <= max
}

export function SupportLimitsCard({ canEdit }: { canEdit: boolean }) {
  const id = useId()
  const limits = useQuery(banLimitsOptions())
  const save = useSaveBanLimits()
  // Lo que se cambió en el formulario; lo demás muestra lo guardado. Al guardar, vuelve a lo guardado.
  const [edits, setEdits] = useState<Partial<Record<Key, string>>>({})
  const data = limits.data
  const form: Record<Key, string> | null = data
    ? {
        max_minutes: edits.max_minutes ?? String(data.max_minutes),
        max_bans: edits.max_bans ?? String(data.max_bans),
        window_days: edits.window_days ?? String(data.window_days),
      }
    : null

  const allValid =
    !!form && FIELDS.every((f) => valid(form[f.key], f.min, f.max))
  const changed =
    !!form && !!data && FIELDS.some((f) => Number(form[f.key]) !== data[f.key])

  function submit() {
    if (!form || !allValid) return
    save.mutate(
      {
        max_minutes: Number(form.max_minutes),
        max_bans: Number(form.max_bans),
        window_days: Number(form.window_days),
      },
      {
        onSuccess: () => {
          setEdits({})
          toast.success("Límites del soporte guardados.")
        },
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Límites del soporte</CardTitle>
        <CardDescription>
          {limits.data
            ? `Hoy el soporte banea ${supportLimitsText(limits.data)}. `
            : ""}
          {canEdit
            ? "Los baneos que ya están puestos no cambian: los límites nuevos valen para los baneos nuevos y para los cambios."
            : "Solo un admin los cambia."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {limits.isError ? (
          <QueryError
            error={limits.error}
            onRetry={() => void limits.refetch()}
          />
        ) : !form ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {FIELDS.map((f) => {
                const ok = valid(form[f.key], f.min, f.max)
                return (
                  <div key={f.key} className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`${id}-${f.key}`}
                      className="text-[13px] font-medium"
                    >
                      {f.label}
                    </label>
                    <Input
                      id={`${id}-${f.key}`}
                      type="number"
                      inputMode="numeric"
                      min={f.min}
                      max={f.max}
                      step={1}
                      disabled={!canEdit || save.isPending}
                      aria-invalid={!ok}
                      value={form[f.key]}
                      onChange={(e) =>
                        setEdits({ ...edits, [f.key]: e.target.value })
                      }
                      className="h-9 font-mono tabular-nums"
                    />
                    <p
                      className={
                        ok
                          ? "text-xs text-muted-foreground"
                          : "text-xs text-destructive"
                      }
                    >
                      De {f.min} a {f.max}
                    </p>
                  </div>
                )
              })}
            </div>
            {canEdit && (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  onClick={submit}
                  disabled={!allValid || !changed || save.isPending}
                >
                  Guardar
                </Button>
                {save.isError && (
                  <span className="text-xs text-destructive">
                    {errorMessage(save.error)}
                  </span>
                )}
              </div>
            )}
            {limits.data?.updated_at && (
              <p className="text-xs text-muted-foreground">
                Último cambio: {fmtDateTime(limits.data.updated_at)}
                {limits.data.updated_by?.alias
                  ? `, por ${limits.data.updated_by.alias}`
                  : ""}
                .
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
