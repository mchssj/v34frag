import { cn } from "cn"
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BanIcon,
  CopyIcon,
  CrownIcon,
  DownloadIcon,
  Link2Icon,
  PlayIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CountryFlag } from "@/components/brand/CountryFlag"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { LiveDot } from "@/components/brand/LiveDot"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  LOBBY_HINT,
  LOBBY_TITLE,
  connectCommand,
  fmtClock,
  isCountry,
  secondsLeft,
  steamConnectUrl,
  teamName,
} from "../labels"
import { PasswordField } from "../PasswordField"
import { ReportDialog } from "../ReportDialog"
import type { MmLobby, MmPlayer, MmVetoMap } from "../types"
import { useNow } from "../useNow"
import { VetoBoard } from "../VetoBoard"
import { teamPlayers, type Team } from "./roomData"

// Descripción general de la sala: los jugadores de cada equipo a los lados y, en el medio, el
// veto o el servidor y el mapa (plan, sección 7, "Sala de la partida").

export function RoomOverview({
  lobby,
  map,
  onBack,
}: {
  lobby: MmLobby
  map: MmVetoMap | null
  onBack: () => void
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_minmax(300px,360px)_1fr]">
      <TeamColumn lobby={lobby} team={1} />
      <Center lobby={lobby} map={map} onBack={onBack} />
      <TeamColumn lobby={lobby} team={2} />
    </div>
  )
}

function TeamColumn({ lobby, team }: { lobby: MmLobby; team: Team }) {
  const live = ["connecting", "live", "finished"].includes(lobby.status)
  return (
    <section aria-label={teamName(team)} className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Jugadores · {teamName(team)}</h2>
      <ul className="flex flex-col gap-3">
        {teamPlayers(lobby, team).map((p) => (
          <PlayerCard
            key={p.player_id}
            p={p}
            lobby={lobby}
            showConnection={live}
          />
        ))}
      </ul>
    </section>
  )
}

function PlayerCard({
  p,
  lobby,
  showConnection,
}: {
  p: MmPlayer
  lobby: MmLobby
  showConnection: boolean
}) {
  const r = p.recent
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-3",
        p.is_me && "border-primary/50",
        (p.left_until || p.abandoned) && "border-destructive/60"
      )}
    >
      <div className="flex items-center gap-2.5">
        <Avatar className="size-11 rounded-lg">
          {p.photo_url && <AvatarImage src={p.photo_url} alt="" />}
          <AvatarFallback className="rounded-lg text-sm font-semibold">
            {p.nick.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="flex min-w-0 items-center gap-1.5 font-semibold">
          {p.country && <CountryFlag country={p.country} />}
          <span className="truncate">{p.nick}</span>
          {p.is_me && (
            <span className="text-xs text-muted-foreground">(vos)</span>
          )}
          {p.is_captain && (
            <CrownIcon
              aria-label="Capitán"
              className="size-3.5 shrink-0 text-sidebar-primary"
            />
          )}
          {p.party_id && (
            <Link2Icon
              aria-label="En dúo"
              className="size-3.5 shrink-0 text-muted-foreground"
            />
          )}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {showConnection && <ConnectionDot p={p} />}
          {p.elo_trend !== null && <Trend value={p.elo_trend} />}
          <span className="font-mono text-sm tabular-nums">{p.elo}</span>
          <LevelBadge level={p.level} size={22} className="rounded-full" />
          {!p.is_me && (
            <ReportDialog
              lobbyId={lobby.id}
              player={p}
              done={lobby.reported.includes(p.player_id)}
            />
          )}
        </span>
      </div>
      {(p.left_until || p.abandoned) && (
        <LeftNotice until={p.left_until} abandoned={p.abandoned} />
      )}
      {r ? (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground">
            Últimas 30 partidas
          </span>
          <dl className="grid grid-cols-4 gap-x-3 gap-y-1.5">
            <Stat label="Partidas" value={r.matches.toLocaleString("es-AR")} />
            <Stat label="Victorias" value={`${r.win_pct}%`} />
            <Stat label="Rating" value={r.rating.toFixed(2)} />
            <Stat label="K/D/A" value={`${r.k}/${r.d}/${r.a}`} />
            <Stat label="K/D" value={r.kd.toFixed(2)} />
            <Stat label="K/R" value={r.kr.toFixed(2)} />
            <Stat label="ADR" value={r.adr.toFixed(1)} />
          </dl>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">
          Sin partidas todavía
        </span>
      )}
    </li>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse leading-tight">
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function Trend({ value }: { value: number }) {
  const up = value >= 0
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon
  return (
    <span
      title={`Último cambio: ${up ? "+" : ""}${value} ELO`}
      className={cn("inline-flex", up ? "text-win" : "text-destructive")}
    >
      <Icon
        aria-label={`Último cambio ${up ? "+" : ""}${value}`}
        className="size-3.5"
      />
    </span>
  )
}

function ConnectionDot({ p }: { p: MmPlayer }) {
  const label = p.abandoned
    ? "Abandonó"
    : p.left_until
      ? "Desconectado"
      : p.connected
        ? "Conectado"
        : "Sin conectar"
  return (
    <span
      title={label}
      className={cn(
        "size-2 rounded-full",
        p.abandoned || p.left_until
          ? "bg-destructive"
          : p.connected
            ? "bg-win"
            : "bg-muted-foreground/40"
      )}
    />
  )
}

/** "Se desconectó · 2:41 para volver" o "Abandonó" (plan, decisiones de desconexión y abandono). */
function LeftNotice({
  until,
  abandoned,
}: {
  until: string | null
  abandoned: boolean
}) {
  const now = useNow(!abandoned)
  return (
    <span className="text-xs text-destructive">
      {abandoned
        ? "Abandonó: pierde ELO y su equipo se puede rendir con !gg sin perder"
        : `Se desconectó · ${fmtClock(secondsLeft(until, now) * 1000)} para volver`}
    </span>
  )
}

function Center({
  lobby,
  map,
  onBack,
}: {
  lobby: MmLobby
  map: MmVetoMap | null
  onBack: () => void
}) {
  const connecting = lobby.status === "connecting"
  const now = useNow(connecting)
  const ended = lobby.status === "finished" || lobby.status === "cancelled"
  const inVeto = lobby.status === "veto"

  return (
    <div className="flex flex-col gap-4">
      {/* Durante el veto, el tablero ya dice qué pasa. */}
      {!inVeto && (
        <div className="rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            {lobby.status === "live" && <LiveDot />}
            {lobby.status === "cancelled" && (
              <BanIcon aria-hidden className="size-4 text-muted-foreground" />
            )}
            {LOBBY_TITLE[lobby.status]}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {lobby.status === "cancelled"
              ? lobby.end_reason
              : LOBBY_HINT[lobby.status]}
          </p>
          {connecting && (
            <p
              role="timer"
              className="mt-2 font-mono text-xs text-muted-foreground tabular-nums"
            >
              Quedan {fmtClock(secondsLeft(lobby.connect_deadline, now) * 1000)}{" "}
              para entrar · {lobby.players.filter((p) => p.connected).length}/
              {lobby.players.length} conectados
            </p>
          )}
        </div>
      )}

      {inVeto && lobby.veto && <VetoBoard lobby={lobby} compact />}

      {lobby.server && !ended && (
        <Block title="Servidor">
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 text-sm">
            <span className="flex items-center gap-2 font-semibold">
              {isCountry(lobby.region) && (
                <CountryFlag country={lobby.region} />
              )}
              {lobby.region ?? "Servidor"} · {lobby.server.name}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {lobby.server.address}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">Contraseña</span>
              <PasswordField value={lobby.server.password} />
            </span>
            <span className="flex gap-2">
              <CopyConnect
                address={lobby.server.address}
                password={lobby.server.password}
              />
              <a
                href={steamConnectUrl(
                  lobby.server.address,
                  lobby.server.password
                )}
                className={cn(buttonVariants({ size: "sm" }), "flex-1")}
              >
                <PlayIcon aria-hidden />
                Conectar
              </a>
            </span>
          </div>
        </Block>
      )}

      {map && !inVeto && (
        <Block
          title="Mapa"
          aside={
            lobby.veto &&
            lobby.veto.bans.length > 0 && <VetoHistory lobby={lobby} />
          }
        >
          <div className="flex items-center gap-3 overflow-hidden rounded-xl border bg-card p-2">
            <span className="grid aspect-[4/3] w-20 place-items-center overflow-hidden rounded-md bg-muted">
              {map.image_url && (
                <img
                  src={map.image_url}
                  alt=""
                  className="size-full object-cover"
                />
              )}
            </span>
            <span className="flex flex-col">
              <span className="font-semibold">{map.label}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {map.name}
              </span>
            </span>
          </div>
        </Block>
      )}

      {lobby.match?.demo_url && (
        <a
          href={lobby.match.demo_url}
          className={cn(buttonVariants({ variant: "ghost" }), "text-primary")}
        >
          <DownloadIcon aria-hidden />
          Ver demo
        </a>
      )}
      {ended && (
        <Button size="md" onClick={onBack} className="font-semibold uppercase">
          Volver a Jugar
        </Button>
      )}
    </div>
  )
}

function Block({
  title,
  aside,
  children,
}: {
  title: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

function CopyConnect({
  address,
  password,
}: {
  address: string
  password: string
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="flex-1"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(connectCommand(address, password))
          toast.success("Comando copiado: pegalo en la consola del juego")
        } catch {
          toast.error("No se pudo copiar")
        }
      }}
    >
      <CopyIcon aria-hidden />
      Copiar connect
    </Button>
  )
}

/** Los baneos del veto, en orden, para verlos después de jugar. */
function VetoHistory({ lobby }: { lobby: MmLobby }) {
  const veto = lobby.veto!
  const label = (name: string) =>
    veto.pool.find((m) => m.name === name)?.label ?? name
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs">
          Veto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Veto de mapas</DialogTitle>
        </DialogHeader>
        <ol className="flex flex-col gap-1.5 text-sm">
          {veto.bans.map((b) => (
            <li key={b.seq} className="flex items-center gap-2">
              <span className="w-5 font-mono text-xs text-muted-foreground">
                {b.seq}
              </span>
              <BanIcon aria-hidden className="size-3.5 text-destructive" />
              <span className="font-medium">{label(b.map)}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {teamName(b.team)}
                {b.auto && " · automático"}
              </span>
            </li>
          ))}
          {lobby.map && (
            <li className="mt-1 flex items-center gap-2 font-semibold text-win">
              <span className="w-5" />
              Se juega {label(lobby.map)}
            </li>
          )}
        </ol>
      </DialogContent>
    </Dialog>
  )
}
