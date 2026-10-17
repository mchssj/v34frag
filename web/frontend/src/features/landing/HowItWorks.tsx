import {
  ShuffleIcon,
  TerminalIcon,
  TrendingUpIcon,
  TrophyIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react"

import { SectionHeading } from "@/components/brand/SectionHeading"

const STEPS: {
  n: string
  icon: LucideIcon
  title: string
  text: string
  footIcon: LucideIcon
  foot: string
}[] = [
  {
    n: "01",
    icon: UserPlusIcon,
    title: "Crea tu cuenta y elige tu tag",
    text: "En cuatro pasos. Después vinculas tu jugador escribiendo !claim y un código en el servidor.",
    footIcon: TerminalIcon,
    foot: "!claim K7Q2-9FXM",
  },
  {
    n: "02",
    icon: ShuffleIcon,
    title: "Juega mixes",
    text: "El servidor reporta cada partida: stats, MVP, demo y cambio de ELO. Subes del nivel 1 al 10.",
    footIcon: TrendingUpIcon,
    foot: "Victoria 16:12 · +28 ELO",
  },
  {
    n: "03",
    icon: TrophyIcon,
    title: "Compite con tu equipo",
    text: "Solicita un equipo oficial, inscríbelo en torneos o busca PCW. El veto y el reporte se hacen en la sala de cada partida.",
    footIcon: TrophyIcon,
    foot: "Final BO5 · Liga Apertura",
  },
]

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-title"
      className="mx-auto flex w-full max-w-[1200px] scroll-mt-[60px] flex-col gap-10 px-6 pt-[88px] pb-[72px]"
    >
      <SectionHeading
        id="como-funciona-title"
        narrow
        eyebrow="Cómo funciona"
        title="De tu primer mix a levantar una copa."
        aside={
          <p className="max-w-[380px] text-[15px] leading-[1.55] text-pretty text-muted-foreground">
            Sin planillas ni capturas sueltas: el servidor reporta cada partida
            y la web hace el resto.
          </p>
        }
      />
      <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-5">
        {STEPS.map(({ n, icon: Icon, title, text, footIcon: FootIcon, foot }) => (
          <li
            key={n}
            className="flex flex-col overflow-hidden rounded-hero border bg-card"
          >
            <div className="flex flex-1 flex-col gap-3.5 px-6 pt-6 pb-5">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-tile bg-primary/14">
                  <Icon className="size-5 text-primary" aria-hidden />
                </span>
                <span
                  aria-hidden
                  className="font-mono text-[40px] leading-none font-bold tracking-[-2px] text-muted"
                >
                  {n}
                </span>
              </div>
              <h3 className="text-lg font-semibold tracking-[-0.3px]">{title}</h3>
              <p className="text-sm leading-[1.6] text-pretty text-muted-foreground">
                {text}
              </p>
            </div>
            <div className="flex items-center gap-2.5 border-t bg-muted/45 px-6 py-3.5">
              <FootIcon className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="font-mono text-xs font-medium">{foot}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
