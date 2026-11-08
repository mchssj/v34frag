import { Link } from "@tanstack/react-router"
import { Gamepad2Icon, SwordsIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { ProfileBanner } from "@/features/onboarding/components/ProfileBanner"
import { dateLabel, greeting } from "../lib/home"
import { LevelCard } from "../components/LevelCard"
import { LiveCard } from "../components/LiveCard"
import { RecentCard, UpcomingCard } from "../components/MatchLists"
import { PendingCard } from "../components/PendingCard"
import { PlayCard } from "../components/PlayCard"
import {
  CommunityCard,
  EventsCard,
  TopPlayersCard,
  TopTeamsCard,
} from "../components/SideCards"

// "Para ti" (/home): lo que le toca al jugador ahora (pendientes, jugar, en vivo, próximas) y,
// al costado, torneos y rankings. Cada bloque carga solo (handoff_para_ti, bitácora 2026-11-03).
export function HomePage({ name }: { name: string }) {
  const now = new Date()
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-[-0.5px]">
            {greeting(now)}, {name}
          </h1>
          <p className="text-sm text-muted-foreground">{dateLabel(now)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/matches"
            className={buttonVariants({ variant: "outline" })}
          >
            <SwordsIcon aria-hidden />
            Partidas
          </Link>
          <Link to="/play" className={buttonVariants()}>
            <Gamepad2Icon aria-hidden />
            Jugar
          </Link>
        </div>
      </header>

      <ProfileBanner />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-4">
        <LevelCard />
        <PendingCard className="md:col-span-2" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <PlayCard />
          <LiveCard />
          <UpcomingCard />
          <RecentCard />
        </div>
        <aside className="flex min-w-0 flex-col gap-4">
          <EventsCard />
          <TopTeamsCard />
          <TopPlayersCard />
          <CommunityCard />
        </aside>
      </div>
    </div>
  )
}
