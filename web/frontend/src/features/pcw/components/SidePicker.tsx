import { UsersIcon } from "lucide-react"

import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { Segmented } from "@/components/brand/Segmented"
import { TeamCrest } from "@/components/brand/TeamCrest"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MAX_STANDINS, MIN_ROSTER } from "../lib/series"
import type { PcwPlayer, PcwTeamRef } from "../types"
import { RosterPicker } from "./RosterPicker"

/** Con quién se juega: el equipo, con o sin plantel elegido, o un mix con su nombre. */
export type SideChoice = {
  asTeam: boolean
  /** Nombre del mix (como equipo, el del equipo). */
  name: string
  /** Roster del mix. Como equipo es el plantel entero: entra cualquiera. */
  roster: PcwPlayer[]
}

/**
 * Elegir con quién se juega (Kyan, 2026-11-08), para publicar y para mandar una oferta:
 * - **Tu equipo:** no se arma un roster; entra cualquiera del plantel (y hasta 2 suplentes en el servidor).
 * - **Mix de amigos:** se le pone nombre y se eligen los jugadores.
 */
export function SidePicker({
  value,
  onChange,
  myTeam,
  plantel,
  friends,
  me,
}: {
  value: SideChoice
  onChange: (v: SideChoice) => void
  /** Sin equipo (no soy capitán ni dueño de uno), solo se juega como mix. */
  myTeam: PcwTeamRef | null
  plantel: PcwPlayer[]
  friends: (PcwPlayer & { team: boolean })[]
  me: PcwPlayer
}) {
  return (
    <div className="flex flex-col gap-3">
      {myTeam && (
        <div className="flex flex-col gap-2">
          <Label>¿Con quién juegan?</Label>
          <Segmented
            label="Con quién juegan"
            value={value.asTeam ? "team" : "mix"}
            onChange={(k) =>
              onChange(
                k === "team"
                  ? { ...value, asTeam: true, roster: plantel }
                  : { ...value, asTeam: false, roster: [me] }
              )
            }
            options={[
              { value: "team", label: myTeam.name },
              { value: "mix", label: "Mix de amigos" },
            ]}
          />
        </div>
      )}

      {value.asTeam && myTeam ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2.5">
            <TeamCrest team={myTeam} size="row" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">
                {myTeam.name}
              </span>
              <span className="text-xs text-muted-foreground">
                Puede entrar cualquiera del plantel · {plantel.length} jugadores
              </span>
            </div>
          </div>
          <ul aria-label="Plantel" className="flex flex-wrap gap-1.5">
            {plantel.map((p) => (
              <li
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card py-0.5 pr-2.5 pl-0.5 text-xs"
              >
                <PlayerAvatar
                  alias={p.alias}
                  photo={p.photo}
                  className="size-5"
                />
                {p.alias}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            No hace falta elegir quiénes: en el servidor cuentan los que entren,
            al menos {MIN_ROSTER} del plantel y hasta {MAX_STANDINS} suplentes.
            Si ganan, suma al ranking de equipos.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="side-name">Nombre del equipo</Label>
            <Input
              id="side-name"
              value={value.name}
              maxLength={24}
              placeholder={`Pick de ${me.alias}`}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
            />
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <UsersIcon aria-hidden className="size-3" />
              Mix de amigos: no suma al ranking de equipos.
            </span>
          </div>
          <RosterPicker
            value={value.roster}
            onChange={(roster) => onChange({ ...value, roster })}
            friends={friends}
            me={me}
          />
        </>
      )}
    </div>
  )
}
