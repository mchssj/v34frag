import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"

import type { AuthUser } from "@/auth/queries"
import { guidePending, markGuideSeen } from "../lib/guide"
import { GuideDialog } from "./GuideDialog"

/** La guía que se abre sola la primera vez que se llega a la web, después de la Bienvenida. */
export function FirstVisitGuide({ user }: { user: AuthUser }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(() => guidePending(user.id))

  return (
    <GuideDialog
      open={open}
      role={user.role}
      onClose={() => {
        markGuideSeen(user.id)
        setOpen(false)
      }}
      onGo={(href) => void navigate({ href })}
    />
  )
}

/** Botón "Ver la guía" (Ayuda): la misma guía, cuando se quiera. */
export function useGuide(user: AuthUser) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const dialog = (
    <GuideDialog
      open={open}
      role={user.role}
      onClose={() => {
        markGuideSeen(user.id)
        setOpen(false)
      }}
      onGo={(href) => void navigate({ href })}
    />
  )
  return { open: () => setOpen(true), dialog }
}
