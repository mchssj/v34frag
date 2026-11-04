import { CircleAlertIcon } from "lucide-react"

/** Error general del formulario, con acción opcional (por ejemplo "Reintentar"). */
export function ErrorAlert({
  message,
  action,
}: {
  message: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div
      role="alert"
      className="flex gap-2.5 rounded-lg border border-destructive/40 bg-destructive/8 px-3 py-2.5 text-[13px] text-destructive"
    >
      <CircleAlertIcon className="mt-px size-4 shrink-0" aria-hidden />
      <div className="flex flex-1 flex-col gap-1">
        <span>{message}</span>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="self-start text-xs font-semibold underline"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
