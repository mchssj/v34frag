import { useNavigate } from "@tanstack/react-router"
import type { PlayerMatch } from "../../types"

export function Delta({ v }: { v: number | null }) {
  if (v === null) return <span className="text-muted-foreground">—</span>
  return (
    <span className={v >= 0 ? "text-win" : "text-destructive"}>
      {v > 0 ? `+${v}` : v}
    </span>
  )
}

export const RESULT_CHIP = {
  V: "bg-win/18 text-win",
  D: "bg-destructive/15 text-destructive",
  E: "bg-muted text-muted-foreground",
}

export function useOpenMatch() {
  const navigate = useNavigate()
  return (m: PlayerMatch) =>
    void navigate({ to: "/match/$id", params: { id: m.match_id } })
}
