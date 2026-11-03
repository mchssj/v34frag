import { Link } from "@tanstack/react-router"

import { BrandLockup } from "@/components/brand/Brand"
import { CountryFlag } from "@/components/brand/CountryFlag"
import { Eyebrow } from "@/components/brand/SectionHeading"

const columnLink =
  "w-fit rounded-md text-sm font-semibold text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"

/** Pie de las páginas públicas (landing y legales). */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 p-6 text-[13px] text-muted-foreground">
        <div className="flex flex-wrap justify-between gap-8">
          <div className="flex max-w-[420px] flex-col gap-3">
            <Link
              to="/"
              aria-label="CM League, ir al inicio"
              className="w-fit rounded-lg"
            >
              <BrandLockup className="h-7" />
            </Link>
            <span className="inline-flex items-center gap-1.5">
              Comunidad de Counter-Strike: Source
              <CountryFlag
                country="Argentina"
                label="Bandera de Argentina"
                className="ml-0.5"
              />
              <CountryFlag country="Colombia" label="Bandera de Colombia" />
            </span>
            <span>Proyecto de la comunidad, sin relación con Valve.</span>
          </div>

          <nav aria-label="Legal" className="flex min-w-[160px] flex-col gap-3">
            <Eyebrow>Legal</Eyebrow>
            <Link to="/ayuda" className={columnLink}>
              Ayuda
            </Link>
            <Link to="/terminos" className={columnLink}>
              Términos
            </Link>
            <Link to="/privacidad" className={columnLink}>
              Privacidad
            </Link>
          </nav>
        </div>

        {/* Atribución que pide la licencia CC BY 3.0 de los íconos de juego (components/icons/game.tsx). */}
        <span className="border-t pt-4 text-xs">
          Íconos de juego:{" "}
          <a
            href="https://game-icons.net"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            game-icons.net
          </a>{" "}
          (CC BY 3.0).
        </span>
      </div>
    </footer>
  )
}
