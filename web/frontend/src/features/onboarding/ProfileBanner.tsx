import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  ArrowRightIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  UserRoundCheckIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useOnboardingStatus } from "./queries"

/** Aviso del Home mientras falte algún paso de la Bienvenida. No se puede cerrar. */
export function ProfileBanner() {
  const status = useOnboardingStatus()
  if (!status || status.complete) return null

  const items = [
    { label: "Foto y nombre", done: status.photo },
    { label: "Puesto y país", done: status.style },
    { label: "Contactos", done: status.contacts },
    { label: "Jugador vinculado", done: status.linked },
  ]

  return (
    <section
      aria-label="Completa tu perfil"
      className="flex flex-wrap items-center gap-4 rounded-xl border border-[color-mix(in_oklch,var(--primary)_35%,var(--border))] bg-[color-mix(in_oklch,var(--primary)_6%,var(--card))] px-5 py-4 leading-design"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-tile bg-primary/14">
        <UserRoundCheckIcon className="size-5 text-primary" aria-hidden />
      </span>
      <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
        <span className="text-sm font-semibold">
          Completa tu perfil · {status.done} de 4
        </span>
        <ul className="flex flex-wrap gap-3.5 text-[13px]">
          {items.map(({ label, done }) => {
            const Icon = done ? CircleCheckIcon : CircleDashedIcon
            return (
              <li
                key={label}
                className={cn(
                  "inline-flex items-center gap-1.5",
                  done ? "text-win" : "text-muted-foreground"
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                <span>
                  {label}
                  <span className="sr-only">
                    {done ? " (hecho)" : " (pendiente)"}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
      <Button asChild className="px-3.5 text-[13px]">
        <Link to="/welcome">
          Continuar
          <ArrowRightIcon className="size-3.5" aria-hidden />
        </Link>
      </Button>
    </section>
  )
}
