import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"

import { myProfileOptions } from "@/features/profile/queries"
import { getThemeFxPref, setThemeFxPref } from "./pref"

/**
 * Con sesión, la preferencia de la cuenta manda sobre la del navegador; si la cuenta todavía no
 * eligió (`null`), queda la del navegador (contrato, `preferences.theme_fx`). Así, al cerrar
 * sesión la landing usa la de la cuenta.
 */
export function useSyncThemeFx() {
  const fromAccount = useQuery({
    ...myProfileOptions,
    select: (p) => p.preferences.theme_fx,
  }).data

  useEffect(() => {
    if (fromAccount && fromAccount !== getThemeFxPref())
      setThemeFxPref(fromAccount)
  }, [fromAccount])
}
