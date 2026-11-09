import { Link } from "@tanstack/react-router"
import { cn } from "cn"

import type { PcwTeamRef } from "../types"

/**
 * El nombre de un bando: si juega como un equipo oficial, lleva a su perfil de equipo (en otra pestaña, para no
 * perder lo que se estaba mirando). Un mix de amigos queda como texto.
 */
export function TeamName({
  team,
  name,
  className,
}: {
  team: PcwTeamRef | null
  /** El nombre a mostrar (el del bando, que puede no ser el del equipo). */
  name?: string
  className?: string
}) {
  const text = name ?? team?.name ?? ""
  if (!team) return <span className={className}>{text}</span>
  return (
    <Link
      to="/teams/$id"
      params={{ id: team.id }}
      target="_blank"
      rel="noreferrer"
      title={`Ver el perfil de ${team.name}`}
      className={cn(
        "rounded-sm underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className
      )}
    >
      {text}
    </Link>
  )
}
