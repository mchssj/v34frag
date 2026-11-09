import {
  CrownIcon,
  CrosshairIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  ZapIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/brand/EmptyState"
import { FilterChips } from "@/components/brand/FilterChips"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { errorMessage } from "@/api/errors"
import { useNow } from "@/features/matchmaking/useNow"
import { avgElo, filterPosts, sideName, whenLabel } from "../lib/pcw"
import { currentMap } from "../lib/room"
import type { PcwModel, PublishInput } from "../model"
import type {
  BestOf,
  KindFilter,
  PcwFilters,
  PcwMatch,
  PcwPost,
  TimeFilter,
} from "../types"
import { AcceptSheet } from "../components/AcceptSheet"
import { MyPcw } from "../components/MyPcw"
import { MyPost } from "../components/MyPost"
import { DemoNotifications } from "../components/DemoNotifications"
import { BoardHeader, PostRow } from "../components/PostRow"
import { PublishSheet } from "../components/PublishSheet"
import {
  ActivityPanel,
  AlertsPanel,
  BarePanels,
  ServersPanel,
  SubsPanel,
} from "../components/SidePanels"

const UPCOMING: PcwMatch["status"][] = [
  "waiting",
  "ready_us",
  "ready_both",
  "live",
]
/** La práctica que pide atención ahora: una serie en curso o una que empieza en menos de una hora. */
function urgentMatch(matches: PcwMatch[], now: Date) {
  return matches.find(
    (m) =>
      (m.booking &&
        m.booking.step !== "finished" &&
        m.booking.step !== "abandoned") ||
      (UPCOMING.includes(m.status) &&
        m.starts_at !== null &&
        new Date(m.starts_at).getTime() - now.getTime() < 60 * 60_000)
  )
}

const EMPTY_FORM: Omit<PublishInput, "roster"> = {
  best_of: 3,
  starts_at: null,
  note: "",
  name: "",
  asTeam: true,
  map_pool: null,
  discord: true,
  invited: null,
}

/**
 * Lo que devuelve una acción del modelo: en la API, una promesa; en la demo, nada. Con éxito muestra `ok`; si falla,
 * el error de la API.
 */
function run(
  result: Promise<unknown> | void,
  ok?: () => void,
  after?: () => void
) {
  void Promise.resolve(result)
    .then(() => ok?.())
    .catch((e: unknown) => toast.error(errorMessage(e)))
    .finally(() => after?.())
}

/**
 * La página de PCW: Mis PCW, el tablón con filtros y la columna con servidores, suplentes y avisos. Los datos y las
 * acciones vienen del modelo (`usePcwApi` en /pcw, la demo en /demo/pcw).
 */
export function PcwPage({
  model: demo,
  room,
  onRoom,
}: {
  model: PcwModel
  /** La sala abierta (`?sala=` en la URL): la serie después de los dos listos. */
  room?: string
  onRoom: (id: string | null) => void
}) {
  const now = new Date(useNow(true))
  const [filters, setFilters] = useState<PcwFilters>({
    bo: null,
    time: "all",
    myLevel: false,
    kind: "all",
  })
  const [publish, setPublish] = useState<PublishInput | null>(null)
  const [accepting, setAccepting] = useState<PcwPost | null>(null)
  // Abre en Mis PCW si hay algo que atender; si no, en el tablón.
  // La pestaña la elige quien mira; hasta entonces, Mis PCW si hay algo que atender (la API puede tardar en traerlo).
  const [picked, setTab] = useState<"board" | "mine" | null>(null)
  const tab = picked ?? (urgentMatch(demo.matches, now) ? "mine" : "board")
  const [side, setSide] = useState("servers")
  const myTeamId = demo.myTeam?.id ?? ""
  // Publicar una PCW es para VIP (Kyan, 2026-11-08). Ofertar a un anuncio sigue siendo para todos.
  const isVip = demo.isVip
  const startPublish = (input: PublishInput) =>
    isVip ? setPublish(input) : demo.onVipRequired()

  const myElo = avgElo(demo.last.roster)
  // Los desafíos a otro equipo no se ven; el mío va primero. Mi propio anuncio va arriba, en "Tu anuncio".
  const visible = demo.posts
    .filter((p) => p.id !== demo.myPost?.id)
    .filter((p) => !p.invited || p.invited.id === myTeamId)
    .sort((a, b) => Number(!!b.invited) - Number(!!a.invited))
  const board = filterPosts(visible, filters, myElo, now)
  const set = <K extends keyof PcwFilters>(k: K, v: PcwFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }))
  const pool = (p: PcwPost) => p.map_pool ?? demo.defaultPool
  const upcoming = demo.matches.filter(
    (m) => m.booking || UPCOMING.includes(m.status)
  ).length
  const urgent = urgentMatch(demo.matches, now)
  const extraFilters =
    Number(filters.time !== "all") +
    Number(filters.kind !== "all") +
    Number(filters.myLevel)
  const freeServers = demo.servers.filter((x) => x.free).length

  const open = room
    ? demo.matches.find((x) => x.id === room && x.booking)
    : undefined
  if (open) return demo.renderRoom(open, () => onRoom(null), onRoom)
  const emptyForm = (): PublishInput => ({
    ...EMPTY_FORM,
    asTeam: !!demo.myTeam,
    roster: demo.myTeam ? demo.plantel : [demo.me],
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] leading-tight font-bold tracking-[-0.6px]">
            PCW
          </h1>
          <p className="max-w-[560px] text-sm text-muted-foreground">
            Prácticas entre equipos o amigos. Publicá la tuya (VIP) o mandá una
            oferta a una del tablón.
          </p>
        </div>
        <div className="flex items-center gap-2 max-sm:w-full">
          {/* La campana de la web, con los avisos de la demo. En /pcw los avisos llegan a la campana de arriba. */}
          {demo.features.demoBell && demo.notices && (
            <DemoNotifications
              notices={demo.notices}
              onRead={demo.markNoticesRead ?? (() => {})}
            />
          )}
          <Button
            size="sm"
            className="h-8 max-sm:flex-1"
            onClick={() => startPublish(emptyForm())}
          >
            {isVip ? <PlusIcon /> : <CrownIcon />}
            Publicar una PCW
          </Button>
        </div>
      </div>

      {demo.banned && (
        <Alert variant="warning">
          <AlertDescription>{demo.banned}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {urgent && tab === "board" && (
            <button
              type="button"
              onClick={() => setTab("mine")}
              className="flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/5 px-3 py-2 text-left text-sm hover:bg-primary/10"
            >
              <ZapIcon aria-hidden className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">
                Tu PCW vs <b>{sideName(urgent.them)}</b>:{" "}
                {urgent.booking
                  ? "la serie está en marcha"
                  : whenLabel(urgent.starts_at, now)}
              </span>
              <span className="shrink-0 text-xs font-semibold text-primary">
                Ver
              </span>
            </button>
          )}

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "board" | "mine")}
          >
            <TabsList aria-label="Tablón o mis PCW" className="max-sm:w-full">
              <TabsTrigger value="board">
                Tablón
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {visible.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="mine">
                Mis PCW
                {upcoming > 0 && (
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {upcoming}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="board" className="mt-4 flex flex-col gap-6">
              {demo.myPost && (
                <MyPost
                  post={demo.myPost}
                  now={now}
                  myElo={myElo}
                  onRemove={() =>
                    run(demo.removeMyPost(), () => toast("Anuncio borrado"))
                  }
                  onChoose={(id) =>
                    run(demo.chooseOffer(id), () =>
                      toast.success("Elegiste la oferta", {
                        description:
                          "La práctica quedó en Mis PCW; a las demás les avisamos que no.",
                      })
                    )
                  }
                />
              )}

              <section
                aria-labelledby="board-h"
                className="flex flex-col gap-3"
              >
                <h2 id="board-h" className="sr-only">
                  Tablón
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <FilterChips<"all" | "1" | "3" | "5">
                    label="Formato"
                    size="sm"
                    value={filters.bo ? (String(filters.bo) as "1") : "all"}
                    onChange={(v) =>
                      set("bo", v === "all" ? null : (Number(v) as BestOf))
                    }
                    options={[
                      { value: "all", label: "Todos" },
                      ...demo.formats.map((f) => ({
                        value: String(f) as "1",
                        label: `BO${f}`,
                      })),
                    ]}
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <SlidersHorizontalIcon />
                        Más filtros
                        {extraFilters > 0 && (
                          <Badge variant="solid" size="xs" shape="pill">
                            {extraFilters}
                          </Badge>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="flex w-auto max-w-[calc(100vw-2rem)] flex-col gap-3"
                    >
                      <FilterChips<TimeFilter>
                        label="Horario"
                        size="sm"
                        value={filters.time}
                        onChange={(v) => set("time", v)}
                        options={[
                          { value: "all", label: "Cualquier hora" },
                          { value: "now", label: "Ahora" },
                          { value: "today", label: "Hoy" },
                          { value: "later", label: "Más adelante" },
                        ]}
                      />
                      <FilterChips<KindFilter>
                        label="Tipo"
                        size="sm"
                        value={filters.kind}
                        onChange={(v) => set("kind", v)}
                        options={[
                          { value: "all", label: "Equipos y mixes" },
                          { value: "team", label: "Equipos" },
                          { value: "mix", label: "Mixes de amigos" },
                        ]}
                      />
                      <div className="flex items-center gap-2 pt-1">
                        <Switch
                          id="f-level"
                          checked={filters.myLevel}
                          onCheckedChange={(on) => set("myLevel", on)}
                        />
                        <Label htmlFor="f-level" className="text-[13px]">
                          De mi nivel
                        </Label>
                      </div>
                      {extraFilters > 0 && (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="self-start"
                          onClick={() =>
                            setFilters((f) => ({
                              ...f,
                              time: "all",
                              kind: "all",
                              myLevel: false,
                            }))
                          }
                        >
                          Limpiar
                        </Button>
                      )}
                    </PopoverContent>
                  </Popover>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {board.length === visible.length
                      ? `${visible.length} anuncios`
                      : `${board.length} de ${visible.length} anuncios`}
                  </span>
                </div>

                {board.length === 0 ? (
                  <div className="rounded-xl border border-dashed">
                    <EmptyState
                      icon={CrosshairIcon}
                      title={
                        visible.length
                          ? "Ningún anuncio con esos filtros"
                          : "No hay PCW publicadas ahora"
                      }
                      action={
                        <Button
                          variant="outline"
                          onClick={() => startPublish(emptyForm())}
                        >
                          Publicar la primera
                        </Button>
                      }
                    >
                      Publicá la tuya o creá un aviso para enterarte cuando
                      aparezca una de tu nivel.
                    </EmptyState>
                  </div>
                ) : (
                  <Card variant="outline" className="overflow-hidden p-0">
                    <BoardHeader />
                    <ul
                      aria-label="Anuncios"
                      className="flex flex-col divide-y"
                    >
                      {board.map((p) => (
                        <PostRow
                          key={p.id}
                          post={p}
                          now={now}
                          myElo={myElo}
                          myTeamId={myTeamId}
                          results={demo.results}
                          pool={pool(p)}
                          mapImage={demo.mapImage}
                          onAccept={() => setAccepting(p)}
                          onWithdraw={() =>
                            run(demo.withdrawOffer(p.id), () =>
                              toast("Oferta retirada")
                            )
                          }
                        />
                      ))}
                    </ul>
                  </Card>
                )}
              </section>
            </TabsContent>

            <TabsContent value="mine" className="mt-4">
              <MyPcw
                matches={demo.matches}
                now={now}
                results={demo.results}
                myTeamId={myTeamId}
                backdrop={(m) => {
                  const map = m.booking ? currentMap(m) : null
                  const first = demo.defaultPool[0]
                  return map
                    ? demo.mapImage(map)
                    : first
                      ? demo.mapImage(first)
                      : null
                }}
                onReady={(id) => run(demo.ready(id))}
                onAnswer={demo.answerProposal}
                onCancel={(id) =>
                  run(demo.cancelMatch(id), () =>
                    toast("Práctica cancelada", {
                      description:
                        "Cancelar seguido puede traer una sanción de PCW.",
                    })
                  )
                }
                onRepeat={() => startPublish(demo.last)}
                series={{
                  onRoom,
                  onVeto: () => {},
                  onUnready: () => {},
                  onFinishMap: () => {},
                  onDismiss: () => {},
                }}
              />
            </TabsContent>
          </Tabs>
        </div>

        <aside
          aria-label="Más de PCW"
          className="lg:sticky lg:top-4 lg:self-start"
        >
          <Card variant="outline" className="p-3">
            <Tabs value={side} onValueChange={setSide}>
              <TabsList
                variant="line"
                aria-label="Más de PCW"
                className="w-full"
              >
                <TabsTrigger value="servers">
                  Servidores
                  <span
                    aria-hidden
                    className={
                      freeServers
                        ? "size-1.5 rounded-full bg-win"
                        : "size-1.5 rounded-full bg-muted-foreground/50"
                    }
                  />
                </TabsTrigger>
                {demo.features.subs && (
                  <TabsTrigger value="subs">
                    Suplentes
                    {(demo.subs?.length ?? 0) > 0 && (
                      <span className="font-mono text-xs tabular-nums">
                        {demo.subs?.length}
                      </span>
                    )}
                  </TabsTrigger>
                )}
                {demo.features.alerts && (
                  <TabsTrigger value="alerts">Avisos</TabsTrigger>
                )}
                <TabsTrigger value="activity">Actividad</TabsTrigger>
              </TabsList>
              <BarePanels value>
                <TabsContent value="servers" className="pt-2">
                  <ServersPanel servers={demo.servers} queue={demo.queue} />
                </TabsContent>
                {demo.features.subs && (
                  <TabsContent value="subs" className="pt-2">
                    <SubsPanel
                      subs={demo.subs ?? []}
                      now={now}
                      meId={demo.me.id}
                      onApply={(id) => demo.applySub?.(id)}
                      onRequest={(need, bo) => {
                        demo.requestSub?.(need, bo, null)
                        toast.success(
                          "Publicado: los jugadores sueltos se pueden anotar"
                        )
                      }}
                    />
                  </TabsContent>
                )}
                {demo.features.alerts && (
                  <TabsContent value="alerts" className="pt-2">
                    <AlertsPanel
                      alerts={demo.alerts ?? []}
                      onAdd={(a) => demo.addAlert?.(a)}
                      onRemove={(id) => demo.removeAlert?.(id)}
                    />
                  </TabsContent>
                )}
                <TabsContent value="activity" className="pt-2">
                  <ActivityPanel results={demo.results} now={now} />
                </TabsContent>
              </BarePanels>
            </Tabs>
          </Card>
        </aside>
      </div>

      <PublishSheet
        open={publish !== null}
        onOpenChange={(o) => !o && setPublish(null)}
        initial={publish ?? emptyForm()}
        formats={demo.formats}
        maps={demo.maps}
        friends={demo.friends}
        me={demo.me}
        myTeam={demo.myTeam}
        plantel={demo.plantel}
        teams={demo.teams}
        banned={demo.banned}
        features={demo.features}
        onPublish={(i) =>
          run(demo.publish(i), () =>
            toast.success("PCW publicada", {
              description:
                demo.features.discord && i.discord
                  ? "También avisamos en Discord."
                  : "Los demás te van a mandar ofertas: elegís una en Tu anuncio.",
            })
          )
        }
      />

      <AcceptSheet
        post={accepting}
        onClose={() => setAccepting(null)}
        myTeam={demo.myTeam}
        plantel={demo.plantel}
        friends={demo.friends}
        me={demo.me}
        banned={demo.banned}
        now={now}
        onAccept={(p, c, at) =>
          run(demo.accept(p, c, at), () =>
            toast.success("Oferta enviada", {
              description: "Si te eligen, la práctica queda en Mis PCW.",
            })
          )
        }
      />
    </div>
  )
}
