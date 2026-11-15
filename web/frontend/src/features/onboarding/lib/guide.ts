import {
  DownloadIcon,
  Gamepad2Icon,
  LifeBuoyIcon,
  LinkIcon,
  ShieldIcon,
  SparklesIcon,
  SquareTerminalIcon,
  SwordsIcon,
  UserCogIcon,
  type LucideIcon,
} from "lucide-react"

import { canSeeAdmin, homeAdminSection } from "@/auth/permissions"
import type { Role } from "@/auth/queries"
import { CLIENTMOD } from "@/config/site"
import { GUIDE_TEXT, type GuideLang } from "./guideText"

// Guía de la web para la primera vez (docs/bitacora/2026-11-14-guia-primera-vez).
// Lo principal (Kyan): que tengan ClientMod instalado y la consola activada.
// Provisorio como la Bienvenida: se recuerda por cuenta en este navegador.

/** Pregunta de sí o no. Con "No", el paso muestra cómo resolverlo. */
export type GuideAsk = {
  question: string
  yes: string
  no: string
  /** Lo que se ve con "Sí". */
  okText: string
  /** Lo que se ve con "No": pasos, y un link externo si hace falta descargar algo. */
  fix: {
    title: string
    items: string[]
    download?: { href: string; label: string }
  }
}

export type GuideStep = {
  key: string
  title: string
  body: string
  icon: LucideIcon
  /** Sección de la web que explica el paso ("Ir a …"). */
  to?: string
  toLabel?: string
  /** Página del manual con el detalle. */
  help?: string
  ask?: GuideAsk
}

type StepDef = Pick<GuideStep, "key" | "icon" | "to" | "help"> & {
  download?: string
}

const STEPS: StepDef[] = [
  { key: "welcome", icon: SparklesIcon },
  {
    key: "clientmod",
    icon: DownloadIcon,
    help: "/help/jugador/instalar-clientmod",
    download: CLIENTMOD.downloadUrl,
  },
  {
    key: "console",
    icon: SquareTerminalIcon,
    help: "/help/jugador/instalar-clientmod",
  },
  {
    key: "play",
    icon: Gamepad2Icon,
    to: "/play",
    help: "/help/jugador/buscar-partida",
  },
  {
    key: "claim",
    icon: LinkIcon,
    to: "/profile/link",
    help: "/help/jugador/vincular-steamid",
  },
  {
    key: "matches",
    icon: SwordsIcon,
    to: "/matches",
    help: "/help/jugador/elo-y-estadisticas",
  },
  {
    key: "teams",
    icon: ShieldIcon,
    to: "/myteam",
    help: "/help/jugador/equipo",
  },
  { key: "help", icon: LifeBuoyIcon, to: "/help" },
]

function withText(def: StepDef, lang: GuideLang): GuideStep {
  const { download, ...rest } = def
  const t = GUIDE_TEXT[lang].steps[def.key]
  const ask: GuideAsk | undefined = t.ask && {
    question: t.ask.question,
    yes: t.ask.yes,
    no: t.ask.no,
    okText: t.ask.okText,
    fix: {
      title: t.ask.fixTitle,
      items: t.ask.fixItems,
      download:
        download && t.ask.download
          ? { href: download, label: t.ask.download }
          : undefined,
    },
  }
  return { ...rest, title: t.title, body: t.body, toLabel: t.toLabel, ask }
}

/** Los pasos de la guía. El staff (organizador, moderador y admin) suma uno para Administración. */
export function guideSteps(role: Role, lang: GuideLang = "es"): GuideStep[] {
  const defs = canSeeAdmin(role)
    ? [
        ...STEPS.slice(0, -1),
        {
          key: "admin",
          icon: UserCogIcon,
          to: `/admin/${homeAdminSection(role)}`,
        },
        STEPS[STEPS.length - 1],
      ]
    : STEPS
  return defs.map((d) => withText(d, lang))
}

const guideKey = (userId: string) => `csstv.guide.${userId}`

type GuideState = "pending" | "seen" | null

function readState(userId: string): GuideState {
  try {
    const v = localStorage.getItem(guideKey(userId))
    return v === "pending" || v === "seen" ? v : null
  } catch {
    return null
  }
}

function writeState(userId: string, state: "pending" | "seen") {
  try {
    localStorage.setItem(guideKey(userId), state)
  } catch {
    // Sin storage: la guía no aparece sola (se puede abrir desde Ayuda).
  }
}

/** Al entrar a la Bienvenida: la guía queda pendiente para cuando llegue a la web. Si ya la vio, no cambia. */
export function markGuidePending(userId: string) {
  if (readState(userId) === null) writeState(userId, "pending")
}

export function markGuideSeen(userId: string) {
  writeState(userId, "seen")
}

/** ¿Se abre sola? Solo si quedó pendiente desde la Bienvenida y todavía no se vio. */
export function guidePending(userId: string) {
  return readState(userId) === "pending"
}
