import { useQuery } from "@tanstack/react-query"

import { myProfileOptions } from "@/features/profile/api/queries"

/** Si la cuenta es VIP hoy. Es solo para la vista: la API y la base lo vuelven a mirar. */
export function useVip() {
  const q = useQuery(myProfileOptions)
  return { ready: !q.isPending, vip: !!q.data?.vip?.active }
}
