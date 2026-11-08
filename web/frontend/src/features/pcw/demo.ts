import { useEffect, useMemo, useRef, useState } from "react"

import { toast } from "sonner"

import { demoArt, demoAvatar } from "@/features/matchmaking/demo"
import type { MapEntry } from "@/features/maps/types"
import {
  abandonSide,
  seriesScore,
  seriesWinner,
  VETO_TURN_S,
  vetoState,
  waitMinutes,
} from "./lib/series"
import type {
  BestOf,
  PcwBooking,
  PcwAlert,
  PcwMatch,
  PcwOffer,
  PcwPlayer,
  PcwPost,
  PcwResult,
  PcwServer,
  PcwSide,
  PcwTeamRef,
  SubRequest,
} from "./types"

// Datos de ejemplo de /demo/pcw (bitácora 2026-11-08-pcw-demo). Todo en memoria: nada va a la API.

const MIN = 60_000
const HOUR = 60 * MIN

let seq = 0
const uid = (p: string) => `${p}-${++seq}`

const p = (alias: string, elo: number, guest = false): PcwPlayer => ({
  id: `pl-${alias}`,
  alias,
  elo: guest ? 0 : elo,
  photo: guest ? null : demoAvatar(alias),
  guest,
})

const team = (id: string, name: string, tag: string): PcwTeamRef => ({
  id,
  name,
  tag,
})

export const DEMO_ME = p("kyan", 1240)

export const MY_TEAM = team("t-vertigo", "Vértigo", "VTG")
const NEXUS = team("t-nexus", "Nexus", "NXS")
const RUIDO = team("t-ruido", "Ruido Blanco", "RB")
const HALCONES = team("t-halcones", "Halcones", "HLC")
const SINFRENO = team("t-sinfreno", "Sin Freno", "SF")
const LOSPIBES = team("t-pibes", "Los Pibes", "LP")
export const DEMO_TEAMS = [NEXUS, RUIDO, HALCONES, SINFRENO, LOSPIBES]

/** Amigos y compañeros de equipo que se pueden sumar al roster. */
export const DEMO_FRIENDS: (PcwPlayer & { team: boolean })[] = [
  { ...p("tomi", 1310), team: true },
  { ...p("nachoo", 1185), team: true },
  { ...p("lauti.cs", 1270), team: true },
  { ...p("vane", 1150), team: true },
  { ...p("benja", 1420), team: false },
  { ...p("ruso", 980), team: false },
  { ...p("facu_", 1095), team: false },
]

/** Los compañeros de equipo, sin la marca de amigo. */
const TEAMMATES: PcwPlayer[] = DEMO_FRIENDS.filter((f) => f.team).map((f) => ({
  id: f.id,
  alias: f.alias,
  elo: f.elo,
  photo: f.photo,
}))

const side = (
  name: string,
  roster: PcwPlayer[],
  t: PcwTeamRef | null = null
): PcwSide => ({ name, team: t, roster })

const MAPS = [
  "de_dust2",
  "de_inferno",
  "de_nuke",
  "de_train",
  "de_mirage",
  "de_tuscan",
  "de_cbble",
  "de_cache",
  "de_aztec",
]

export const DEMO_MAPS: MapEntry[] = MAPS.map((name, i) => ({
  name,
  versions: name === "de_inferno" ? [name, "de_inferno_classic"] : [name],
  active: true,
  position: i,
  mixes: true,
  veto_default: i < 7,
  image_url: name === "de_cache" ? null : demoArt(name),
}))

export const mapImage = (name: string) =>
  DEMO_MAPS.find((m) => m.name === name)?.image_url ?? null

export const DEFAULT_POOL = DEMO_MAPS.filter((m) => m.veto_default).map(
  (m) => m.name
)

function initialPosts(now: number): PcwPost[] {
  const iso = (ms: number) => new Date(now + ms).toISOString()
  return [
    {
      id: "post-nexus",
      by: "pl-zeta",
      best_of: 3,
      starts_at: iso(40 * MIN),
      note: "Buscamos algo serio, con veto. Discord después para charlar las rondas.",
      created_at: iso(-35 * MIN),
      map_pool: ["de_dust2", "de_inferno", "de_nuke", "de_train", "de_mirage"],
      side: side(
        "Nexus",
        [
          p("zeta", 1320),
          p("mati77", 1260),
          p("lucho", 1295),
          p("fran", 1210),
          p("santi", 1335),
        ],
        NEXUS
      ),
      invited: null,
      discord: true,
      reliability: { played: 22, cancelled: 1, abandoned: 0, streak: 14 },
    },
    {
      id: "post-ruido",
      by: "pl-kira",
      best_of: 1,
      starts_at: iso(5 * MIN),
      note: "Rápida, BO1 y a jugar.",
      created_at: iso(-12 * MIN),
      map_pool: null,
      side: side("Pick de kira", [
        p("kira", 1105),
        p("tincho", 1060),
        p("rocio", 1140),
        p("juanpi", 1010),
        p("invitado1", 0, true),
      ]),
      invited: null,
      discord: false,
      reliability: null,
    },
    {
      id: "post-halcones",
      by: "pl-dami",
      best_of: 3,
      starts_at: iso(3 * HOUR + 20 * MIN),
      note: null,
      created_at: iso(-2 * HOUR),
      map_pool: ["de_dust2", "de_train", "de_tuscan", "de_cbble", "de_nuke"],
      side: side(
        "Halcones",
        [
          p("dami", 1460),
          p("pela", 1510),
          p("guido", 1390),
          p("ezequiel", 1475),
        ],
        HALCONES
      ),
      invited: MY_TEAM,
      discord: true,
      reliability: { played: 9, cancelled: 3, abandoned: 1, streak: 2 },
    },
    {
      id: "post-sinfreno",
      by: "pl-maxi",
      best_of: 5,
      starts_at: iso(26 * HOUR),
      note: "BO5 para preparar el torneo del finde.",
      created_at: iso(-5 * HOUR),
      map_pool: null,
      side: side(
        "Sin Freno",
        [
          p("maxi", 1180),
          p("nico_s", 1230),
          p("bauti", 1200),
          p("lean", 1255),
          p("pato", 1170),
          p("joaco", 1215),
        ],
        SINFRENO
      ),
      invited: null,
      discord: false,
      reliability: { played: 31, cancelled: 2, abandoned: 0, streak: 21 },
    },
    {
      id: "post-pibes",
      by: "pl-chino",
      best_of: 3,
      starts_at: null,
      note: "Horario a convenir, escribinos.",
      created_at: iso(-26 * HOUR),
      map_pool: null,
      side: side(
        "Los Pibes",
        [p("chino", 920), p("gaston", 870), p("mora", 955), p("ivo", 900)],
        LOSPIBES
      ),
      invited: null,
      discord: false,
      reliability: { played: 4, cancelled: 0, abandoned: 0, streak: 4 },
    },
  ]
}

function initialMatches(now: number): PcwMatch[] {
  const iso = (ms: number) => new Date(now + ms).toISOString()
  const us = side("Vértigo", [DEMO_ME, ...TEAMMATES], MY_TEAM)
  return [
    {
      id: "match-next",
      best_of: 3,
      starts_at: iso(65 * MIN),
      us,
      them: side(
        "Ruido Blanco",
        [p("ari", 1250), p("colo", 1205), p("emi", 1280), p("valen", 1230)],
        RUIDO
      ),
      status: "waiting",
      score: null,
      proposed_at: null,
      proposed_by: null,
    },
    {
      id: "match-tomorrow",
      best_of: 1,
      starts_at: iso(25 * HOUR),
      us,
      them: side(
        "Nexus",
        [p("zeta", 1320), p("mati77", 1260), p("lucho", 1295), p("fran", 1210)],
        NEXUS
      ),
      status: "waiting",
      score: null,
      proposed_at: iso(26 * HOUR),
      proposed_by: "them",
    },
    {
      id: "match-won",
      best_of: 3,
      starts_at: iso(-26 * HOUR),
      us,
      them: side("Halcones", [p("dami", 1460), p("pela", 1510)], HALCONES),
      status: "won",
      score: [2, 1],
      proposed_at: null,
      proposed_by: null,
    },
    {
      id: "match-lost",
      best_of: 1,
      starts_at: iso(-50 * HOUR),
      us,
      them: side("Nexus", [p("zeta", 1320)], NEXUS),
      status: "lost",
      score: [0, 1],
      proposed_at: null,
      proposed_by: null,
    },
  ]
}

function initialResults(now: number): PcwResult[] {
  const iso = (ms: number) => new Date(now + ms).toISOString()
  return [
    { id: "r1", at: iso(-26 * HOUR), a: MY_TEAM, b: HALCONES, score: [2, 1] },
    { id: "r2", at: iso(-50 * HOUR), a: NEXUS, b: MY_TEAM, score: [1, 0] },
    { id: "r3", at: iso(-4 * 24 * HOUR), a: MY_TEAM, b: NEXUS, score: [2, 0] },
    {
      id: "r4",
      at: iso(-6 * 24 * HOUR),
      a: HALCONES,
      b: MY_TEAM,
      score: [2, 0],
    },
    { id: "r5", at: iso(-3 * HOUR), a: SINFRENO, b: RUIDO, score: [3, 1] },
    { id: "r6", at: iso(-5 * HOUR), a: NEXUS, b: LOSPIBES, score: [1, 0] },
    { id: "r7", at: iso(-9 * HOUR), a: HALCONES, b: SINFRENO, score: [1, 2] },
    { id: "r8", at: iso(-30 * HOUR), a: RUIDO, b: LOSPIBES, score: [2, 0] },
  ]
}

const initialSubs = (now: number): SubRequest[] => [
  {
    id: "sub-1",
    side: side(
      "Ruido Blanco",
      [p("ari", 1250), p("colo", 1205), p("emi", 1280), p("valen", 1230)],
      RUIDO
    ),
    need: 1,
    best_of: 3,
    starts_at: new Date(now + 50 * MIN).toISOString(),
    applicants: [p("ruso", 980)],
  },
  {
    id: "sub-2",
    side: side("Pick de lolo", [
      p("lolo", 1120),
      p("cande", 1090),
      p("tute", 1165),
    ]),
    need: 2,
    best_of: 1,
    starts_at: null,
    applicants: [],
  },
]

const SERVERS: PcwServer[] = [
  { name: "CMLeague #1", free: true },
  { name: "CMLeague #2", free: false },
  { name: "CMLeague #3", free: true },
]

/** Formatos habilitados (GET /pcw/formats). */
const FORMATS: BestOf[] = [1, 3, 5]

export type DemoFlag =
  "myPost" | "empty" | "banned" | "busy" | "short" | "noShow"

export const DEMO_FLAGS: { flag: DemoFlag; label: string }[] = [
  { flag: "myPost", label: "Tengo un anuncio abierto" },
  { flag: "empty", label: "Tablón vacío" },
  { flag: "banned", label: "Equipo sancionado" },
  { flag: "busy", label: "Servidores ocupados" },
  { flag: "short", label: "Me falta un jugador" },
  { flag: "noShow", label: "El rival no entra al servidor" },
]

export const BAN_TEXT =
  "Vértigo tiene una sanción de PCW hasta el 12/11 por cancelar dos prácticas seguidas."

export type PublishInput = {
  best_of: BestOf
  starts_at: string | null
  note: string
  name: string
  roster: PcwPlayer[]
  asTeam: boolean
  map_pool: string[] | null
  discord: boolean
  invited: PcwTeamRef | null
}

/** Estado de la demo y sus acciones: publicar, aceptar, listos, suplentes, avisos y la barra. */
export function usePcwDemo() {
  const [now] = useState(() => Date.now())
  const [posts, setPosts] = useState(() => initialPosts(now))
  const [matches, setMatches] = useState(() => initialMatches(now))
  const [results] = useState(() => initialResults(now))
  const [subs, setSubs] = useState(() => initialSubs(now))
  const [alerts, setAlerts] = useState<PcwAlert[]>([
    { id: "al-1", formats: [3], myLevel: true, asTeam: false },
  ])
  const [myPost, setMyPost] = useState<PcwPost | null>(null)
  const [last, setLast] = useState<PublishInput>({
    best_of: 3,
    starts_at: null,
    note: "",
    name: "Vértigo",
    roster: [DEMO_ME, ...TEAMMATES],
    asTeam: true,
    map_pool: ["de_dust2", "de_inferno", "de_nuke", "de_train", "de_mirage"],
    discord: true,
    invited: null,
  })
  const [flags, setFlags] = useState<Record<DemoFlag, boolean>>({
    myPost: false,
    empty: false,
    banned: false,
    busy: false,
    short: false,
    noShow: false,
  })
  // El reloj de la serie lee las marcas sin reiniciarse cada vez que cambian.
  const flagsRef = useRef(flags)
  useEffect(() => {
    flagsRef.current = flags
  }, [flags])

  // La serie avanza sola: el rival veta, la fila baja, la gente entra al servidor y vence la espera.
  useEffect(() => {
    const t = setInterval(() => {
      setMatches((ms) =>
        ms.some((m) => m.booking)
          ? ms.map((m) =>
              m.booking ? tickSeries(m, Date.now(), flagsRef.current) : m
            )
          : ms
      )
    }, 1000)
    return () => clearInterval(t)
  }, [])

  function publish(input: PublishInput) {
    const post: PcwPost = {
      id: uid("mine"),
      by: DEMO_ME.id,
      best_of: input.best_of,
      starts_at: input.starts_at,
      note: input.note.trim() || null,
      created_at: new Date().toISOString(),
      map_pool: input.map_pool,
      side: side(
        input.name.trim() || `Pick de ${DEMO_ME.alias}`,
        input.roster,
        input.asTeam ? MY_TEAM : null
      ),
      invited: input.invited,
      discord: input.discord,
      reliability: { played: 12, cancelled: 1, abandoned: 0, streak: 8 },
    }
    setMyPost(post)
    setLast(input)
    setFlags((f) => ({ ...f, myPost: true }))
    // Las ofertas van llegando: dos equipos a los 4 y 9 s.
    const arrive = (offer: PcwOffer) =>
      setMyPost((x) =>
        x && x.id === post.id
          ? { ...x, offers: [...(x.offers ?? []), offer] }
          : x
      )
    setTimeout(
      () =>
        arrive({
          id: uid("offer"),
          side: side(
            "Ruido Blanco",
            [p("ari", 1250), p("colo", 1205), p("emi", 1280), p("valen", 1230)],
            RUIDO
          ),
          proposed_at: null,
          created_at: new Date().toISOString(),
          reliability: { played: 22, cancelled: 1, abandoned: 0, streak: 9 },
        }),
      4000
    )
    setTimeout(
      () =>
        arrive({
          id: uid("offer"),
          side: side(
            "Sin Freno",
            [
              p("toto", 1380),
              p("bruno", 1350),
              p("facu", 1410),
              p("santi", 1335),
              p("leo", 1300),
            ],
            SINFRENO
          ),
          proposed_at: post.starts_at
            ? new Date(Date.parse(post.starts_at) + HOUR).toISOString()
            : null,
          created_at: new Date().toISOString(),
          reliability: { played: 9, cancelled: 2, abandoned: 1, streak: 2 },
        }),
      9000
    )
  }

  function removeMyPost() {
    setMyPost(null)
    setFlags((f) => ({ ...f, myPost: false }))
  }

  // Ofertas mandadas que todavía no eligieron (la demo elige la mía a los 6 s si no la retiro).
  const pendingOffers = useRef(new Set<string>())

  /**
   * Manda una oferta a un anuncio (como en pracc): el que publicó elige. En la demo, a los 6 s te eligen y queda
   * como práctica próxima.
   */
  function accept(
    post: PcwPost,
    roster: PcwPlayer[],
    proposedAt: string | null
  ) {
    pendingOffers.current.add(post.id)
    setPosts((ps) =>
      ps.map((x) =>
        x.id === post.id
          ? {
              ...x,
              my_offer: {
                created_at: new Date().toISOString(),
                proposed_at: proposedAt,
              },
            }
          : x
      )
    )
    setTimeout(() => {
      if (!pendingOffers.current.delete(post.id)) return
      chosen(post, roster, proposedAt)
      toast.success(`${post.side.name} eligió tu oferta`, {
        description: 'Quedó en Mis PCW. Marquen "Estamos listos" cuando estén.',
      })
    }, 6000)
  }

  /** Retira una oferta que todavía no eligieron. */
  function withdrawOffer(postId: string) {
    pendingOffers.current.delete(postId)
    setPosts((ps) =>
      ps.map((x) => (x.id === postId ? { ...x, my_offer: null } : x))
    )
  }

  /** Elijo una de las ofertas de mi anuncio: queda la práctica y el anuncio se cierra. */
  function chooseOffer(offerId: string) {
    const post = myPost
    const offer = post?.offers?.find((o) => o.id === offerId)
    if (!post || !offer) return
    setMatches((ms) => [
      {
        id: uid("match"),
        best_of: post.best_of,
        starts_at: offer.proposed_at ?? post.starts_at,
        us: post.side,
        them: offer.side,
        status: "waiting",
        score: null,
        proposed_at: null,
        proposed_by: null,
      },
      ...ms,
    ])
    setMyPost(null)
    setFlags((f) => ({ ...f, myPost: false }))
  }

  /** Te eligieron: sale del tablón y queda como práctica próxima. */
  function chosen(
    post: PcwPost,
    roster: PcwPlayer[],
    proposedAt: string | null
  ) {
    setPosts((ps) => ps.filter((x) => x.id !== post.id))
    setMatches((ms) => [
      {
        id: uid("match"),
        best_of: post.best_of,
        starts_at: post.starts_at,
        us: side("Vértigo", roster, MY_TEAM),
        them: post.side,
        status: "waiting",
        score: null,
        proposed_at: proposedAt,
        proposed_by: proposedAt ? "us" : null,
      },
      ...ms,
    ])
  }

  function ready(id: string) {
    setMatches((ms) =>
      ms.map((m) => {
        if (m.id !== id) return m
        if (m.status === "waiting") return { ...m, status: "ready_us" }
        // Con los dos listos arranca el veto.
        return { ...m, status: "ready_both", booking: newBooking(Date.now()) }
      })
    )
  }

  const patch = (id: string, fn: (m: PcwMatch) => PcwMatch) =>
    setMatches((ms) => ms.map((m) => (m.id === id && m.booking ? fn(m) : m)))

  /** Mi ban o pick, si es mi turno. */
  function veto(id: string, map: string) {
    patch(id, (m) => {
      const b = m.booking!
      const st = vetoState(b.pool, m.best_of, b.actions)
      if (
        b.step !== "veto" ||
        st.next?.by !== "us" ||
        !st.remaining.includes(map)
      )
        return m
      return { ...m, booking: vetoAct(b, map, st.next.kind, "us", Date.now()) }
    })
  }

  /** Antes de tener servidor, un equipo se puede bajar sin sanción: la práctica vuelve a esperar los listos. */
  function unready(id: string) {
    patch(id, (m) =>
      m.booking!.step === "veto" || m.booking!.step === "queued"
        ? { ...m, status: "waiting", booking: null }
        : m
    )
  }

  /** Termina el mapa en juego con un resultado al azar. */
  function finishMap(id: string) {
    patch(id, (m) => {
      const b = m.booking!
      if (b.step !== "live") return m
      const lose = 4 + Math.floor(Math.random() * 11)
      const scores: [number, number][] = [
        ...b.scores,
        Math.random() < 0.6 ? [16, lose] : [lose, 16],
      ]
      const won = seriesWinner(m.best_of, scores)
      if (won)
        return {
          ...m,
          status: won === "us" ? "won" : "lost",
          score: seriesScore(scores),
          booking: { ...b, scores, step: "finished", deadline: null },
        }
      const map_no = b.map_no + 1
      return {
        ...m,
        status: "ready_both",
        score: seriesScore(scores),
        booking: {
          ...b,
          scores,
          map_no,
          step: "wait",
          present: [3, 2],
          deadline: iso(Date.now() + waitMinutes(map_no) * MIN),
        },
      }
    })
  }

  /** Barra de la demo: la espera para entrar vence en 5 segundos. */
  function rush() {
    setMatches((ms) =>
      ms.map((m) =>
        m.booking?.step === "wait"
          ? {
              ...m,
              booking: { ...m.booking, deadline: iso(Date.now() + 5000) },
            }
          : m
      )
    )
  }

  /** Cierra el aviso de una serie terminada o abandonada. */
  function dismissSeries(id: string) {
    patch(id, (m) => ({ ...m, booking: null }))
  }

  /** Responde una contraoferta de hora: aceptarla mueve la práctica, si no queda la hora de antes. */
  function answerProposal(id: string, ok: boolean) {
    setMatches((ms) =>
      ms.map((m) =>
        m.id !== id
          ? m
          : {
              ...m,
              starts_at: ok ? m.proposed_at : m.starts_at,
              proposed_at: null,
              proposed_by: null,
            }
      )
    )
  }

  function cancelMatch(id: string) {
    setMatches((ms) =>
      ms.map((m) => (m.id === id ? { ...m, status: "cancelled" } : m))
    )
  }

  function applySub(id: string) {
    setSubs((ss) =>
      ss.map((s) =>
        s.id === id && !s.applicants.some((a) => a.id === DEMO_ME.id)
          ? { ...s, applicants: [...s.applicants, DEMO_ME] }
          : s
      )
    )
  }

  function requestSub(need: number, bo: BestOf, startsAt: string | null) {
    setSubs((ss) => [
      {
        id: uid("sub"),
        side: side("Vértigo", last.roster, MY_TEAM),
        need,
        best_of: bo,
        starts_at: startsAt,
        applicants: [],
      },
      ...ss,
    ])
  }

  function addAlert(a: Omit<PcwAlert, "id">) {
    setAlerts((as) => [...as, { ...a, id: uid("al") }])
  }
  const removeAlert = (id: string) =>
    setAlerts((as) => as.filter((a) => a.id !== id))

  function setFlag(flag: DemoFlag, on: boolean) {
    setFlags((f) => ({ ...f, [flag]: on }))
    if (flag === "myPost") {
      if (on && !myPost) publish(last)
      if (!on) setMyPost(null)
    }
  }

  const view = useMemo(
    () => ({
      posts: flags.empty ? [] : posts,
      myPost: flags.myPost ? myPost : null,
      matches,
      results,
      subs,
      alerts,
      servers: flags.busy
        ? SERVERS.map((s) => ({ ...s, free: false }))
        : SERVERS,
      queue: flags.busy ? 2 : 0,
      banned: flags.banned ? BAN_TEXT : null,
      formats: FORMATS,
      // Con "Me falta un jugador", el último roster queda con 3 con cuenta.
      last: flags.short
        ? { ...last, roster: last.roster.filter((x) => !x.guest).slice(0, 3) }
        : last,
      flags,
    }),
    [posts, myPost, matches, results, subs, alerts, flags, last]
  )

  return {
    ...view,
    publish,
    removeMyPost,
    accept,
    withdrawOffer,
    chooseOffer,
    ready,
    veto,
    unready,
    finishMap,
    rush,
    dismissSeries,
    answerProposal,
    cancelMatch,
    applySub,
    requestSub,
    addAlert,
    removeAlert,
    setFlag,
  }
}

export type PcwDemo = ReturnType<typeof usePcwDemo>

// ---------- La serie de la demo (replanteo 56) ----------

const iso = (ms: number) => new Date(ms).toISOString()

function newBooking(t: number): PcwBooking {
  return {
    step: "veto",
    pool: DEFAULT_POOL.slice(0, 7),
    actions: [],
    deadline: iso(t + VETO_TURN_S * 1000),
    queue_ahead: 0,
    server: null,
    map_no: 1,
    present: [0, 0],
    scores: [],
    abandoned_by: null,
  }
}

function vetoAct(
  b: PcwBooking,
  map: string,
  kind: "ban" | "pick",
  by: "us" | "them",
  t: number
): PcwBooking {
  return {
    ...b,
    actions: [...b.actions, { map, kind, by }],
    deadline: iso(t + VETO_TURN_S * 1000),
  }
}

/** Un segundo de la serie: lo que haría el rival, la fila, la gente entrando y la espera que vence. */
function tickSeries(
  m: PcwMatch,
  t: number,
  flags: Record<DemoFlag, boolean>
): PcwMatch {
  const b = m.booking!
  const due = b.deadline !== null && t >= Date.parse(b.deadline)
  switch (b.step) {
    case "veto": {
      const st = vetoState(b.pool, m.best_of, b.actions)
      if (st.done) {
        return {
          ...m,
          booking: {
            ...b,
            step: "queued",
            queue_ahead: flags.busy ? 2 : 0,
            deadline: iso(t + 4000),
          },
        }
      }
      const next = st.next!
      // El rival tarda 3 s; si a mí se me vence el turno, va un mapa al azar.
      const rivalTurn =
        next.by === "them" &&
        t >= Date.parse(b.deadline!) - (VETO_TURN_S - 3) * 1000
      if (!rivalTurn && !due) return m
      const map =
        next.by === "us"
          ? st.remaining[Math.floor(Math.random() * st.remaining.length)]!
          : next.kind === "pick"
            ? st.remaining[0]!
            : st.remaining.at(-1)!
      return { ...m, booking: vetoAct(b, map, next.kind, next.by, t) }
    }
    case "queued": {
      if (!due) return m
      if (b.queue_ahead > 0)
        return {
          ...m,
          booking: {
            ...b,
            queue_ahead: b.queue_ahead - 1,
            deadline: iso(t + 4000),
          },
        }
      const free = SERVERS.find((s) => s.free && !flags.busy) ?? SERVERS[1]!
      return {
        ...m,
        booking: {
          ...b,
          step: "wait",
          server: {
            name: free.name,
            // Dirección de ejemplo (rango de documentación), no la de un servidor real.
            address: "203.0.113.10:27015",
            password: `pcw${1000 + Math.floor(Math.random() * 9000)}`,
          },
          present: [1, 0],
          deadline: iso(t + waitMinutes(b.map_no) * MIN),
        },
      }
    }
    case "wait": {
      const [us, them] = b.present
      const present: [number, number] = [
        us < 5 && Math.random() < 0.5 ? us + 1 : us,
        them < (flags.noShow ? 3 : 5) && Math.random() < 0.4 ? them + 1 : them,
      ]
      const side =
        present[0] === 5 && present[1] === 5
          ? null
          : due
            ? abandonSide(present)
            : undefined
      if (side === undefined) return { ...m, booking: { ...b, present } }
      if (side === null)
        return {
          ...m,
          status: "live",
          booking: { ...b, present, step: "live", deadline: null },
        }
      return {
        ...m,
        status: "cancelled",
        booking: {
          ...b,
          present,
          step: "abandoned",
          deadline: null,
          abandoned_by: side === "both" ? "us" : side,
        },
      }
    }
    default:
      return m
  }
}
