import { cn } from "cn"
import { PlusIcon, UserPlusIcon, XIcon } from "lucide-react"
import { useState } from "react"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { levelOf } from "@/features/matchmaking/room/roomData"
import { LEVEL_FLOORS } from "@/features/player/lib/labels"
import { MAX_ROSTER, MIN_ACCOUNTS } from "../lib/pcw"
import type { PcwPlayer } from "../types"

/**
 * Roster de una PCW: los elegidos arriba y, abajo, los compañeros del equipo y los amigos para
 * sumar con un clic, más invitados sin cuenta por nombre.
 */
export function RosterPicker({
  value,
  onChange,
  friends,
  me,
}: {
  value: PcwPlayer[]
  onChange: (v: PcwPlayer[]) => void
  friends: (PcwPlayer & { team: boolean })[]
  me: PcwPlayer
}) {
  const [guest, setGuest] = useState("")
  const chosen = new Set(value.map((p) => p.id))
  const accounts = value.filter((p) => !p.guest).length
  const full = value.length >= MAX_ROSTER
  const add = (pl: PcwPlayer) => !full && onChange([...value, pl])
  const remove = (id: string) => onChange(value.filter((p) => p.id !== id))

  function addGuest() {
    const name = guest.trim()
    if (!name || full) return
    add({ id: `guest-${name}`, alias: name, elo: 0, guest: true })
    setGuest("")
  }

  const groups = [
    { label: "De tu equipo", list: friends.filter((f) => f.team) },
    { label: "Amigos", list: friends.filter((f) => !f.team) },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">Roster</span>
        <span
          className={cn(
            "text-xs",
            accounts < MIN_ACCOUNTS
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        >
          {accounts} con cuenta · {value.length} de {MAX_ROSTER}
        </span>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {value.map((pl) => (
          <li key={pl.id}>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card pr-1 pl-1">
              <PlayerAvatar
                alias={pl.alias}
                photo={pl.photo}
                className="size-6"
              />
              <span className="text-[13px] font-medium">{pl.alias}</span>
              {pl.guest ? (
                <Badge variant="muted" size="xs" shape="pill">
                  invitado
                </Badge>
              ) : (
                <LevelBadge level={levelOf(pl.elo, LEVEL_FLOORS)} size={20} />
              )}
              {pl.id !== me.id && (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Sacar a ${pl.alias}`}
                  onClick={() => remove(pl.id)}
                  className="rounded-full"
                >
                  <XIcon />
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {groups.map(
        (g) =>
          g.list.some((f) => !chosen.has(f.id)) && (
            <div key={g.label} className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">{g.label}</span>
              <div className="flex flex-wrap gap-1.5">
                {g.list
                  .filter((f) => !chosen.has(f.id))
                  .map((f) => (
                    <Button
                      key={f.id}
                      size="sm"
                      variant="outline"
                      disabled={full}
                      onClick={() =>
                        add({
                          id: f.id,
                          alias: f.alias,
                          elo: f.elo,
                          photo: f.photo,
                        })
                      }
                      className="rounded-full"
                    >
                      <PlusIcon />
                      {f.alias}
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {f.elo}
                      </span>
                    </Button>
                  ))}
              </div>
            </div>
          )
      )}

      <div className="flex gap-2">
        <Input
          value={guest}
          onChange={(e) => setGuest(e.target.value.slice(0, 24))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addGuest()
            }
          }}
          placeholder="Invitado sin cuenta (nick)"
          aria-label="Nick del invitado"
          disabled={full}
        />
        <Button
          variant="outline"
          onClick={addGuest}
          disabled={!guest.trim() || full}
        >
          <UserPlusIcon />
          Sumar
        </Button>
      </div>
    </div>
  )
}
