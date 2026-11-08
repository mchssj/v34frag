import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CrosshairIcon,
  MessageCircleIcon,
} from "lucide-react"

import { SectionHeading } from "@/components/brand/SectionHeading"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { DISCORD } from "@/config/site"
import {
  discordCountsOptions,
  serverStatusOptions,
} from "@/features/public/api/queries"
import { formatNumber, SERVER_MODE } from "@/features/public/lib/format"
import type { ServerStatus } from "@/features/public/types"

// Sección "Juega" del inicio (plan docs/bitacora/2026-11-07-jugadas-landing-emparejamiento, diseño en el artifact
// LsFJh5Q1zPyTFqVpoJSvii): la partida se busca desde la web. Los servidores quedan como prueba de vida, con su nombre
// público y sin "Conectar". El inicio solo lo ven visitantes (con sesión redirige a /home).

const STEPS = [
  {
    n: "01",
    title: "Entra a la cola",
    text: "Elige el modo y la región. Te avisamos con un sonido cuando se arma la sala.",
  },
  {
    n: "02",
    title: "Acepta y vetá el mapa",
    text: "Los capitanes banean por turnos hasta que queda uno.",
  },
  {
    n: "03",
    title: "Conéctate y juega",
    text: "Un clic al servidor. Las estadísticas, la demo, los clips y el ELO llegan solos.",
  },
]

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number | undefined
  tone?: "win"
}) {
  return (
    <div className="flex flex-col-reverse gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-mono text-2xl font-bold tracking-[-1px]",
          tone === "win" && "text-win"
        )}
      >
        {value === undefined ? (
          <Skeleton className="h-8 w-10" />
        ) : (
          formatNumber(value)
        )}
      </dd>
    </div>
  )
}

function MatchmakingCard({ open }: { open: boolean | undefined }) {
  return (
    <Card
      variant="outline"
      radius="hero"
      className="flex flex-col gap-6 p-6 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-tile bg-muted text-primary">
            <CrosshairIcon className="size-[22px]" aria-hidden />
          </span>
          <div className="flex flex-col gap-0.5">
            <h3 className="text-lg font-bold">Matchmaking 5v5</h3>
            <p className="text-[13px] text-muted-foreground">
              Solo o con un amigo · equipos parejos por ELO y rating
            </p>
          </div>
        </div>
        {open !== undefined && (
          <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span
              className={cn(
                "size-2 rounded-full",
                open ? "bg-win" : "bg-muted-foreground"
              )}
              aria-hidden
            />
            {open ? "Cola abierta" : "Cola cerrada por ahora"}
          </span>
        )}
      </div>

      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="flex flex-col gap-2 rounded-tile bg-muted/60 p-4"
          >
            <span className="font-mono text-xs text-primary">{s.n}</span>
            <span className="text-[15px] font-semibold">{s.title}</span>
            <span className="text-[13px] leading-normal text-muted-foreground">
              {s.text}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="lg" className="gap-2 font-semibold">
          <Link to="/register" search={{}}>
            Buscar partida
            <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="font-semibold">
          <Link to="/login" search={{ redirect: "/play" }}>
            Ya tengo cuenta
          </Link>
        </Button>
        <span className="text-[13px] text-muted-foreground">
          Crear la cuenta es gratis.
        </span>
      </div>
    </Card>
  )
}

/** Qué pasa en el servidor: un mix en vivo, su modo o que no responde. */
function serverState(s: ServerStatus): { text: string; live: boolean } {
  if (!s.online) return { text: "Fuera de línea", live: false }
  if (s.live_matches > 0)
    return {
      text:
        s.live_matches === 1
          ? "Partida en vivo"
          : `${s.live_matches} partidas en vivo`,
      live: true,
    }
  return { text: (s.mode && SERVER_MODE[s.mode]) || "En línea", live: false }
}

function ServerLine({ server }: { server: ServerStatus }) {
  const state = serverState(server)
  return (
    <li className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 border-t py-2.5 text-sm">
      <span className="flex min-w-0 items-center gap-2.5 font-semibold">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            server.online ? "bg-win" : "bg-muted-foreground"
          )}
          role="img"
          aria-label={server.online ? "En línea" : "Fuera de línea"}
        />
        <span className="truncate">{server.name}</span>
      </span>
      <span className="truncate font-mono text-[13px] text-muted-foreground">
        {server.map ?? "—"}
      </span>
      <span
        className={cn(
          "truncate text-[13px]",
          state.live ? "text-win" : "text-muted-foreground"
        )}
      >
        {state.text}
      </span>
      <span className="text-right font-mono text-[13px]">
        {server.players !== null && server.max_players !== null
          ? `${server.players}/${server.max_players}`
          : "—"}
      </span>
    </li>
  )
}

function ServersCard() {
  const status = useQuery(serverStatusOptions)
  const servers = status.data?.servers ?? []
  return (
    <Card
      variant="outline"
      radius="hero"
      className="flex flex-col gap-2 px-6 py-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Ahora en los servidores</h3>
        {status.data && (
          <span className="text-xs text-muted-foreground">
            {status.data.totals.online}/{status.data.totals.servers} en línea
          </span>
        )}
      </div>
      {status.isPending && (
        <div className="flex flex-col gap-2 pt-1" aria-busy>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      )}
      {status.isError && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
          <span className="text-muted-foreground">
            No pudimos consultar los servidores.
          </span>
          <Button
            variant="outline"
            className="text-[13px]"
            onClick={() => void status.refetch()}
          >
            Reintentar
          </Button>
        </div>
      )}
      {servers.length > 0 && (
        <ul aria-label="Servidores">
          {servers.map((s) => (
            <ServerLine key={s.id} server={s} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function DiscordCard() {
  const counts = useQuery(discordCountsOptions).data
  const numbers =
    counts && counts.online !== null && counts.members !== null
      ? { online: counts.online, members: counts.members }
      : null
  return (
    <div className="flex flex-[1_1_300px] flex-col overflow-hidden rounded-hero bg-[oklch(0.42_0.17_275)] text-white">
      <div className="flex flex-1 flex-col gap-4 p-6">
        <span className="grid size-11 place-items-center rounded-tile bg-white/14">
          <MessageCircleIcon className="size-[22px]" aria-hidden />
        </span>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xl font-bold tracking-[-0.4px]">
            Únete al Discord
          </h3>
          <p className="text-sm leading-normal text-pretty text-white/78">
            Avisos de la cola, torneos, PCW y soporte. Ahí te enteras primero
            cuando se arma algo.
          </p>
        </div>
        {numbers && (
          <dl className="flex gap-5">
            <div className="flex flex-col-reverse gap-0.5">
              <dt className="text-xs text-white/70">en línea</dt>
              <dd className="flex items-center gap-1.5 font-mono text-xl font-bold">
                <span
                  className="size-2 rounded-full bg-[oklch(0.8_0.17_150)]"
                  aria-hidden
                />
                {formatNumber(numbers.online)}
              </dd>
            </div>
            <div className="flex flex-col-reverse gap-0.5">
              <dt className="text-xs text-white/70">miembros</dt>
              <dd className="font-mono text-xl font-bold">
                {formatNumber(numbers.members)}
              </dd>
            </div>
          </dl>
        )}
        <ul className="mt-auto flex flex-col gap-0.5">
          {DISCORD.channels.map((c) => (
            <li
              key={c}
              className="flex h-[30px] items-center gap-2 rounded-[calc(var(--radius)-4px)] bg-white/8 px-2.5 font-mono text-xs font-medium"
            >
              <span className="text-white/50" aria-hidden>
                #
              </span>
              {c}
            </li>
          ))}
        </ul>
      </div>
      <div className="px-6 pb-6">
        <Button
          asChild
          size="md"
          className="w-full bg-white text-sm font-semibold text-[oklch(0.35_0.17_275)] hover:bg-white/90"
        >
          <a href={DISCORD.inviteUrl} target="_blank" rel="noopener noreferrer">
            Unirse al servidor
            <ArrowUpRightIcon className="size-3.5" aria-hidden />
          </a>
        </Button>
      </div>
    </div>
  )
}

export function ServersSection() {
  const status = useQuery(serverStatusOptions)
  const totals = status.data?.totals

  return (
    <section
      id="servidores"
      aria-labelledby="servidores-title"
      className="scroll-mt-[60px] border-y bg-sidebar"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 py-[72px]">
        <SectionHeading
          id="servidores-title"
          eyebrow="Juega"
          title="Tu próxima partida, a un clic."
          aside={
            <dl className="flex flex-wrap items-center gap-5">
              <Stat label="en la cola" value={totals?.in_queue} />
              <Separator
                orientation="vertical"
                className="h-9 data-vertical:self-center"
              />
              <Stat
                label="partidas en vivo"
                value={totals?.live_matches}
                tone="win"
              />
              <Separator
                orientation="vertical"
                className="h-9 data-vertical:self-center"
              />
              <Stat label="jugando ahora" value={totals?.players} />
            </dl>
          }
        />
        <p className="-mt-4 max-w-[600px] text-[15px] leading-[1.55] text-pretty text-muted-foreground">
          Entras a la cola desde la web, el sistema arma equipos parejos y te da
          el servidor listo. Sin buscar IPs ni esperar a que se llene un mix.
        </p>
        <div className="flex flex-wrap items-stretch gap-5">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
            <MatchmakingCard open={status.data?.mm_open} />
            <ServersCard />
          </div>
          <DiscordCard />
        </div>
      </div>
    </section>
  )
}
