import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

import { Logo } from "@/components/brand/Logo"
import { Button } from "@/components/ui/button"

export type SideCopy = { title: string; subtitle: string } | null

type Swap =
  | { label: string; to: "/login" | "/register" }
  | { label: string; onClick: () => void }

/**
 * Layout de Login, Registro y Bienvenida: formulario a la izquierda y panel con imagen a la
 * derecha (baja debajo del formulario en pantallas angostas).
 */
export function AuthShell({
  swap,
  side,
  children,
}: {
  swap: Swap
  side: SideCopy
  children: ReactNode
}) {
  return (
    <div className="grid min-h-svh grid-cols-[repeat(auto-fit,minmax(min(100%,480px),1fr))] bg-background leading-design text-foreground">
      <div className="flex min-w-0 flex-col gap-6 px-8 py-7">
        <header className="flex items-center justify-between">
          <Link to="/" aria-label="CSSTV, ir al inicio" className="rounded-lg">
            <Logo />
          </Link>
          {"to" in swap ? (
            <Button asChild variant="ghost" className="text-[13px]">
              <Link to={swap.to} search={{}}>
                {swap.label}
              </Link>
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="text-[13px]"
              onClick={swap.onClick}
            >
              {swap.label}
            </Button>
          )}
        </header>

        <main className="flex flex-1 items-center justify-center">
          {children}
        </main>

        <p className="text-center text-xs text-muted-foreground">
          Al continuar aceptas las reglas de la comunidad.
        </p>
      </div>

      {/* La imagen ambiental está pendiente: por ahora el panel queda en `muted`. */}
      <aside className="relative min-h-80 border-l bg-muted">
        {side && (
          <div className="absolute inset-x-7 bottom-7 flex flex-col gap-2.5 rounded-xl border bg-background/90 p-[18px] backdrop-blur-[8px]">
            <p className="text-[15px] leading-[1.4] font-semibold text-pretty">
              {side.title}
            </p>
            <p className="text-[13px] text-muted-foreground">{side.subtitle}</p>
          </div>
        )}
      </aside>
    </div>
  )
}
