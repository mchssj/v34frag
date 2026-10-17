import { createFileRoute } from "@tanstack/react-router"

import { redirectIfSignedIn } from "@/auth/guards"
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
          <span>CSSTV · Comunidad de Counter-Strike: Source</span>
          <span className="ml-auto">
            Proyecto de la comunidad, sin relación con Valve.
          </span>
        </div>
      </footer>
    </div>
  )
}
