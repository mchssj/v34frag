import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { CrownIcon } from "lucide-react"
import { playerDetailOptions } from "@/features/profile/api/queries"
import { formatNumber } from "@/features/public/lib/format"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { teamStarOptions } from "../api/queries"
import { Eyebrow } from "./ui"

// --- Jugador estrella ----------------------------------------------------

export function StarPlayer({ teamId }: { teamId: string }) {
  const star = useQuery(teamStarOptions(teamId)).data
  const detail = useQuery({
    ...playerDetailOptions(star?.id ?? ""),
    enabled: !!star,
  }).data
  if (!star) return null
  const stats = detail?.stats
  const fmt = (v: number | null | undefined, digits = 2) =>
    v === null || v === undefined ? "—" : v.toFixed(digits)
  const rows = [
    { k: "Rating", v: fmt(star.rating) },
    { k: "K/D", v: fmt(star.kd) },
    { k: "ADR", v: fmt(stats?.adr, 0) },
    { k: "HS", v: stats?.hs == null ? "—" : `${Math.round(stats.hs)}%` },
  ]
  const meta = [
    detail?.details?.game_role,
    star.level ? `Nivel ${star.level}` : null,
    star.elo ? `${formatNumber(star.elo)} ELO` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <section className="relative overflow-hidden rounded-hero border border-primary/35 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_10%,var(--card)),var(--card)_60%)] p-5">
      <Eyebrow className="flex items-center gap-1.5 text-primary">
        <CrownIcon className="size-3.5" aria-hidden />
        Jugador estrella
      </Eyebrow>
      <Link
        to="/player/$nick"
        params={{ nick: star.alias }}
        className="mt-3 flex items-center gap-3.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <PlayerAvatar
          alias={star.alias}
          photo={star.photo_url}
          className="size-16"
          fallbackClassName="bg-primary text-2xl font-bold text-primary-foreground"
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-2xl font-bold tracking-[-0.5px]">
            {star.alias}
          </span>
          {meta && (
            <span className="text-sm text-muted-foreground">{meta}</span>
          )}
        </span>
      </Link>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map((r) => (
          <div
            key={r.k}
            className="flex flex-col-reverse gap-0.5 rounded-lg bg-muted/70 px-2.5 py-2"
          >
            <dt className="text-[11px] text-muted-foreground">{r.k}</dt>
            <dd className="font-mono text-[15px] font-semibold">{r.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
