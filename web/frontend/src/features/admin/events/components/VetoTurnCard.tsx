import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorFromResponse, errorMessage, networkError } from "@/api/errors"
import { authFetch } from "@/auth/authFetch"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { env } from "@/lib/env"

// Segundos por turno del veto (replanteo 56): corren desde que el organizador inicia la partida. Si un turno vence,
// la base elige un mapa al azar. La ruta todavía no está en la OpenAPI del frontend: authFetch directo.

async function call<T>(
  path: string,
  init?: RequestInit
): Promise<T | undefined> {
  let res: Response
  try {
    res = await authFetch(`${env.apiUrl}${path}`, init)
  } catch {
    throw networkError()
  }
  const body: unknown =
    res.status === 204 ? undefined : await res.json().catch(() => undefined)
  if (!res.ok) throw errorFromResponse(res, body)
  return body as T
}

export const VETO_MIN = 15
export const VETO_MAX = 120

export function VetoTurnCard({ eventId }: { eventId: string }) {
  const id = useId()
  const qc = useQueryClient()
  const key = ["admin", "events", eventId, "veto-turn"] as const
  const q = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await call<{ seconds: number }>(`/api/v1/events/${eventId}/veto-turn`))!,
  })
  // Borrador: null mientras no se toca el campo (muestra el guardado).
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? (q.data ? String(q.data.seconds) : "")
  const save = useMutation({
    mutationFn: (seconds: number) =>
      call<void>(`/api/v1/events/${eventId}/veto-turn`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds }),
      }),
    onSuccess: () => {
      setDraft(null)
      toast.success("Tiempo del veto guardado.")
      void qc.invalidateQueries({ queryKey: key })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const n = Number(value)
  const valid = Number.isInteger(n) && n >= VETO_MIN && n <= VETO_MAX
  const dirty = q.data !== undefined && n !== q.data.seconds

  return (
    <Card variant="outline" className="flex flex-col gap-3 px-4 py-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>Segundos por turno del veto</Label>
        <p className="text-xs text-muted-foreground">
          Corren desde que inicias la partida en un servidor. Si un capitán no
          veta a tiempo, se elige un mapa al azar. De {VETO_MIN} a {VETO_MAX}{" "}
          segundos; 30 por defecto.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={VETO_MIN}
          max={VETO_MAX}
          className="w-24"
          value={value}
          aria-invalid={value !== "" && !valid}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          size="md"
          disabled={!valid || !dirty || save.isPending}
          onClick={() => save.mutate(n)}
        >
          Guardar
        </Button>
      </div>
    </Card>
  )
}
