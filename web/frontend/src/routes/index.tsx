import { createFileRoute } from "@tanstack/react-router"

import { redirectIfSignedIn } from "@/auth/guards"
import { SiteFooter } from "@/components/brand/SiteFooter"
import { CompetitionSection } from "@/features/landing/components/CompetitionSection"
import { Hero } from "@/features/landing/components/Hero"
import { HowItWorks } from "@/features/landing/components/HowItWorks"
import { LandingHeader } from "@/features/landing/components/LandingHeader"
import { ServersSection } from "@/features/landing/components/ServersSection"

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
      <SiteFooter />
    </div>
  )
}
