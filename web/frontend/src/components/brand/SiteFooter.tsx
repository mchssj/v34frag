import { Link } from "@tanstack/react-router"

import { CountryFlag } from "@/components/brand/CountryFlag"

const footerLink = "underline-offset-2 hover:text-foreground hover:underline"

/** Pie de las páginas públicas (landing y legales). */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-4 p-6 text-[13px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          CM League · Comunidad de Counter-Strike: Source
          <CountryFlag
            country="Argentina"
            label="Bandera de Argentina"
            className="ml-0.5"
          />
          <CountryFlag country="Colombia" label="Bandera de Colombia" />
        </span>
        <nav aria-label="Legales" className="flex gap-4">
          <Link to="/terminos" className={footerLink}>
            Términos y condiciones
          </Link>
          <Link to="/privacidad" className={footerLink}>
            Privacidad
          </Link>
        </nav>
        <span className="ml-auto">
          Proyecto de la comunidad, sin relación con Valve.
        </span>
        {/* Atribución que pide la licencia CC BY 3.0 de los íconos de juego (components/icons/game.tsx). */}
        <span className="w-full text-xs">
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
