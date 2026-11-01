import { createFileRoute } from "@tanstack/react-router"

import { redirectIfSignedIn } from "@/auth/guards"
import { CountryFlag } from "@/components/brand/CountryFlag"
import { CompetitionSection } from "@/features/landing/CompetitionSection"
import { Hero } from "@/features/landing/Hero"
import { HowItWorks } from "@/features/landing/HowItWorks"
import { LandingHeader } from "@/features/landing/LandingHeader"
import { ServersSection } from "@/features/landing/ServersSection"

// Solo visitantes: con sesión se va a /home.
export const Route = createFileRoute("/")({
  beforeLoad: redirectIfSignedIn,
  component: Landing,
})

function Landing() {
  return (
    <div className="flex min-h-svh flex-col bg-background leading-design text-foreground">
      <LandingHeader />
      <main className="flex flex-col">
        <Hero />
        <HowItWorks />
        <ServersSection />
        <CompetitionSection />
      </main>
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
    </div>
  )
}
