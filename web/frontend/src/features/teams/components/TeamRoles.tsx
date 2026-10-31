import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { UserIcon } from "lucide-react"
import { ROLE_SLOTS, rolesMap, type RoleSlot } from "../lib/model"
import type { RosterEntry } from "../types"
import { Eyebrow, Initial, Panel } from "./ui"

// --- Roles de equipo -----------------------------------------------------

const SLOT_POSITION: Record<RoleSlot, string> = {
  Entry: "left-1/2 top-[64px] -translate-x-1/2",
  Support: "left-[18%] top-[180px] -translate-x-1/2",
  Lurker: "left-[82%] top-[180px] -translate-x-1/2",
  IGL: "left-1/2 top-[250px] -translate-x-1/2",
  AWPer: "left-1/2 top-[410px] -translate-x-1/2",
}

/**
 * Mapa de roles: cada jugador va en el lugar del puesto que eligió en su perfil (`game_role`).
 * Pueden repetirse; Rifler, Otro y los que no eligieron puesto van debajo del mapa.
 */
export function TeamRoles({ members }: { members: RosterEntry[] }) {
  const { slots, others } = rolesMap(members)
  return (
    <Panel
      title="Roles de equipo"
      aside="Cada jugador elige su puesto en su perfil"
    >
      <div
        className="relative min-h-[540px] overflow-hidden bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] bg-[size:36px_36px]"
        role="list"
        aria-label="Roles de equipo"
      >
        <Eyebrow className="absolute top-3 left-4 text-[10px] text-muted-foreground">
          ↑ Línea de avance
        </Eyebrow>
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 size-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed"
        />
        {ROLE_SLOTS.map((slot) => (
          <RoleSpot key={slot} slot={slot} players={slots[slot]} />
        ))}
        <Eyebrow className="absolute bottom-3 left-4 text-[10px] text-muted-foreground">
          Retaguardia
        </Eyebrow>
      </div>
      {others.length > 0 && (
        <div className="flex flex-col gap-2 border-t px-[18px] py-3">
          <Eyebrow className="text-[10px] text-muted-foreground">
            Otros puestos
          </Eyebrow>
          <ul className="flex flex-wrap gap-2">
            {others.map((m) => (
              <li
                key={m.player_id}
                className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1"
              >
                <Initial
                  name={m.alias}
                  photo={m.photo_url}
                  className="size-6"
                  fallbackClassName="text-[10px]"
                />
                <span className="text-[13px] font-medium">{m.alias}</span>
                <span className="text-xs text-muted-foreground">
                  {m.game_role ?? "Sin puesto"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

/** Un lugar del mapa: los jugadores con ese puesto (hasta 3 caras y "+n"), o "Sin asignar". */
function RoleSpot({
  slot,
  players,
}: {
  slot: RoleSlot
  players: RosterEntry[]
}) {
  const shown = players.slice(0, 3)
  const extra = players.length - shown.length
  return (
    <div
      role="listitem"
      className={cn(
        "absolute flex flex-col items-center gap-1.5",
        SLOT_POSITION[slot]
      )}
    >
      {players.length === 0 ? (
        <span className="grid size-14 place-items-center rounded-full border-2 border-dashed bg-card text-muted-foreground">
          <UserIcon className="size-4" aria-hidden />
        </span>
      ) : (
        <span className="flex -space-x-3">
          {shown.map((m) => (
            <Link
              key={m.player_id}
              to="/player/$nick"
              params={{ nick: m.alias }}
              aria-label={`Perfil de ${m.alias}`}
              className="rounded-full ring-2 ring-card outline-none hover:ring-primary focus-visible:ring-ring"
            >
              <Initial
                name={m.alias}
                photo={m.photo_url}
                className="size-14"
                fallbackClassName="text-lg"
              />
            </Link>
          ))}
          {extra > 0 && (
            <span className="grid size-14 place-items-center rounded-full bg-muted font-mono text-sm font-semibold ring-2 ring-card">
              +{extra}
            </span>
          )}
        </span>
      )}
      <span className="max-w-[160px] truncate text-sm font-semibold whitespace-nowrap">
        {players.length === 0
          ? "Sin asignar"
          : players.map((m) => m.alias).join(", ")}
      </span>
      <span className="rounded-full bg-muted px-2 font-mono text-[10px] font-semibold tracking-[1px] uppercase">
        {slot}
      </span>
    </div>
  )
}
