import { createFileRoute, notFound } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { VerifiedBadge } from "@/components/brand/VerifiedBadge"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  COMMENT_MAX,
  WallComments,
  WallVotes,
  type Wall,
  type WallComment,
} from "@/features/player/components/ProfileWall"

// Ejemplo de los comentarios, los votos y la insignia de verificado del perfil, sin API ni sesión (bitácoras
// 2026-11-09-comentarios-perfil y 2026-11-09-jugadores-verificados). Solo en `pnpm dev`.
export const Route = createFileRoute("/demo/perfil-social")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoPerfilSocial,
})

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const author = (
  nick: string,
  level: number,
  verified: "gray" | "gold" | null = null
) => ({ player_id: `p-${nick}`, nick, photo_url: null, level, verified })

const SEED: WallComment[] = [
  {
    id: "c1",
    body: "Qué clutch el 1v3 en mirage ayer, monstruo 🔥",
    created_at: ago(12),
    author: author("kz.flick", 9, "gold"),
    mine: false,
    can_report: true,
    can_delete: false,
  },
  {
    id: "c2",
    body: "Buen compañero, habla y juega para el equipo. +1",
    created_at: ago(180),
    author: author("tobi_", 6, "gray"),
    mine: false,
    can_report: true,
    can_delete: false,
  },
  {
    id: "c3",
    body: "gg wp, la revancha el finde",
    created_at: ago(60 * 26),
    author: author("nacho.awp", 7),
    mine: false,
    can_report: true,
    can_delete: false,
  },
]

function DemoPerfilSocial() {
  const [owner, setOwner] = useState(false)
  const [signedIn, setSignedIn] = useState(true)
  const [moderator, setModerator] = useState(false)
  const [open, setOpen] = useState(true)
  const [badge, setBadge] = useState<"gray" | "gold" | null>("gold")
  const [items, setItems] = useState(SEED)
  const [likes, setLikes] = useState(41)
  const [dislikes, setDislikes] = useState(3)
  const [myVote, setMyVote] = useState<1 | -1 | null>(null)
  const [lastSent, setLastSent] = useState(0)

  const canVote = signedIn && !owner
  const wall: Wall = {
    likes,
    dislikes,
    my_vote: canVote ? myVote : null,
    can_vote: canVote,
    is_owner: owner && signedIn,
    comments_open: open,
    can_comment: open && signedIn,
    restriction: null,
    total: open ? items.length : 0,
    items: open
      ? items.map((c) => ({
          ...c,
          can_delete: signedIn && (c.mine || owner || moderator),
        }))
      : [],
  }

  const vote = (v: 1 | -1 | 0) => {
    if (myVote === 1) setLikes((n) => n - 1)
    if (myVote === -1) setDislikes((n) => n - 1)
    if (v === 1) setLikes((n) => n + 1)
    if (v === -1) setDislikes((n) => n + 1)
    setMyVote(v === 0 ? null : v)
  }
  const send = async (body: string) => {
    // Como la base: 30 segundos entre comentarios.
    if (Date.now() - lastSent < 30_000) {
      toast.error("Espera unos segundos antes de comentar de nuevo")
      throw new Error("tope")
    }
    if (body.length > COMMENT_MAX) throw new Error("largo")
    setLastSent(Date.now())
    setItems((list) => [
      {
        id: `c${Date.now()}`,
        body,
        created_at: new Date().toISOString(),
        author: author(owner ? "pepon" : "vos", 5),
        mine: true,
        can_report: false,
        can_delete: true,
      },
      ...list,
    ])
  }

  const flag = (
    id: string,
    label: string,
    on: boolean,
    set: (v: boolean) => void
  ) => (
    <span className="inline-flex items-center gap-1.5">
      <Switch id={id} size="sm" checked={on} onCheckedChange={set} />
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
    </span>
  )

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3 text-sm">
        <span className="mr-1 font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
          Demo
        </span>
        {flag("d-owner", "Es mi perfil", owner, setOwner)}
        {flag("d-signed", "Con sesión", signedIn, setSignedIn)}
        {flag("d-mod", "Soy moderador", moderator, setModerator)}
        <span className="ml-auto inline-flex rounded-lg border p-0.5">
          {(
            [
              [null, "Sin insignia"],
              ["gray", "Gris"],
              ["gold", "Dorada"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={badge === k}
              onClick={() => setBadge(k)}
              className="rounded-md px-2.5 py-1 text-xs font-medium aria-pressed:bg-secondary"
            >
              {label}
            </button>
          ))}
        </span>
      </div>

      {/* El encabezado del perfil, resumido: la insignia al lado del nick y los votos a la derecha. */}
      <Card variant="outline">
        <div className="flex flex-wrap items-center gap-5 p-5">
          <PlayerAvatar
            alias="pepon"
            photo={null}
            className="size-24 rounded-xl after:rounded-xl"
            fallbackClassName="rounded-xl text-4xl"
          />
          <div className="flex min-w-[200px] flex-1 flex-col gap-2">
            <span className="inline-flex items-center gap-1.5">
              <h1 className="text-[28px] font-bold tracking-[-0.6px]">pepon</h1>
              {badge && (
                <VerifiedBadge
                  kind={badge}
                  note={badge === "gold" ? "Jugador profesional" : null}
                  sealClassName="size-6"
                />
              )}
            </span>
            <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
              <LevelBadge level={7} size={22} /> 1413 ELO · Argentina
            </span>
          </div>
          <WallVotes wall={wall} onVote={vote} />
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="border-b pb-2 text-sm font-semibold">
          Comentarios{" "}
          {open && (
            <span className="rounded-full bg-foreground px-1.5 font-mono text-[11px] text-background">
              {items.length}
            </span>
          )}
        </h2>
        <WallComments
          wall={wall}
          onSend={send}
          onDelete={(id) => setItems((l) => l.filter((c) => c.id !== id))}
          onReport={async () => {
            toast.success("Denuncia enviada", {
              description: "En la demo no se guarda.",
            })
          }}
          onSetOpen={setOpen}
        />
      </section>
    </div>
  )
}
