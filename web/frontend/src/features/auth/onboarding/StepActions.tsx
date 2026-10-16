import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function StepActions({
  busy,
  onSkip,
  submitLabel = "Guardar y seguir",
  disabled = false,
}: {
  busy: boolean
  onSkip: () => void
  submitLabel?: string
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="ghost" onClick={onSkip} disabled={busy}>
        Omitir
      </Button>
      <Button type="submit" disabled={busy || disabled}>
        {busy && <Spinner />}
        {submitLabel}
      </Button>
    </div>
  )
}
