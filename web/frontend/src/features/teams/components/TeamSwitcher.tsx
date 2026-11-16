import { cn } from "cn"
import {
  CheckIcon,
  PlusIcon,
  ChevronsUpDownIcon,
  SearchIcon,
  StarIcon,
} from "lucide-react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"

import { Segmented } from "@/components/brand/Segmented"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MY_ROLE_LABEL, type MyRole } from "../lib/model"
import { crestText } from "@/components/brand/TeamCrest"
import { Eyebrow } from "./ui"
import { useSetPrimaryTeam } from "../api/queries"
import { TeamCrest } from "@/components/brand/TeamCrest"

export type MyTeam = {
  id: string
  name: string
  tag: string | null
  logo_url?: string | null
  role: MyRole | null
  /** El principal: el que marcó o, si no marcó ninguno, el más antiguo (va primero). */
  is_primary?: boolean
}

/** "Mis equipos": segmentado hasta 3 equipos; desde 4, un desplegable. */
export function TeamSwitcher({
  teams,
  currentId,
  onSelect,
  onFind,
  onCreate,
}: {
  teams: MyTeam[]
  currentId: string
  onSelect: (id: string) => void
  /** Buscar otro equipo: se puede estar en varios. */
  onFind: () => void
  /** Crear otro equipo: solo si todavía puede ser capitán de uno más (`team_config.max_led`). */
  onCreate?: () => void
}) {
  const current = teams.find((t) => t.id === currentId) ?? teams[0]

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Eyebrow className="text-muted-foreground">Mis equipos</Eyebrow>
      {teams.length <= 3 ? (
        <Segmented
          size="lg"
          label="Mis equipos"
          value={current.id}
          options={teams.map((t) => ({
            value: t.id,
            label: (
              <>
                <span className="font-mono text-[11px] font-semibold">
                  {crestText(t)}
                </span>
                <span className="font-semibold">{t.name}</span>
                {t.is_primary && (
                  <StarIcon
                    className="size-3.5 fill-primary text-primary"
                    aria-label="Equipo principal"
                  />
                )}
                {t.role && (
                  <span className="text-[11px] text-muted-foreground">
                    {MY_ROLE_LABEL[t.role]}
                  </span>
                )}
              </>
            ),
          }))}
          onChange={onSelect}
          className="h-[34px]"
          itemClassName="h-auto gap-2 px-2.5 font-normal"
        />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="lg"
              className="max-w-full gap-2"
              aria-label={`Mis equipos: ${current.name}`}
            >
              <TeamCrest team={current} size="xs" />
              <span className="truncate font-semibold">{current.name}</span>
              {current.role && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  {MY_ROLE_LABEL[current.role]}
                </span>
              )}
              <ChevronsUpDownIcon
                className="size-4 text-muted-foreground"
                aria-hidden
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[290px]">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Tus equipos · {teams.length}
            </DropdownMenuLabel>
            {teams.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onSelect={() => onSelect(t.id)}
                className="gap-2.5"
              >
                <TeamCrest team={t} size="xs" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-semibold">{t.name}</span>
                    {t.is_primary && (
                      <StarIcon
                        className="size-3.5 shrink-0 fill-primary text-primary"
                        aria-label="Equipo principal"
                      />
                    )}
                  </span>
                  {t.role && (
                    <span className="text-[11px] text-muted-foreground">
                      {MY_ROLE_LABEL[t.role]}
                    </span>
                  )}
                </span>
                <CheckIcon
                  className={cn(
                    "size-4 text-primary",
                    t.id !== current.id && "invisible"
                  )}
                  aria-hidden
                />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {teams.length > 1 && <PrimaryStar team={current} />}
      <Button variant="outline" size="sm" onClick={onFind}>
        <SearchIcon aria-hidden />
        Buscar equipo
      </Button>
      {onCreate && (
        <Button variant="outline" size="sm" onClick={onCreate}>
          <PlusIcon aria-hidden />
          Crear equipo
        </Button>
      )}
    </div>
  )
}

/**
 * Marca como principal el equipo que se está viendo. Si ya lo es, solo lo dice: para cambiarlo se marca otro
 * (sin marcar, el principal es el más antiguo).
 */
function PrimaryStar({ team }: { team: MyTeam }) {
  const setPrimary = useSetPrimaryTeam()
  if (team.is_primary)
    return (
      <span className="inline-flex h-8 items-center gap-1.5 text-sm font-medium text-primary">
        <StarIcon className="size-4 fill-primary" aria-hidden />
        Equipo principal
      </span>
    )
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={setPrimary.isPending}
      onClick={() =>
        setPrimary.mutate(team.id, {
          onSuccess: () => toast.success(`${team.name} es tu equipo principal`),
          onError: (e) => toast.error(errorMessage(e)),
        })
      }
    >
      <StarIcon aria-hidden />
      Marcar como principal
    </Button>
  )
}
