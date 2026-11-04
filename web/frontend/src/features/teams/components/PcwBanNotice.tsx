import { useQuery } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

import { errorFromResponse, networkError } from "@/api/errors"
import { authFetch } from "@/auth/authFetch"
import { env } from "@/lib/env"

// Sanción por abandonar una PCW (replanteo 56). La ruta todavía no está en la OpenAPI del frontend.
async function banUntil(teamId: string, signal?: AbortSignal) {
  let res: Response
  try {
    res = await authFetch(`${env.apiUrl}/api/v1/teams/${teamId}/pcw-ban`, {
      signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e
    throw networkError()
  }
  const body: unknown = await res.json().catch(() => undefined)
  if (!res.ok) throw errorFromResponse(res, body)
  return (body as { until: string | null }).until
}

/** Aviso en la página del equipo mientras no puede crear ni aceptar PCW. */
export function PcwBanNotice({ teamId }: { teamId: string }) {
  const q = useQuery({
    queryKey: ["teams", teamId, "pcw-ban"] as const,
    queryFn: ({ signal }) => banUntil(teamId, signal),
  })
  if (!q.data) return null
  return (
    <p className="rounded-xl bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
      Por abandonar una PCW, el equipo no puede crear ni aceptar PCW hasta el{" "}
      {format(parseISO(q.data), "EEEE d 'de' MMMM, HH:mm", { locale: es })}.
    </p>
  )
}
