import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { CrownIcon, UserIcon, UserPlusIcon } from "lucide-react"
import { useState, type CSSProperties, type ReactNode } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { CountryFlag } from "@/components/brand/CountryFlag"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  CardBackground,
  FramedAvatar,
  NameFx,
  VipBadge,
} from "@/features/shop/cosmetics"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { fmtClock, secondsLeft } from "./labels"
import { LeavePartyButton, PartyMenu, usePartyNotices } from "./PartyMenu"
import { playerSearchOptions, useMmMutation } from "./queries"
import { useMmSource } from "./source"
import type { Country, MmCosmetics, MmState } from "./types"
import { useNow } from "./useNow"

// "Mi grupo" (plan, sección 7): una tarjeta por lugar del equipo. En el medio, el jugador; al lado,
// el grupo; después, los lugares que el grupo puede llenar (se invita) y los que llena la cola.

type Card = MmCosmetics & {
  player_id: string
  nick: string
  country: Country | null
  photo_url: string | null
  elo: number
  level: number
  is_me: boolean
  is_leader: boolean
}

type Slot =
  | { kind: "member"; card: Card }
  | { kind: "invite" }
  | { kind: "pending"; nick: string; expires_at: string }
  | { kind: "queue" }

/** Orden de los lugares desde el medio hacia afuera: 2, 1, 3, 0, 4 en un equipo de 5. */
export function slotOrder(size: number) {
  const mid = Math.floor(size / 2)
  const order = [mid]
  for (let d = 1; order.length < size; d++) {
    if (mid - d >= 0) order.push(mid - d)
    if (mid + d < size && order.length < size) order.push(mid + d)
  }
  return order
}

export function buildSlots(state: MmState, teamSize: number): Slot[] {
  const party = state.party
  const members: Card[] = party
    ? [...party.members]
        // El que mira, siempre en el medio.
        .sort((a, b) => Number(b.is_me) - Number(a.is_me))
        .map((m) =>
          m.is_me
            ? {
                ...state.me,
                player_id: m.player_id,
                is_me: true,
                is_leader: m.is_leader,
              }
            : {
                ...m,
                country: null,
                photo_url: null,
              }
        )
    : [{ ...state.me, player_id: "me", is_me: true, is_leader: false }]
  const room = Math.min(state.max_party_size, teamSize)
  const fill: Slot[] = members.map((card) => ({ kind: "member", card }))
  if (party?.pending)
    fill.push({
      kind: "pending",
      nick: party.pending.to_nick,
      expires_at: party.pending.expires_at,
    })
  while (fill.length < room) fill.push({ kind: "invite" })
  while (fill.length < teamSize) fill.push({ kind: "queue" })

  const slots: Slot[] = new Array<Slot>(teamSize)
  slotOrder(teamSize).forEach((pos, i) => (slots[pos] = fill[i]!))
  return slots
}

export function GroupSlots({
  state,
  teamSize,
}: {
  state: MmState
  teamSize: number
}) {
  usePartyNotices(state.party)
  const busy = !!state.queue || !!state.lobby
  const slots = buildSlots(state, teamSize)

  return (
    <div className="flex flex-col gap-3">
      {/* En celular (menos de 640 px) la tarjeta propia va arriba y grande, y los demás lugares en
          una fila de tarjetas chicas (plan, decisión "Celular"). */}
      <ul
        className="grid grid-cols-4 gap-2 sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))] sm:gap-3"
        style={{ "--cols": teamSize } as CSSProperties}
      >
        {slots.map((slot, i) => (
          <li
            key={i}
            className={cn(
              "sm:aspect-[3/4] sm:max-h-[260px] sm:min-h-[180px]",
              slot.kind === "member" && slot.card.is_me
                ? "col-span-full h-56 max-sm:order-first sm:col-span-1 sm:h-auto"
                : "aspect-square sm:aspect-[3/4]"
            )}
          >
            {slot.kind === "member" && (
              <MemberCard
                card={slot.card}
                menu={
                  state.party && (
                    <PartyMenu
                      state={state}
                      playerId={slot.card.player_id}
                      nick={slot.card.nick}
                      isMe={slot.card.is_me}
                    />
                  )
                }
              />
            )}
            {slot.kind === "invite" && <InviteSlot disabled={busy} />}
            {slot.kind === "pending" && (
              <PendingSlot nick={slot.nick} expiresAt={slot.expires_at} />
            )}
            {slot.kind === "queue" && <EmptySlot />}
          </li>
        ))}
      </ul>
      {state.party && <LeavePartyButton state={state} />}
    </div>
  )
}

function MemberCard({ card, menu }: { card: Card; menu?: ReactNode }) {
  const initials = card.nick.slice(0, 2).toUpperCase()
  return (
    <div
      className={cn(
        "relative isolate flex size-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border p-3",
        card.background_url
          ? "border-white/15 text-white"
          : card.is_me
            ? "border-foreground/15 bg-[radial-gradient(120%_80%_at_50%_0%,color-mix(in_oklch,var(--foreground)_14%,transparent),transparent_70%),linear-gradient(to_bottom,color-mix(in_oklch,var(--foreground)_6%,var(--card)),var(--card))]"
            : "bg-card"
      )}
    >
      {/* Fondo de miniperfil de la tienda, detrás de todo. */}
      <CardBackground src={card.background_url} />
      {menu}
      {card.is_leader && (
        <CrownIcon
          aria-label="Líder del grupo"
          className="absolute top-2.5 right-2.5 size-4 text-sidebar-primary"
        />
      )}
      {card.frame_url ? (
        <FramedAvatar
          src={card.photo_url}
          alias={card.nick}
          frameSrc={card.frame_url}
          size={88}
        />
      ) : (
        <Avatar className="size-16 ring-2 ring-foreground/10">
          {card.photo_url && <AvatarImage src={card.photo_url} alt="" />}
          <AvatarFallback className="text-base font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
      )}
      <span className="flex max-w-full items-center gap-1.5 text-sm font-semibold">
        {card.country && <CountryFlag country={card.country} />}
        <NameFx
          text={card.nick}
          effect={{ css_class: card.name_class ?? null }}
          className="truncate"
        />
        {card.vip && <VipBadge />}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs font-semibold tabular-nums",
          card.background_url
            ? "border-white/20 bg-black/40"
            : "bg-background/40"
        )}
      >
        <LevelBadge level={card.level} size={20} className="rounded-full" />
        {card.elo.toLocaleString("es-AR")}
      </span>
    </div>
  )
}

const dashed =
  "flex size-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground"

function EmptySlot() {
  return (
    <div className={cn(dashed, "border-foreground/10")}>
      <UserIcon aria-hidden className="size-5 opacity-50" />
      <span className="sr-only">Se completa con la cola</span>
    </div>
  )
}

function PendingSlot({ nick, expiresAt }: { nick: string; expiresAt: string }) {
  const now = useNow(true)
  return (
    <div className={cn(dashed, "border-primary/40 text-center text-xs")}>
      <UserPlusIcon aria-hidden className="size-5 text-primary" />
      <span>
        Esperando a <strong className="text-foreground">{nick}</strong>
      </span>
      <span className="font-mono tabular-nums">
        {fmtClock(secondsLeft(expiresAt, now) * 1000)}
      </span>
    </div>
  )
}

function InviteSlot({ disabled }: { disabled: boolean }) {
  const source = useMmSource()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const term = useDebouncedValue(q, 250)
  const { data: hits, isFetching } = useQuery(playerSearchOptions(source, term))
  const invite = useMmMutation((playerId: string) => source.invite(playerId))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Invitar a un amigo"
          className={cn(
            dashed,
            "border-foreground/20 transition hover:border-primary/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          <UserPlusIcon aria-hidden className="size-5" />
          <span className="text-xs">Invitar</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        <Input
          autoFocus
          placeholder="Buscar por nick"
          aria-label="Buscar jugador por nick"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul className="mt-2 flex max-h-56 flex-col overflow-y-auto">
          {term.trim().length < 2 && (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">
              Escribí al menos 2 letras.
            </li>
          )}
          {term.trim().length >= 2 && !isFetching && hits?.length === 0 && (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">
              Nadie con ese nick.
            </li>
          )}
          {hits?.map((h) => (
            <li key={h.player_id}>
              <button
                type="button"
                disabled={invite.isPending}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() =>
                  invite.mutate(h.player_id, {
                    onSuccess: () => {
                      setOpen(false)
                      setQ("")
                      toast.success(`Invitaste a ${h.nick}`)
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }
              >
                <LevelBadge level={h.level} size={20} />
                {h.nick}
                <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
                  {h.elo}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
