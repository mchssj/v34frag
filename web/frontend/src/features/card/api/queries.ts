import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import { isApiError } from "@/api/errors"
import type { CardPeriod } from "../types"

/** Las stats de mi tarjeta en un período. */
export function cardOptions(period: CardPeriod) {
  return queryOptions({
    queryKey: ["my-card", period] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/me/card", { params: { query: { period } }, signal })
      ),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: (failures, e) => failures < 2 && !isApiError(e, "PLAYER_NOT_LINKED"),
  })
}
