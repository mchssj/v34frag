import { CircleCheckIcon } from "lucide-react"

/** Chip del primer paso que se ve en la Bienvenida. */
export function Greeting({ alias }: { alias: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-win">
      <CircleCheckIcon className="size-3.5" aria-hidden />
      Email confirmado · hola, {alias}
    </span>
  )
}
