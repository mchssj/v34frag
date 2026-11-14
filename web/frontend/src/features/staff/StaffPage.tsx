import { SiDiscord } from "@icons-pack/react-simple-icons"
import { useQuery, queryOptions } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { HeartIcon } from "lucide-react"
import { useState } from "react"

import { api, unwrap, type Schemas } from "@/api/client"
import { QueryState } from "@/components/brand/QueryState"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { COMMUNITY } from "@/config/site"
import { VipDialog } from "@/features/vip/VipDialog"
import { moderationCount, moderationTeam, type ModRole } from "./moderation"

// La página del Equipo (replanteo 87, bitácora 2026-11-07-pagina-equipo): los admins, los moderadores (con el soporte,
// replanteo 117) y un
// agradecimiento a los VIP. Sale sola del rol de cada cuenta y del VIP activo.

type Staff = Schemas["Staff"]
type Member = Staff["admins"][number]

export const staffOptions = queryOptions({
  queryKey: ["staff"],
  queryFn: () => unwrap(api.GET("/api/v1/staff")),
  staleTime: 5 * 60_000,
})

const monthYear = new Intl.DateTimeFormat("es", {
  month: "short",
  year: "numeric",
})

function SectionHead({ title, count }: { title: string; count: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-xl font-bold">{title}</h2>
      <span className="font-mono text-[13px] text-muted-foreground">
        {count}
      </span>
    </div>
  )
}

function AdminCard({ m }: { m: Member }) {
  return (
    <Card
      variant="outline"
      className="relative flex flex-col gap-4 overflow-hidden p-5"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] bg-primary"
      />
      <div className="flex items-center gap-4">
        <PlayerAvatar
          alias={m.nick}
          photo={m.photo_url}
          className="size-[72px] rounded-xl after:rounded-xl"
          imageClassName="rounded-xl"
          fallbackClassName="rounded-xl text-[28px] font-extrabold"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="truncate text-xl font-bold">{m.nick}</span>
          <Badge variant="primary" size="sm" className="self-start">
            Admin
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/player/$nick"
          params={{ nick: m.nick }}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Ver perfil
        </Link>
        <a
          href={COMMUNITY.discordUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({
            variant: "secondary",
            size: "sm",
            className: "gap-1.5",
          })}
        >
          <SiDiscord aria-hidden size={14} />
          Discord
        </a>
      </div>
    </Card>
  )
}

function ModCard({ m, role }: { m: Member; role: ModRole }) {
  return (
    <Link
      to="/player/$nick"
      params={{ nick: m.nick }}
      className="flex items-center gap-3 rounded-xl border bg-card p-3.5 hover:bg-muted"
    >
      <PlayerAvatar
        alias={m.nick}
        photo={m.photo_url}
        className="size-11 rounded-lg after:rounded-lg"
        imageClassName="rounded-lg"
        fallbackClassName="rounded-lg text-base font-bold"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{m.nick}</span>
        <span className="text-xs text-muted-foreground">
          {role === "support" ? "Soporte" : "Moderador"}
        </span>
      </span>
    </Link>
  )
}

function VipChip({ m }: { m: Staff["vips"][number] }) {
  return (
    <Link
      to="/player/$nick"
      params={{ nick: m.nick }}
      className="inline-flex items-center gap-2.5 rounded-full border border-yellow-500/30 bg-background/60 py-1.5 pr-3.5 pl-1.5 hover:bg-muted"
    >
      <PlayerAvatar
        alias={m.nick}
        photo={m.photo_url}
        className="size-8"
        fallbackClassName="text-[13px]"
      />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">{m.nick}</span>
        <span className="text-[11px] text-muted-foreground">
          VIP desde {monthYear.format(new Date(m.since))}
        </span>
      </span>
    </Link>
  )
}

export function StaffPage() {
  const q = useQuery(staffOptions)
  const [vipOpen, setVipOpen] = useState(false)
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-12 py-4">
      <header className="flex max-w-[720px] flex-col gap-3">
        <span className="text-[13px] font-semibold tracking-[.08em] text-primary uppercase">
          Comunidad
        </span>
        <h1 className="text-4xl leading-tight font-extrabold tracking-tight">
          El equipo de CMLeague
        </h1>
        <p className="text-base text-pretty text-muted-foreground">
          Las personas que mantienen los servidores, la web y los torneos. Si
          necesitas algo, escríbele a cualquiera por Discord.
        </p>
      </header>

      <QueryState q={q}>
        {(s) => (
          <>
            <section className="flex flex-col gap-5">
              <SectionHead
                title="Administración"
                count={`${s.admins.length} ${s.admins.length === 1 ? "admin" : "admins"}`}
              />
              <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
                {s.admins.map((m) => (
                  <AdminCard key={m.player_id} m={m} />
                ))}
              </div>
            </section>

            {moderationTeam(s).length > 0 && (
              <section className="flex flex-col gap-5">
                <SectionHead
                  title="Moderación"
                  count={moderationCount(
                    s.moderators.length,
                    s.supports?.length ?? 0
                  )}
                />
                <div className="grid gap-3 sm:grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
                  {moderationTeam(s).map(({ m, role }) => (
                    <ModCard key={m.player_id} m={m} role={role} />
                  ))}
                </div>
              </section>
            )}

            <section className="flex flex-col gap-5 rounded-2xl border border-yellow-500/25 bg-yellow-500/[.05] p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="flex max-w-[620px] flex-col gap-1.5">
                  <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-yellow-600 dark:text-yellow-300">
                    <HeartIcon aria-hidden className="size-4" />
                    Gracias
                  </span>
                  <h2 className="text-2xl font-extrabold tracking-tight">
                    A los VIP, que sostienen el proyecto
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Su aporte ayuda a que CMLeague siga creciendo. Gracias por
                    apoyar a la comunidad.
                  </p>
                </div>
                <Button
                  className="bg-yellow-400 font-bold text-yellow-950 hover:bg-yellow-300"
                  onClick={() => setVipOpen(true)}
                >
                  Cómo ser VIP
                </Button>
              </div>
              {s.vips.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay VIP para mostrar.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2.5">
                  {s.vips.map((m) => (
                    <li key={m.player_id}>
                      <VipChip m={m} />
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                Ordenados por antigüedad. Si eres VIP, puedes ocultarte de esta
                lista en{" "}
                <Link to="/profile/privacy" className="underline">
                  Mi perfil › Privacidad
                </Link>
                .
              </p>
            </section>
          </>
        )}
      </QueryState>
      <VipDialog open={vipOpen} onOpenChange={setVipOpen} />
    </div>
  )
}
