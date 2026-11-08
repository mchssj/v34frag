import { AlertTriangleIcon } from "lucide-react"
import { useState } from "react"

import { Segmented } from "@/components/brand/Segmented"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { MapPoolPicker } from "@/features/maps/components/MapPoolPicker"
import type { MapEntry } from "@/features/maps/types"
import type { PublishInput } from "../demo"
import { rosterIssues } from "../lib/pcw"
import type { BestOf, PcwPlayer, PcwTeamRef } from "../types"
import { RosterPicker } from "./RosterPicker"

/** "datetime-local" en hora local ↔ ISO. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)

/** Publicar una PCW en un panel lateral. Arranca con `initial` (vacío o "Repetir la última"). */
export function PublishSheet({
  open,
  onOpenChange,
  initial,
  formats,
  maps,
  friends,
  me,
  myTeam,
  teams,
  banned,
  onPublish,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial: PublishInput
  formats: BestOf[]
  maps: MapEntry[]
  friends: (PcwPlayer & { team: boolean })[]
  me: PcwPlayer
  myTeam: PcwTeamRef
  teams: PcwTeamRef[]
  banned: string | null
  onPublish: (input: PublishInput) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-[520px]">
        {/* La key reinicia el formulario cada vez que se abre con otros datos. */}
        {open && (
          <PublishForm
            key={JSON.stringify(initial)}
            initial={initial}
            formats={formats}
            maps={maps}
            friends={friends}
            me={me}
            myTeam={myTeam}
            teams={teams}
            banned={banned}
            onPublish={(i) => {
              onPublish(i)
              onOpenChange(false)
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function PublishForm({
  initial,
  formats,
  maps,
  friends,
  me,
  myTeam,
  teams,
  banned,
  onPublish,
}: Omit<Parameters<typeof PublishSheet>[0], "open" | "onOpenChange">) {
  const [v, setV] = useState(initial)
  const set = <K extends keyof PublishInput>(k: K, val: PublishInput[K]) =>
    setV((x) => ({ ...x, [k]: val }))
  // Como equipo, todo el roster con cuenta tiene que ser del plantel (regla de la base).
  const outsiders = v.asTeam
    ? v.roster.filter(
        (p) =>
          !p.guest &&
          p.id !== me.id &&
          !friends.some((f) => f.id === p.id && f.team)
      )
    : []
  const issues = [
    ...rosterIssues(v.roster, {
      banned: v.asTeam ? banned : null,
      bo: v.best_of,
      formats,
    }),
    ...outsiders.map((p) => `${p.alias} no es del plantel de ${myTeam.name}.`),
  ]

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>Publicar una PCW</SheetTitle>
        <SheetDescription>
          La ven todos en el tablón hasta que alguien la acepte. Para publicar
          hacen falta 4 jugadores con cuenta. Las PCW no suman ni restan ELO.
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 p-4">
        <div className="flex flex-col gap-2">
          <Label>Formato</Label>
          <Segmented
            label="Formato"
            value={v.best_of}
            onChange={(bo) => set("best_of", bo)}
            options={formats.map((f) => ({ value: f, label: `BO${f}` }))}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Switch
              id="pub-team"
              checked={v.asTeam}
              onCheckedChange={(on) => set("asTeam", on)}
            />
            <Label htmlFor="pub-team">Jugar como {myTeam.name}</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {v.asTeam
              ? "Todo el roster con cuenta tiene que ser del plantel. Si ganan, suma al ranking de equipos."
              : "Mix de amigos: no suma al ranking de equipos ni al ELO."}
          </p>
        </div>

        <RosterPicker
          value={v.roster}
          onChange={(r) => set("roster", r)}
          friends={friends}
          me={me}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pub-when">Hora</Label>
            <Input
              id="pub-when"
              type="datetime-local"
              value={toLocalInput(v.starts_at)}
              onChange={(e) => set("starts_at", fromLocalInput(e.target.value))}
            />
            <span className="text-xs text-muted-foreground">
              Vacío: a convenir.
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pub-name">Nombre del bando</Label>
            <Input
              id="pub-name"
              value={v.name}
              maxLength={24}
              placeholder={`Pick de ${me.alias}`}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
        </div>

        <MapPoolPicker
          maps={maps}
          value={v.map_pool}
          onChange={(p) => set("map_pool", p)}
          minMaps={v.best_of}
          kind="anuncio"
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="pub-note">Nota</Label>
          <Textarea
            id="pub-note"
            value={v.note}
            maxLength={200}
            placeholder="Ej.: buscamos algo serio, con Discord."
            onChange={(e) => set("note", e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Desafío directo</Label>
          <Select
            value={v.invited?.id ?? "all"}
            onValueChange={(id) =>
              set("invited", teams.find((t) => t.id === id) ?? null)
            }
          >
            <SelectTrigger aria-label="Desafío directo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Abierta a todos</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  Solo {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            Con un equipo elegido, solo ese equipo la puede aceptar y le llega
            un aviso.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="pub-discord"
            checked={v.discord}
            onCheckedChange={(on) => set("discord", on)}
          />
          <Label htmlFor="pub-discord">Avisar en el Discord de CM League</Label>
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
        <Button disabled={issues.length > 0} onClick={() => onPublish(v)}>
          Publicar
        </Button>
      </SheetFooter>
    </>
  )
}
