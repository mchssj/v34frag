import { CircleAlertIcon } from "lucide-react"

import { errorMessage } from "@/api/errors"
import { Alert, AlertDescription } from "@/components/ui/alert"

/** Error general del formulario (el que no corresponde a un campo). */
export function FormAlert({
  error,
  retryIn = 0,
}: {
  error: unknown
  retryIn?: number
}) {
  if (!error) return null
  const text =
    retryIn > 0
      ? `Demasiados intentos. Podrás volver a probar en ${retryIn} s.`
      : errorMessage(error)
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  )
}
