import { cn } from "cn"
import { ArrowUpRightIcon, MessageCircleIcon, PlugZapIcon } from "lucide-react"
import { toast } from "sonner"

import { SectionHeading } from "@/components/brand/SectionHeading"
import { Button } from "@/components/ui/button"
import { DISCORD, SERVERS, type GameServer } from "@/config/site"
import { formatNumber } from "@/features/public/queries"

const GRID =
  "grid grid-cols-[minmax(160px,1.6fr)_minmax(80px,1fr)_96px_56px_96px] gap-4"

async function copyConnect(address: string) {
  try {
    await navigator.clipboard.writeText(`connect ${address}`)
    toast("IP copiada")
  } catch {
    toast.error("No se pudo copiar. Escribe: connect " + address)
  }
}

function ServerRow({ server }: { server: GameServer }) {
  const full = server.players >= server.maxPlayers
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
          <span className="truncate text-xs text-muted-foreground">
            {server.mode} · {server.region} ·{" "}
            <button
              type="button"
              title="Copiar IP"
              onClick={() => void copyConnect(server.address)}
              className="font-mono font-medium underline decoration-dotted underline-offset-[3px] hover:text-foreground"
            >
              {server.address}
            </button>
          </span>
        </span>
      </span>
      <span role="cell" className="truncate font-mono text-[13px] font-medium">
        {server.map ?? "—"}
      </span>
      <span role="cell" className="flex flex-col gap-1.5">
        <span className="font-mono text-[13px] font-semibold">
          {server.players}
          <span className="font-normal text-muted-foreground">
            /{server.maxPlayers}
          </span>
        </span>
        <span className="h-1 overflow-hidden rounded-[2px] bg-muted">
          <span
            className={cn("block h-full", full ? "bg-destructive" : "bg-primary")}
            style={{ width: `${Math.round((server.players / server.maxPlayers) * 100)}%` }}
          />
        </span>
      </span>
      <span role="cell" className="font-mono text-[13px] font-medium text-muted-foreground">
        {server.ping ?? "—"}
      </span>
      <span role="cell" className="flex justify-end">
        {server.online ? (
          <Button asChild className="gap-1.5 px-3 text-[13px] font-semibold">
            <a href={`steam://connect/${server.address}`}>
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
            Offline
          </Button>
        )}
      </span>
    </div>
  )
}

function DiscordCard() {
  return (
    <div className="flex flex-[1_1_300px] flex-col overflow-hidden rounded-hero bg-[oklch(0.42_0.17_275)] text-white">
      <div className="flex flex-1 flex-col gap-4 p-6">
        <span className="grid size-11 place-items-center rounded-tile bg-white/14">
          <MessageCircleIcon className="size-[22px]" aria-hidden />
        </span>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xl font-bold tracking-[-0.4px]">Únete al Discord</h3>
          <p className="text-sm leading-normal text-pretty text-white/78">
            Busca equipo, coordina PCW y recibe los avisos de cada torneo.
          </p>
        </div>
        <dl className="flex gap-5">
          <div className="flex flex-col-reverse gap-0.5">
            <dt className="text-xs text-white/70">en línea</dt>
            <dd className="flex items-center gap-1.5 font-mono text-xl font-bold">
              <span className="size-2 rounded-full bg-[oklch(0.8_0.17_150)]" aria-hidden />
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
  const online = SERVERS.filter((s) => s.online)
  const players = online.reduce((sum, s) => sum + s.players, 0)

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
            <div className="flex flex-wrap items-center gap-5">
              <span className="flex flex-col gap-0.5">
                <span className="font-mono text-2xl font-bold tracking-[-1px]">
                  {online.length}/{SERVERS.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  servidores en línea
                </span>
              </span>
              <span className="h-9 w-px bg-border" aria-hidden />
              <span className="flex flex-col gap-0.5">
                <span className="font-mono text-2xl font-bold tracking-[-1px] text-win">
                  {formatNumber(players)}
                </span>
                <span className="text-xs text-muted-foreground">
                  jugando ahora
                </span>
              </span>
            </div>
          }
        />
        <div className="flex flex-wrap items-stretch gap-5">
          <div className="min-w-0 flex-[999_1_560px] overflow-hidden rounded-hero border bg-card">
            <div className="overflow-x-auto">
              <div role="table" aria-label="Servidores" className="min-w-[600px]">
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
                  <span role="columnheader">Ping</span>
                  <span role="columnheader" className="sr-only">
                    Acción
                  </span>
                </div>
                {SERVERS.map((s) => (
                  <ServerRow key={s.address} server={s} />
                ))}
              </div>
            </div>
            <p className="px-5 py-3 text-xs text-muted-foreground">
              También puedes pegar{" "}
              <code className="font-mono text-foreground">connect &lt;ip&gt;</code>{" "}
              en la consola del juego.
            </p>
          </div>
          <DiscordCard />
        </div>
      </div>
    </section>
  )
}
