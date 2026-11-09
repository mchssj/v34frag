import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BanIcon,
  CopyIcon,
  CrownIcon,
  DownloadIcon,
  Link2Icon,
  LockIcon,
  PlayIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ListSeal } from "@/components/brand/VerifiedBadge"
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
import { Badge } from "@/components/ui/badge"
import {
  LOBBY_HINT,
  LOBBY_TITLE,
  connectCommand,
  fmtClock,
  isCountry,
  mapLabel,
  secondsLeft,
  steamConnectUrl,
  sideLabel,
} from "../labels"
import { LobbyChat } from "../LobbyChat"
import { PasswordField } from "../PasswordField"
import { ReportDialog } from "../ReportDialog"
import type { MmLobby, MmPlayer, MmReplacement, MmVetoMap } from "../types"
import { useNow } from "../useNow"
import { VetoBoard } from "../VetoBoard"
import { ClaimCard, needsClaim } from "./ClaimCard"
import { Encounters } from "./Encounters"
import { MatchSummary, PlayAgain, PlayerPostMatch } from "./PostMatch"
import { signed } from "@/features/mixes/lib/labels"
import {
  chatScope,
  replacementOf,
  roomRows,
  teamLabel,
  type Team,
} from "./roomData"

// Descripción general de la sala: los jugadores de cada equipo a los lados y, en el medio, el
// veto o el servidor y el mapa (plan, sección 7, "Sala de la partida").

/**
 * live: la sala de quien juega. preview: el link de reemplazo (sin servidor ni chat, con el lugar libre). detail: el
 * detalle de una partida terminada (replanteo 78), con los números de esa partida y sin chat ni reportes.
 */
export type RoomMode = "live" | "preview" | "detail"

export function RoomOverview({
  lobby,
  map,
  onBack,
  mode = "live",
  takeCard,
  extra,
}: {
  lobby: MmLobby
  map: MmVetoMap | null
  onBack?: () => void
  mode?: RoomMode
  /** En la vista previa del link: la tarjeta con el botón para tomar el lugar. */
  takeCard?: React.ReactNode
  /** Arriba del centro: lo propio de otro tipo de partida (en una PCW, la serie y sus reglas). */
  extra?: React.ReactNode
}) {
  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_minmax(320px,400px)_1fr]">
      <TeamColumn lobby={lobby} team={1} mode={mode} />
      <Center
        lobby={lobby}
        map={map}
        onBack={onBack}
        mode={mode}
        takeCard={takeCard}
        extra={extra}
      />
      <TeamColumn lobby={lobby} team={2} mode={mode} />
    </div>
  )
}

function TeamColumn({
  lobby,
  team,
  mode,
}: {
  lobby: MmLobby
  team: Team
  mode: RoomMode
}) {
  const live =
    mode !== "detail" &&
    ["connecting", "live", "finished"].includes(lobby.status)
  const chat = chatScope(lobby, team)
  const { main, gone, open } = roomRows(lobby, team, mode === "preview")
  return (
    <div className="flex flex-col gap-3">
      <section
        aria-label={sideLabel(lobby, team)}
        className={cn(
          "flex-1 overflow-hidden rounded-xl border bg-card",
          open && "border-primary/60"
        )}
      >
        <h2
          className={cn(
            "flex items-baseline justify-between border-b px-4 py-2 text-sm font-semibold",
            team === 1
              ? "shadow-[inset_3px_0_0_var(--primary)]"
              : "shadow-[inset_3px_0_0_var(--chart-2)]"
          )}
        >
          Jugadores · {sideLabel(lobby, team)}
          {open ? (
            <span className="text-[11px] font-semibold text-primary">
              Tu equipo si entras
            </span>
          ) : (
            <span className="text-[11px] font-normal text-muted-foreground">
              {mode === "detail" ? "Esta partida" : "Últimas 30 partidas"}
            </span>
          )}
        </h2>
        <ul className="flex flex-col divide-y">
          {main.map((p) => (
            <PlayerCard
              key={p.player_id}
              p={p}
              lobby={lobby}
              showConnection={live}
              mode={mode}
            />
          ))}
          {open && <OpenSlot rep={open} />}
          {gone.map((p) => (
            <GoneRow key={p.player_id} p={p} lobby={lobby} mode={mode} />
          ))}
        </ul>
      </section>
      {/* Debajo de los jugadores: el de equipo en tu columna y el general en la del rival. */}
      {lobby.match_id && mode === "live" && chat && (
        <LobbyChat lobby={lobby} scope={chat} />
      )}
    </div>
  )
}

function PlayerCard({
  p,
  lobby,
  showConnection,
  mode,
}: {
  p: MmPlayer
  lobby: MmLobby
  showConnection: boolean
  mode: RoomMode
}) {
  const r = p.recent
  const rep = replacementOf(lobby, p.player_id)
  // En el detalle, los números de esta partida en vez de los de las últimas 30.
  const stat =
    mode === "detail"
      ? lobby.match?.stats.find((s) => s.key === p.player_id)
      : undefined
  return (
    <li
      className={cn(
        "flex flex-col gap-1.5 px-3 py-2",
        p.is_me && "bg-primary/6",
        (p.left_until || p.abandoned) && "bg-destructive/8"
      )}
    >
      <div className="flex items-center gap-2.5">
        <Avatar className="size-9 rounded-lg">
          {p.photo_url && <AvatarImage src={p.photo_url} alt="" />}
          <AvatarFallback className="rounded-lg text-sm font-semibold">
            {p.nick.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          {p.country && <CountryFlag country={p.country} />}
          <Link
            to="/player/$nick"
            params={{ nick: p.nick }}
            className="min-w-0 truncate hover:underline"
          >
            {p.nick}
          </Link>
          <ListSeal kind={p.verified} />
          {p.vip && <Badge variant="vip">VIP</Badge>}
          {rep && (
            <Badge variant="primary" size="xs">
              Reemplazo
            </Badge>
          )}
          {p.is_me && (
            <span className="text-xs text-muted-foreground">(tú)</span>
          )}
          {p.linked === false &&
            !["finished", "cancelled"].includes(lobby.status) && (
              <Badge
                variant="warn"
                size="xs"
                title="Todavía no vinculó su SteamID: tiene que escribir !claim en el chat de la partida"
              >
                Sin vincular
              </Badge>
            )}
          {p.is_captain && (
            <CrownIcon
              aria-label="Capitán"
              className="size-3.5 shrink-0 text-primary"
            />
          )}
          {p.anticheat && (
            <ShieldCheckIcon
              aria-label="Anticheat activo"
              className="size-3.5 shrink-0 text-win"
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
          {mode !== "detail" && p.elo_trend !== null && (
            <Trend value={p.elo_trend} />
          )}
          {stat?.delta != null && <EloDelta value={stat.delta} />}
          <span className="font-mono text-sm tabular-nums">{p.elo}</span>
          <LevelBadge level={p.level} size={22} />
          {!p.is_me && <Encounters player={p} />}
          {!p.is_me && mode === "live" && (
            <ReportDialog
              lobbyId={lobby.id}
              player={p}
              done={lobby.reported.includes(p.player_id)}
            />
          )}
        </span>
      </div>
      {mode !== "detail" && p.form.length > 0 && (
        <FormLine p={p}>
          {!p.is_me && mode === "live" && lobby.status === "finished" && (
            <PlayerPostMatch lobby={lobby} player={p} />
          )}
        </FormLine>
      )}
      {(p.left_until || p.abandoned) && (
        <LeftNotice
          until={p.left_until}
          abandoned={p.abandoned}
          replaced={p.replaced === true}
        />
      )}
      {rep && <ReplacementNote rep={rep} />}
      {mode === "detail" ? (
        stat ? (
          <dl className="grid grid-cols-6 gap-x-2">
            <Stat label="Rating" value={stat.rating?.toFixed(2) ?? "—"} />
            <Stat label="K/D/A" value={`${stat.k}/${stat.d}/${stat.a}`} />
            <Stat
              label="K/D"
              value={stat.d > 0 ? (stat.k / stat.d).toFixed(2) : "—"}
            />
            <Stat label="ADR" value={stat.adr?.toFixed(1) ?? "—"} />
            <Stat label="HS %" value={stat.hs != null ? `${stat.hs}%` : "—"} />
            <Stat label="Rondas" value={String(stat.rounds)} />
          </dl>
        ) : (
          <span className="text-xs text-muted-foreground">
            Sin estadísticas de esta partida
          </span>
        )
      ) : r ? (
        <dl className="grid grid-cols-6 gap-x-2">
          <Stat label="Rating" value={r.rating.toFixed(2)} />
          <Stat label="Victorias" value={`${r.win_pct}%`} />
          <Stat label="K/D/A" value={`${r.k}/${r.d}/${r.a}`} />
          <Stat label="K/D" value={r.kd.toFixed(2)} />
          <Stat label="K/R" value={r.kr.toFixed(2)} />
          <Stat label="ADR" value={r.adr.toFixed(1)} />
        </dl>
      ) : (
        <span className="text-xs text-muted-foreground">
          Sin partidas todavía
        </span>
      )}
    </li>
  )
}

/** El que entró de reemplazo: a quién reemplaza y si ya entró al servidor (replanteo 78). */
function ReplacementNote({ rep }: { rep: MmReplacement }) {
  const who = rep.replaced_nick ?? "un jugador"
  return (
    <span className="text-xs text-primary">
      {rep.status === "taken"
        ? `Reemplaza a ${who} · todavía no entró al servidor`
        : `${rep.joined_round ? `Entró en la ronda ${rep.joined_round}` : "Entró"} en lugar de ${who}`}
    </span>
  )
}

/** El lugar libre del que se fue, en la vista previa del link. */
function OpenSlot({ rep }: { rep: MmReplacement }) {
  return (
    <li className="m-2.5 flex items-center gap-2.5 rounded-lg border-[1.5px] border-dashed border-primary bg-primary/8 p-3">
      <span className="grid size-9 place-items-center rounded-lg border-[1.5px] border-dashed border-primary">
        <PlusIcon aria-hidden className="size-4 text-primary" />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-primary">
          Aquí entrarías tú
        </span>
        <span className="text-xs text-muted-foreground">
          En lugar de{" "}
          <span className="font-semibold text-foreground">
            {rep.replaced_nick ?? "un jugador"}
          </span>
          {rep.left_round
            ? `, que abandonó (se pidió en la ronda ${rep.left_round})`
            : ", que abandonó"}
        </span>
      </span>
    </li>
  )
}

/** El que abandonó y ya tiene reemplazo: una línea, debajo de su equipo. */
function GoneRow({
  p,
  lobby,
  mode,
}: {
  p: MmPlayer
  lobby: MmLobby
  mode: RoomMode
}) {
  const rep = lobby.replacements?.find(
    (x) => x.replaced_player_id === p.player_id && x.status !== "open"
  )
  const delta =
    mode === "detail"
      ? lobby.match?.stats.find((s) => s.key === p.player_id)?.delta
      : null
  return (
    <li className="flex items-center gap-2.5 bg-destructive/8 px-3 py-2">
      <Avatar className="size-7 rounded-lg">
        {p.photo_url && <AvatarImage src={p.photo_url} alt="" />}
        <AvatarFallback className="rounded-lg text-[11px] font-semibold">
          {p.nick.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm text-muted-foreground line-through">
        {p.nick}
      </span>
      <span className="min-w-0 text-xs text-destructive">
        {rep?.left_round
          ? `Abandonó en la ronda ${rep.left_round}`
          : "Abandonó"}
      </span>
      {delta != null && (
        <span className="ml-auto">
          <EloDelta value={delta} />
        </span>
      )}
    </li>
  )
}

function EloDelta({ value }: { value: number }) {
  return (
    <span
      title="Cambio de ELO en esta partida"
      className={cn(
        "font-mono text-xs font-semibold tabular-nums",
        value >= 0 ? "text-win" : "text-destructive"
      )}
    >
      {signed(value)}
    </span>
  )
}

/** Sus últimos 5 resultados y su mejor mapa. */
function FormLine({
  p,
  children,
}: {
  p: MmPlayer
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
      <ul
        aria-label={`Últimos resultados de ${p.nick}`}
        className="flex gap-0.5"
      >
        {p.form.map((r, i) => (
          <li
            key={i}
            className={cn(
              "grid size-4 place-items-center rounded-[3px] font-mono text-[9px] font-bold",
              r === "W"
                ? "bg-win/15 text-win"
                : "bg-destructive/15 text-destructive"
            )}
          >
            {r === "W" ? "G" : "P"}
          </li>
        ))}
      </ul>
      {p.fav_map && (
        <span className="ml-auto">
          Mejor mapa:{" "}
          <span className="font-medium text-foreground">
            {mapLabel(p.fav_map.map)}
          </span>{" "}
          {p.fav_map.win_pct}%
        </span>
      )}
      {children}
    </div>
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
  replaced,
}: {
  until: string | null
  abandoned: boolean
  replaced: boolean
}) {
  const now = useNow(!abandoned)
  return (
    <span className="text-xs text-destructive">
      {replaced
        ? "Abandonó: pierde ELO y entró un reemplazo en su lugar"
        : abandoned
          ? "Abandonó: pierde ELO y su equipo se puede rendir con !gg sin perder"
          : `Se desconectó · ${fmtClock(secondsLeft(until, now) * 1000)} para volver`}
    </span>
  )
}

function Center({
  lobby,
  map,
  onBack,
  mode,
  takeCard,
  extra,
}: {
  lobby: MmLobby
  map: MmVetoMap | null
  onBack?: () => void
  mode: RoomMode
  takeCard?: React.ReactNode
  extra?: React.ReactNode
}) {
  const connecting = lobby.status === "connecting"
  const now = useNow(connecting)
  const ended = lobby.status === "finished" || lobby.status === "cancelled"
  const inVeto = lobby.status === "veto"
  const live = mode === "live"
  // Tomé un reemplazo y todavía no entré al servidor: la cuenta regresiva va arriba de todo.
  const meId = lobby.players.find((p) => p.is_me)?.player_id
  const myRep = live
    ? lobby.replacements?.find(
        (r) => r.status === "taken" && r.by_player_id === meId
      )
    : undefined

  return (
    <div className="flex flex-col gap-4">
      {extra}
      {mode === "preview" && takeCard}
      {myRep && <ReplaceConnectCard lobby={lobby} rep={myRep} />}
      {/* Durante el veto, el tablero ya dice qué pasa. */}
      {!inVeto && mode !== "preview" && !myRep && (
        <div className="rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {lobby.status === "live" && <LiveDot />}
            {lobby.status === "cancelled" && (
              <BanIcon aria-hidden className="size-4 text-muted-foreground" />
            )}
            {LOBBY_TITLE[lobby.status]}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {lobby.status === "cancelled"
              ? lobby.end_reason
              : (lobby.status_hint ?? LOBBY_HINT[lobby.status])}
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

      {inVeto && lobby.veto && <VetoBoard lobby={lobby} />}

      {live && needsClaim(lobby) && <ClaimCard />}
      {/* (replanteo 58) Desde otra PC el SteamID cambia: el !claim lo suma al instante a la ficha. */}
      {live &&
        !needsClaim(lobby) &&
        ["assigned", "connecting"].includes(lobby.status) &&
        lobby.players.some((p) => p.is_me) && (
          <p className="text-xs text-muted-foreground">
            ¿Juegas desde otra PC? Genera un código en{" "}
            <Link to="/profile/link" className="underline underline-offset-4">
              Mi perfil › Vinculación
            </Link>{" "}
            y escribe !claim en el chat de la partida.
          </p>
        )}

      {mode !== "preview" && lobby.status === "finished" && (
        <MatchSummary lobby={lobby} />
      )}

      {mode === "preview" && (
        <Block title="Servidor">
          <div className="flex items-center gap-2.5 rounded-xl border bg-card p-3 text-xs text-muted-foreground">
            <LockIcon aria-hidden className="size-4 shrink-0" />
            La IP y la contraseña aparecen cuando tomas el lugar.
          </div>
        </Block>
      )}

      {lobby.server && !ended && (
        <Block title="Servidor">
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm">
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
                className={cn(buttonVariants({ size: "lg" }), "flex-1")}
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

      {mode !== "preview" && <ReplaceChanges lobby={lobby} />}

      {lobby.match?.demo_url && (
        <a
          href={lobby.match.demo_url}
          className={buttonVariants({ variant: "outline" })}
        >
          <DownloadIcon aria-hidden />
          Ver demo
        </a>
      )}
      {live && onBack && lobby.status === "finished" && (
        <PlayAgain lobby={lobby} onDone={onBack} />
      )}
      {live && onBack && ended && (
        <Button
          size="md"
          variant={lobby.status === "finished" ? "outline" : "default"}
          onClick={onBack}
        >
          Volver a Jugar
        </Button>
      )}
    </div>
  )
}

/** Tomé el lugar de otro: el plazo para entrar al servidor (replanteo 78). */
function ReplaceConnectCard({
  lobby,
  rep,
}: {
  lobby: MmLobby
  rep: MmReplacement
}) {
  const now = useNow(true)
  return (
    <div className="rounded-xl border border-primary/50 bg-primary/6 p-4">
      <h2 className="text-sm font-semibold">Entra al servidor</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tomaste el lugar de {rep.replaced_nick ?? "un jugador"} en{" "}
        {teamLabel(lobby, rep.team)}. Al entrar, el servidor te pone en su lado.
      </p>
      <p
        role="timer"
        className="mt-2 font-mono text-xs text-primary tabular-nums"
      >
        Quedan {fmtClock(secondsLeft(rep.connect_deadline, now) * 1000)} para
        entrar · si no, te llevas la sanción de no conectarte
      </p>
    </div>
  )
}

/** Quién abandonó y quién entró, con la ronda (replanteo 78). */
function ReplaceChanges({ lobby }: { lobby: MmLobby }) {
  const reps = lobby.replacements ?? []
  if (reps.length === 0) return null
  const round = (n: number | null) => (
    <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
      {n ? `R${n}` : ""}
    </span>
  )
  return (
    <Block title="Cambios en la partida">
      <ol className="flex flex-col gap-1.5 rounded-xl border bg-card p-3 text-sm">
        {reps.map((r, i) => (
          <li key={i} className="flex flex-col gap-1">
            <span className="flex items-baseline gap-2">
              {round(r.left_round)}
              {r.replaced_nick ?? "Un jugador"} abandonó (
              {teamLabel(lobby, r.team)})
            </span>
            <span className="flex items-baseline gap-2 text-muted-foreground">
              {round(r.status === "connected" ? r.joined_round : null)}
              {r.status === "open"
                ? "Se busca un reemplazo"
                : r.status === "taken"
                  ? `${r.by_nick ?? "Un jugador"} tomó su lugar (todavía no entró)`
                  : `${r.by_nick ?? "Un jugador"} entró de reemplazo`}
            </span>
          </li>
        ))}
      </ol>
    </Block>
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
    <section aria-label={title} className="flex flex-col gap-1.5">
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
                {sideLabel(lobby, b.team)}
                {b.auto && " · automático"}
              </span>
            </li>
          ))}
          {lobby.map && (
            <li className="mt-1 flex items-center gap-2 font-semibold text-primary">
              <span className="w-5" />
              Se juega {label(lobby.map)}
            </li>
          )}
        </ol>
      </DialogContent>
    </Dialog>
  )
}
