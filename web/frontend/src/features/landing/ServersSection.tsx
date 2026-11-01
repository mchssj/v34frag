import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import {
  ArrowUpRightIcon,
  InfoIcon,
  MessageCircleIcon,
  PlugZapIcon,
} from "lucide-react"
import { toast } from "sonner"

import { SectionHeading } from "@/components/brand/SectionHeading"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DISCORD } from "@/config/site"
import {
  formatNumber,
  SERVER_MODE,
  serverStatusOptions,
  type ServerStatus,
} from "@/features/public/queries"

const GRID =
  "grid grid-cols-[minmax(160px,1.6fr)_minmax(80px,1fr)_96px_64px_96px] gap-4"

async function copyConnect(address: string) {
  try {
    await navigator.clipboard.writeText(`connect ${address}`)
    toast("IP copiada")
  } catch {
    toast.error("No se pudo copiar. Escribe: connect " + address)
  }
}

function ServerRow({ server }: { server: ServerStatus }) {
  const { players, max_players: max, address } = server
  const full = players !== null && max !== null && players >= max
  const meta = [server.mode && SERVER_MODE[server.mode], server.region].filter(
    Boolean
  )
  return (
    <div
      role="row"
      className={cn(
        GRID,
        "items-center border-b px-5 py-4 hover:bg-muted/50",
        !server.online && "opacity-60"
      )}
    >
      <span role="cell" className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "size-2.5 shrink-0 rounded-full",
            server.online
              ? "bg-win shadow-[0_0_0_4px_color-mix(in_oklch,var(--win)_15%,transparent)]"
              : "bg-muted-foreground shadow-[0_0_0_4px_var(--muted)]"
          )}
          aria-label={server.online ? "En línea" : "Fuera de línea"}
          role="img"
        />
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className="truncate text-sm font-semibold">{server.name}</span>
          {(meta.length > 0 || address) && (
            // Si no entra en una línea, la IP baja entera (es el botón de copiar: no se corta).
            <span className="flex flex-wrap gap-x-1 text-xs text-muted-foreground">
              {meta.length > 0 && (
                <span>
                  {meta.join(" · ")}
                  {address && " · "}
                </span>
              )}
              {address && (
                <button
                  type="button"
                  title="Copiar IP"
                  onClick={() => void copyConnect(address)}
                  className="font-mono font-medium underline decoration-dotted underline-offset-[3px] hover:text-foreground"
                >
                  {address}
                </button>
              )}
            </span>
          )}
        </span>
      </span>
      <span role="cell" className="truncate font-mono text-[13px] font-medium">
        {server.map ?? "—"}
      </span>
      <span role="cell" className="flex flex-col gap-1.5">
        {players !== null && max !== null ? (
          <>
            <span className="font-mono text-[13px] font-semibold">
              {players}
              <span className="font-normal text-muted-foreground">/{max}</span>
            </span>
            <span className="h-1 overflow-hidden rounded-[2px] bg-muted">
              <span
                className={cn(
                  "block h-full",
                  full ? "bg-destructive" : "bg-primary"
                )}
                style={{
                  width: `${max > 0 ? Math.round((players / max) * 100) : 0}%`,
                }}
              />
            </span>
          </>
        ) : (
          <span className="font-mono text-[13px] text-muted-foreground">—</span>
        )}
      </span>
      <span
        role="cell"
        className="font-mono text-[13px] font-medium text-muted-foreground"
      >
        {server.ping_ms !== null ? `${server.ping_ms} ms` : "—"}
      </span>
      <span role="cell" className="flex justify-end">
        {server.online && address ? (
          <Button asChild className="gap-1.5 px-3 text-[13px] font-semibold">
            <a href={`steam://connect/${address}`}>
              <PlugZapIcon className="size-[13px]" aria-hidden />
              Conectar
            </a>
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled
            className="gap-1.5 px-3 text-[13px] font-semibold"
          >
            <PlugZapIcon className="size-[13px]" aria-hidden />
            {server.online ? "Conectar" : "Offline"}
          </Button>
        )}
      </span>
    </div>
  )
}

/** Encabezado de la columna: aclara que no es el ping del jugador (el navegador no lo puede medir). */
function LatencyHeader() {
  return (
    <span role="columnheader" className="flex items-center gap-1">
      Latencia
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Qué es la latencia"
            className="rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <InfoIcon className="size-3" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          Medida desde nuestro servidor web. Tu ping depende de tu conexión.
        </TooltipContent>
      </Tooltip>
    </span>
  )
}

function LoadingRows() {
  return Array.from({ length: 3 }, (_, i) => (
    <div
      key={i}
      role="row"
      className={cn(GRID, "items-center border-b px-5 py-4")}
    >
      <Skeleton role="cell" className="h-9" />
      <Skeleton role="cell" className="h-4" />
      <Skeleton role="cell" className="h-4" />
      <Skeleton role="cell" className="h-4" />
      <Skeleton role="cell" className="h-8" />
    </div>
  ))
}

function DiscordCard() {
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
            Busca equipo, coordina PCW y recibe los avisos de cada torneo.
          </p>
        </div>
        <dl className="flex gap-5">
          <div className="flex flex-col-reverse gap-0.5">
            <dt className="text-xs text-white/70">en línea</dt>
            <dd className="flex items-center gap-1.5 font-mono text-xl font-bold">
              <span
                className="size-2 rounded-full bg-[oklch(0.8_0.17_150)]"
                aria-hidden
              />
              {formatNumber(DISCORD.online)}
            </dd>
          </div>
          <div className="flex flex-col-reverse gap-0.5">
            <dt className="text-xs text-white/70">miembros</dt>
            <dd className="font-mono text-xl font-bold">
              {formatNumber(DISCORD.members)}
            </dd>
          </div>
        </dl>
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
          eyebrow="Servidores"
          title="Entra a jugar ahora."
          aside={
            totals && (
              <div className="flex flex-wrap items-center gap-5">
                <span className="flex flex-col gap-0.5">
                  <span className="font-mono text-2xl font-bold tracking-[-1px]">
                    {totals.online}/{totals.servers}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    servidores en línea
                  </span>
                </span>
                <span className="h-9 w-px bg-border" aria-hidden />
                <span className="flex flex-col gap-0.5">
                  <span className="font-mono text-2xl font-bold tracking-[-1px] text-win">
                    {formatNumber(totals.players)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    jugando ahora
                  </span>
                </span>
              </div>
            )
          }
        />
        <div className="flex flex-wrap items-stretch gap-5">
          <div className="min-w-0 flex-[999_1_560px] overflow-hidden rounded-hero border bg-card">
            <div className="overflow-x-auto">
              <div
                role="table"
                aria-label="Servidores"
                aria-busy={status.isPending || undefined}
                className="min-w-[600px]"
              >
                <div
                  role="row"
                  className={cn(
                    GRID,
                    "border-b px-5 py-3 text-xs font-medium text-muted-foreground"
                  )}
                >
                  <span role="columnheader">Servidor</span>
                  <span role="columnheader">Mapa</span>
                  <span role="columnheader">Jugadores</span>
                  <LatencyHeader />
                  <span role="columnheader" className="sr-only">
                    Acción
                  </span>
                </div>
                {status.isPending && <LoadingRows />}
                {status.data?.servers.map((s) => (
                  <ServerRow key={s.id} server={s} />
                ))}
              </div>
            </div>
            {status.isError && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 text-sm">
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
            <p className="px-5 py-3 text-xs text-muted-foreground">
              También puedes pegar{" "}
              <code className="font-mono text-foreground">
                connect &lt;ip&gt;
              </code>{" "}
              en la consola del juego.
            </p>
          </div>
          <DiscordCard />
        </div>
      </div>
    </section>
  )
}
