import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"
import { isApiError } from "@/api/errors"
import { COUNTRIES } from "@/features/profile/lib/schemas"
import type { WidgetPeriod } from "./options"
import type { WidgetData } from "./StreamWidget"

// Datos del widget para OBS: GET /api/v1/players/{id}/widget (replanteo 110, bitácora
// 2026-11-10-widget-streamers-en-main). Se piden cada minuto, también con la pestaña en segundo plano,
// porque OBS no la tiene "visible".

export const REFRESH_MS = 60_000

/** El período del widget (en la URL, en español) como lo pide la API. */
export const API_PERIOD = {
  hoy: "today",
  "24h": "24h",
  temporada: "season",
  historico: "all",
} as const satisfies Record<WidgetPeriod, string>

/** Medianoche de hoy en la hora de la PC del streamer, en ISO: el "desde" de "Hoy". */
export function localMidnight(now = new Date()) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

const isCountry = (c: string | null): c is (typeof COUNTRIES)[number] =>
  c !== null && (COUNTRIES as readonly string[]).includes(c)

/** La respuesta de la API con el país solo si es uno de la lista (la bandera necesita uno conocido). */
export function toWidgetData(r: Schemas["WidgetData"]): WidgetData {
  return { ...r, country: isCountry(r.country) ? r.country : null }
}

export const widgetKeys = {
  data: (id: string, period: WidgetPeriod) => ["widget", id, period] as const,
}

export function widgetDataOptions(
  id: string,
  period: WidgetPeriod,
  enabled = true
) {
  return queryOptions({
    queryKey: widgetKeys.data(id, period),
    enabled,
    queryFn: ({ signal }): Promise<WidgetData> =>
      unwrap(
        api.GET("/api/v1/players/{id}/widget", {
          params: {
            path: { id },
            query:
              period === "hoy"
                ? { period: "today", since: localMidnight() }
                : { period: API_PERIOD[period] },
          },
          signal,
        })
      ).then(toWidgetData),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: true,
    // Al cambiar de período se ve el anterior hasta que llega el nuevo. Si falla una consulta, Query deja lo
    // último que llegó.
    placeholderData: keepPreviousData,
    staleTime: REFRESH_MS / 2,
    retry: (failures, e) => failures < 2 && !isApiError(e, "NOT_FOUND"),
  })
}
