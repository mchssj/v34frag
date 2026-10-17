import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { ArrowRightIcon, MenuIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { THEME_MODES, ThemeSwitch } from "@/components/brand/ThemeSwitch"
import { Wordmark } from "@/components/brand/Wordmark"
import { useTheme } from "@/components/theme-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMediaQuery } from "@/lib/useMediaQuery"
import { scrollToSection, scrollToTop, type SectionId } from "./scroll"

const LINKS: { label: string; id: SectionId }[] = [
  { label: "Cómo funciona", id: "como-funciona" },
  { label: "Servidores", id: "servidores" },
  { label: "Competencia", id: "competencia" },
]

const WIDE = "(min-width: 1000px)"
const focusRing = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
const menuItem = "h-[38px] px-3"

/** Barra flotante de la landing. Por debajo de 1000px la nav pasa a un menú desplegable. */
export function LandingHeader() {
  const [open, setOpen] = useState(false)
  // Menos de 640px: el tema e "Iniciar sesión" no entran en la barra y van al menú.
  const roomy = useMediaQuery("(min-width: 640px)")
  const { theme, setTheme } = useTheme()

  // Al pasar a ≥ 1000px el botón del menú se oculta: el menú no puede quedar abierto.
  useEffect(() => {
    const mq = window.matchMedia(WIDE)
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false)
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  return (
    <header className="sticky top-0 z-20 px-4 pt-3.5">
      <div className="relative mx-auto flex h-14 max-w-[1260px] items-center gap-3 rounded-[var(--radius)] border bg-background/85 pr-2 pl-[18px] shadow-[0_1px_2px_rgb(0_0_0/.04),0_8px_24px_-12px_rgb(0_0_0/.12)] backdrop-blur-md">
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="CSSTV, volver arriba"
          className={cn(
            "flex shrink-0 items-baseline gap-2 rounded-lg whitespace-nowrap",
            focusRing
          )}
        >
          <Wordmark className="text-base tracking-[-0.4px]" />
          <span className="hidden text-sm text-muted-foreground min-[1000px]:inline">
            Counter-Strike Source
          </span>
        </button>

        <nav
          aria-label="Secciones"
          className="ml-auto hidden shrink-0 gap-1 min-[1000px]:flex"
        >
          {LINKS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => scrollToSection(l.id)}
              className={cn(
                "h-9 rounded-lg px-3 text-sm whitespace-nowrap transition-colors hover:bg-accent",
                focusRing
              )}
            >
              {l.label}
            </button>
          ))}
        </nav>
        <span aria-hidden className="ml-auto min-[1000px]:hidden" />

        {roomy && (
          <>
            <ThemeSwitch className="shrink-0" />
            <Link
              to="/login"
              search={{}}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded-lg px-1.5 text-sm font-medium whitespace-nowrap transition-colors hover:text-primary",
                focusRing
              )}
            >
              Iniciar sesión
            </Link>
          </>
        )}

        <Link
          to="/register"
          search={{}}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-2.5 rounded-lg bg-primary pr-4 pl-4 text-sm font-semibold whitespace-nowrap text-primary-foreground transition-colors hover:bg-primary/90 min-[360px]:pr-[5px]",
            focusRing
          )}
        >
          Crear cuenta
          {/* El chip de la flecha no entra en pantallas de menos de 360px. */}
          <span
            aria-hidden
            className="hidden size-[30px] place-items-center rounded-[calc(var(--radius)-4px)] bg-black/15 min-[360px]:grid"
          >
            <ArrowRightIcon className="size-3.5" />
          </span>
        </Link>

        <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-lg border bg-background min-[1000px]:hidden",
                focusRing
              )}
            >
              {open ? (
                <XIcon className="size-4" aria-hidden />
              ) : (
                <MenuIcon className="size-4" aria-hidden />
              )}
            </button>
          </DropdownMenuTrigger>
          {/* Alineado al borde derecho de la barra (pr-2) y 8px debajo de ella. */}
          <DropdownMenuContent
            align="end"
            alignOffset={-8}
            sideOffset={15}
            className="w-auto min-w-[220px] rounded-[var(--radius)] p-1.5 shadow-lg"
          >
            {LINKS.map((l) => (
              <DropdownMenuItem
                key={l.id}
                className={menuItem}
                onSelect={() => scrollToSection(l.id)}
              >
                {l.label}
              </DropdownMenuItem>
            ))}
            {!roomy && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className={menuItem}>
                  <Link to="/login" search={{}}>
                    Iniciar sesión
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="px-3">Tema</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={theme}
                  onValueChange={(v) =>
                    setTheme(v as (typeof THEME_MODES)[number]["value"])
                  }
                >
                  {THEME_MODES.map(({ value, label, icon: Icon }) => (
                    <DropdownMenuRadioItem
                      key={value}
                      value={value}
                      className="h-[38px] pl-3"
                    >
                      <Icon aria-hidden />
                      {label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
