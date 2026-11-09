import { AlertTriangleIcon } from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { mapLabel } from "@/features/matchmaking/labels"
import { avgElo, balance, rosterIssues, sideName, whenLabel } from "../lib/pcw"
import { fixedMaps } from "../lib/series"
import type { PcwPlayer, PcwPost, PcwTeamRef } from "../types"
import { SidePicker, type SideChoice } from "./SidePicker"

/** Aceptar un anuncio con el roster propio y, si hace falta, proponer otra hora (idea i). */
export function AcceptSheet({
  post,
  onClose,
  myTeam,
  plantel,
  friends,
  me,
  banned,
  now,
  onAccept,
}: {
  post: PcwPost | null
  onClose: () => void
  myTeam: PcwTeamRef | null
  plantel: PcwPlayer[]
  friends: (PcwPlayer & { team: boolean })[]
  me: PcwPlayer
  banned: string | null
  now: Date
  onAccept: (
    post: PcwPost,
    choice: SideChoice,
    proposedAt: string | null
  ) => void
}) {
  return (
    <Sheet open={post !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-[480px]">
        {post && (
          <AcceptForm
            key={post.id}
            post={post}
            myTeam={myTeam}
            plantel={plantel}
            friends={friends}
            me={me}
            banned={banned}
            now={now}
            onAccept={(c, at) => {
              onAccept(post, c, at)
              onClose()
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function AcceptForm({
  post,
  myTeam,
  plantel,
  friends,
  me,
  banned,
  now,
  onAccept,
}: {
  post: PcwPost
  myTeam: PcwTeamRef | null
  plantel: PcwPlayer[]
  friends: (PcwPlayer & { team: boolean })[]
  me: PcwPlayer
  banned: string | null
  now: Date
  onAccept: (choice: SideChoice, proposedAt: string | null) => void
}) {
  // Por defecto, como equipo: entra cualquiera del plantel. Sin equipo, como mix.
  const [choice, setChoice] = useState<SideChoice>(
    myTeam
      ? { asTeam: true, name: "", roster: plantel }
      : { asTeam: false, name: "", roster: [me] }
  )
  const roster = choice.roster
  const [propose, setPropose] = useState(false)
  const [when, setWhen] = useState("")
  const issues =
    choice.asTeam && myTeam
      ? [
          ...(plantel.filter((p) => !p.guest).length < 4
            ? [
                `El plantel de ${myTeam.name} tiene menos de 4 jugadores con cuenta.`,
              ]
            : []),
          ...(banned ? [banned] : []),
        ]
      : rosterIssues(roster, { banned: null })
  const bal = balance(avgElo(roster), avgElo(post.side.roster))

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>Mandar una oferta a {sideName(post.side)}</SheetTitle>
        <SheetDescription>
          BO{post.best_of} · {whenLabel(post.starts_at, now)}. El que publicó
          elige entre las ofertas que le llegan; si te elige, la práctica queda
          en Mis PCW. Las PCW no suman ni restan ELO.
          {fixedMaps(post.map_pool, post.best_of) && (
            <>
              {" "}
              Se juega{" "}
              <b>
                {fixedMaps(post.map_pool, post.best_of)!
                  .map(mapLabel)
                  .join(", ")}
              </b>
              , sin veto.
            </>
          )}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 p-4">
        <SidePicker
          value={choice}
          onChange={setChoice}
          myTeam={myTeam}
          plantel={plantel}
          friends={friends}
          me={me}
        />

        <p className="text-sm">
          {choice.asTeam ? "Con el plantel" : "Con este roster"}: ELO medio{" "}
          <b className="font-mono">{avgElo(roster)}</b> contra{" "}
          <b className="font-mono">{avgElo(post.side.roster)}</b> ·{" "}
          <b>{bal.label}</b>
        </p>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Switch
              id="acc-propose"
              checked={propose}
              onCheckedChange={setPropose}
            />
            <Label htmlFor="acc-propose">Proponer otra hora</Label>
          </div>
          {propose && (
            <>
              <Input
                type="datetime-local"
                aria-label="Hora propuesta"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">
                Si {sideName(post.side)} elige tu oferta, la práctica queda con
                esta hora.
              </span>
            </>
          )}
        </div>

        {issues.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangleIcon aria-hidden />
            <AlertDescription>
              <ul className="list-disc pl-4">
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <SheetFooter className="border-t">
        <Button
          disabled={issues.length > 0 || (propose && !when)}
          onClick={() =>
            onAccept(
              choice,
              propose && when ? new Date(when).toISOString() : null
            )
          }
        >
          {propose ? "Mandar oferta con otra hora" : "Mandar oferta"}
        </Button>
      </SheetFooter>
    </>
  )
}
