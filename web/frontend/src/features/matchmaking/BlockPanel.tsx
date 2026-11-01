import { useQuery } from "@tanstack/react-query"
import { LockIcon, UserXIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { VipBadge } from "@/features/shop/cosmetics"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { playerSearchOptions, useMmMutation } from "./queries"
import { useMmSource } from "./source"
import type { MmState } from "./types"

// Bloqueo (plan, decisión "Bloqueo de compañeros"): con quien bloqueaste no te toca en el mismo
// equipo, pero sí te puede tocar en contra. Al principio, 1 solo y exclusivo de VIP.

export function BlockPanel({ blocks }: { blocks: MmState["blocks"] }) {
  const source = useMmSource()
  const remove = useMmMutation((id: string) => source.unblock(id))
  const block = useMmMutation((id: string) => source.block(id))
  const canAdd = blocks.allowed && blocks.list.length < blocks.max

  return (
    <section
      aria-label="Bloqueo"
      className="flex flex-col overflow-hidden rounded-xl border bg-card"
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <UserXIcon aria-hidden className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Bloqueo</h2>
        {blocks.vip_only && <VipBadge />}
        <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
          {blocks.list.length}/{blocks.max}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <p className="text-[13px] text-muted-foreground">
          No te toca en tu equipo. En contra, sí.
        </p>
        {!blocks.allowed ? (
          <p className="inline-flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[13px]">
            <LockIcon aria-hidden className="size-4 text-muted-foreground" />
            Exclusivo para VIP
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-1">
              {blocks.list.map((b) => (
                <li
                  key={b.player_id}
                  className="flex items-center gap-2 rounded-lg bg-muted/60 py-1 pr-1 pl-3 text-[13px] font-medium"
                >
                  {b.nick}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="ml-auto"
                    aria-label={`Sacar el bloqueo a ${b.nick}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(b.player_id)}
                  >
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ul>
            {canAdd && (
              <PlayerPicker
                label="Buscar a quién bloquear"
                verb="Bloquear"
                pending={block.isPending}
                onPick={(id, done) =>
                  block.mutate(id, {
                    onSuccess: done,
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }
              />
            )}
          </>
        )}
      </div>
    </section>
  )
}

export function PlayerPicker({
  label,
  verb,
  pending,
  onPick,
}: {
  label: string
  verb: string
  pending: boolean
  /** `done` limpia la búsqueda. */
  onPick: (playerId: string, done: () => void) => void
}) {
  const source = useMmSource()
  const [q, setQ] = useState("")
  const term = useDebouncedValue(q, 250)
  const { data: hits } = useQuery(playerSearchOptions(source, term))
  return (
    <>
      <Input
        aria-label={label}
        placeholder="Buscar por nick"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-8"
      />
      {term.trim().length >= 2 && (
        <ul className="flex max-h-32 flex-col overflow-y-auto">
          {hits?.map((h) => (
            <li key={h.player_id}>
              <button
                type="button"
                disabled={pending}
                aria-label={`${verb} a ${h.nick}`}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] hover:bg-muted"
                onClick={() => onPick(h.player_id, () => setQ(""))}
              >
                <LevelBadge level={h.level} size={20} />
                {h.nick}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
