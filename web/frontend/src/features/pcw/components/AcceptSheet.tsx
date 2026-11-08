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
import { avgElo, balance, rosterIssues, sideName, whenLabel } from "../lib/pcw"
import type { PcwPlayer, PcwPost } from "../types"
import { RosterPicker } from "./RosterPicker"

/** Aceptar un anuncio con el roster propio y, si hace falta, proponer otra hora (idea i). */
export function AcceptSheet({
  post,
  onClose,
  initialRoster,
  friends,
  me,
  banned,
  now,
  onAccept,
}: {
  post: PcwPost | null
  onClose: () => void
  initialRoster: PcwPlayer[]
  friends: (PcwPlayer & { team: boolean })[]
  me: PcwPlayer
  banned: string | null
  now: Date
  onAccept: (
    post: PcwPost,
    roster: PcwPlayer[],
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
            initialRoster={initialRoster}
            friends={friends}
            me={me}
            banned={banned}
            now={now}
            onAccept={(r, at) => {
              onAccept(post, r, at)
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
  initialRoster,
  friends,
  me,
  banned,
  now,
  onAccept,
}: {
  post: PcwPost
  initialRoster: PcwPlayer[]
  friends: (PcwPlayer & { team: boolean })[]
  me: PcwPlayer
  banned: string | null
  now: Date
  onAccept: (roster: PcwPlayer[], proposedAt: string | null) => void
}) {
  const [roster, setRoster] = useState(initialRoster)
  const [propose, setPropose] = useState(false)
  const [when, setWhen] = useState("")
  const issues = rosterIssues(roster, { banned })
  const bal = balance(avgElo(roster), avgElo(post.side.roster))

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>Aceptar contra {sideName(post.side)}</SheetTitle>
        <SheetDescription>
          BO{post.best_of} · {whenLabel(post.starts_at, now)}. Al aceptar se
          crea la práctica y los dos equipos marcan "Estamos listos" para el
          veto y el servidor. Las PCW no suman ni restan ELO.
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 p-4">
        <RosterPicker
          value={roster}
          onChange={setRoster}
          friends={friends}
          me={me}
        />

        <p className="text-sm">
          Con este roster: ELO medio{" "}
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
                La práctica queda con la hora del anuncio hasta que{" "}
                {sideName(post.side)} acepte el cambio.
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
              roster,
              propose && when ? new Date(when).toISOString() : null
            )
          }
        >
          {propose ? "Aceptar y proponer la hora" : "Aceptar"}
        </Button>
      </SheetFooter>
    </>
  )
}
