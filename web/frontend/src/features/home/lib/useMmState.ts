import { useQuery, useQueryClient } from "@tanstack/react-query"

import { mmStateOptions, useMmSocket } from "@/features/matchmaking/queries"
import { useMmSource } from "@/features/matchmaking/source"

/** Estado del matchmaking de quien mira, con el socket compartido (el mismo que usa el layout). */
export function useMmState() {
  const source = useMmSource()
  const socketUp = useMmSocket(source)
  const { data } = useQuery(mmStateOptions(source, socketUp, useQueryClient()))
  return { source, state: data }
}
