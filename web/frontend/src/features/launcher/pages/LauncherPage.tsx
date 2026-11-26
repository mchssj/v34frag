import { Link } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  BellRingIcon,
  ChevronDownIcon,
  DownloadIcon,
  GamepadIcon,
  LogInIcon,
  MonitorIcon,
  MousePointerClickIcon,
  PaletteIcon,
  PlayIcon,
  RefreshCwIcon,
  SettingsIcon,
  ShieldCheckIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import { BrandLockup, BrandMark } from "@/components/brand/Brand"
import { Eyebrow } from "@/components/brand/SectionHeading"
import { SiteFooter } from "@/components/brand/SiteFooter"
import { ThemeToggle } from "@/components/brand/ThemeToggle"
import { Card } from "@/components/ui/card"
import { CLIENTMOD } from "@/config/site"
import { DownloadButtons } from "../components/DownloadButtons"
import { LauncherMockup } from "../components/LauncherMockup"

const focusRing = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
const link = "text-primary underline underline-offset-2"

const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <PlayIcon aria-hidden />,
    title: "Entra al servidor con un clic",
    text: "Conectar abre ClientMod ya conectado a tu sala. Aprietas PLAY y entras, sin copiar la IP ni la contraseña.",
  },
  {
    icon: <BellRingIcon aria-hidden />,
    title: "Te avisa aunque estés en otra cosa",
    text: "Cuando aparece la partida, aviso de Windows y la ventana al frente. Puedes aceptar desde la bandeja.",
  },
  {
    icon: <MonitorIcon aria-hidden />,
    title: "La misma web, en su ventana",
    text: "Tu cuenta, tu perfil y el matchmaking, como en el navegador. Si la cierras, queda en la bandeja y sigues en la cola.",
  },
  {
    icon: <SettingsIcon aria-hidden />,
    title: "Configuración propia",
    text: "Abrir con Windows, avisos, mostrar en Discord lo que estás jugando y más. No cambia nada de la web.",
  },
  {
    icon: <PaletteIcon aria-hidden />,
    title: "Con tus temas de la tienda",
    text: "Si tienes temas, pinta el launcher con el que elijas. Tu perfil y la web quedan igual.",
  },
  {
    icon: <RefreshCwIcon aria-hidden />,
    title: "Se actualiza solo",
    text: "Te avisa cuando hay una versión nueva y la instalas cuando quieras, nunca en medio de una partida.",
  },
]

const STEPS: { icon: ReactNode; title: string; text: ReactNode }[] = [
  {
    icon: <DownloadIcon aria-hidden />,
    title: "Descárgalo",
    text: "Toca Descargar para Windows. Es un instalador chico.",
  },
  {
    icon: <ShieldCheckIcon aria-hidden />,
    title: "Instálalo",
    text: (
      <>
        Si Windows dice «Windows protegió su PC», toca{" "}
        <strong>Más información</strong> y{" "}
        <strong>Ejecutar de todas formas</strong>.
      </>
    ),
  },
  {
    icon: <LogInIcon aria-hidden />,
    title: "Inicia sesión",
    text: "Con tu cuenta de CMLeague, la misma de la web.",
  },
  {
    icon: <MousePointerClickIcon aria-hidden />,
    title: "Busca y conecta",
    text: "Acepta la partida y toca Conectar: se abre ClientMod. Windows te pide permiso, como cuando lo abres a mano.",
  },
]

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "¿Por qué Windows dice que protegió mi PC?",
    a: "Porque el instalador todavía no tiene firma digital, que es paga. Es el aviso que Windows muestra con cualquier programa nuevo sin firmar. Toca Más información y Ejecutar de todas formas.",
  },
  {
    q: "¿Es un anticheat? ¿Toca el juego?",
    a: "No. Es la web en su propia ventana. Para conectarte, agrega por un momento la dirección y la contraseña de la sala a la configuración de ClientMod y la saca cuando se abre el juego. No lee tus otros programas ni toca el juego mientras juegas.",
  },
  {
    q: "¿Necesito ClientMod?",
    a: (
      <>
        Sí: el launcher lo abre, no lo reemplaza. Si no lo tienes, bájalo de su{" "}
        <a
          href={CLIENTMOD.downloadUrl}
          className={link}
          target="_blank"
          rel="noreferrer"
        >
          página oficial
        </a>
        .
      </>
    ),
  },
  {
    q: "¿Tengo que actualizarlo cada vez que cambia la web?",
    a: "No. El launcher abre la web de CMLeague, así que los cambios de la web los ves solos. Solo se actualiza cuando cambia el launcher en sí, y te avisa.",
  },
  {
    q: "¿Puedo seguir usando el navegador?",
    a: "Sí. Es la misma cuenta. En el navegador, Conectar copia el comando para pegarlo en la consola del juego (º).",
  },
  {
    q: "¿Cómo lo desinstalo?",
    a: "Desde Configuración de Windows › Aplicaciones, como cualquier programa. Tu cuenta y tus partidas no cambian.",
  },
]

function Header() {
  return (
    <header className="sticky top-0 z-20 px-4 pt-3.5">
      <div className="mx-auto flex h-14 max-w-[1260px] items-center gap-3 rounded-[var(--radius)] border bg-background/85 pr-2 pl-[18px] backdrop-blur-md">
        <Link
          to="/"
          aria-label="CM League, ir al inicio"
          className={`flex shrink-0 items-center rounded-lg ${focusRing}`}
        >
          <span className="flex min-[400px]:hidden">
            <BrandMark className="size-7" />
          </span>
          <span className="hidden min-[400px]:flex">
            <BrandLockup className="h-7" />
          </span>
        </Link>
        <span aria-hidden className="ml-auto" />
        <ThemeToggle />
        <Link
          to="/"
          className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors hover:bg-accent ${focusRing}`}
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
          Volver
        </Link>
      </div>
    </header>
  )
}

function SectionTitle({
  eyebrow,
  title,
  id,
}: {
  eyebrow: string
  title: string
  id?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        id={id}
        className="text-[clamp(26px,3vw,34px)] leading-tight font-bold tracking-[-0.8px] text-balance"
      >
        {title}
      </h2>
    </div>
  )
}

/** Página pública de descarga del launcher de escritorio. */
export function LauncherPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background leading-design text-foreground">
      <Header />

      <main className="flex flex-col">
        {/* Portada: texto y descarga a la izquierda, el dibujo de la ventana a la derecha. */}
        <section className="border-b">
          <div className="mx-auto grid w-full max-w-[1200px] items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1fr_minmax(0,560px)]">
            <div className="flex flex-col items-start gap-5">
              <span className="inline-flex h-7 items-center gap-2 rounded-full border bg-card px-3 text-xs font-medium">
                <GamepadIcon className="size-3.5 text-primary" aria-hidden />
                Para Windows 10 y 11
              </span>
              <h1 className="text-[clamp(38px,5vw,60px)] leading-[1.04] font-bold tracking-[-2px] text-balance">
                El launcher de <span className="text-primary">CMLeague</span>.
              </h1>
              <p className="max-w-[520px] text-[17px] leading-[1.55] text-pretty text-muted-foreground">
                La web de la liga en su propia ventana, con lo que el navegador
                no puede hacer: abrir ClientMod conectado a tu sala y avisarte
                cuando aparece la partida.
              </p>
              <DownloadButtons />
            </div>
            <div className="flex justify-center pb-6 lg:justify-end">
              <LauncherMockup />
            </div>
          </div>
        </section>

        <section
          className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-16 sm:px-6"
          aria-labelledby="que-hace"
        >
          <SectionTitle
            eyebrow="Qué hace"
            title="Todo lo de la web, y un poco más"
            id="que-hace"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card
                key={f.title}
                variant="outline"
                className="flex flex-col gap-2 p-5 [&_svg]:size-5 [&_svg]:text-primary"
              >
                {f.icon}
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="text-sm text-pretty text-muted-foreground">
                  {f.text}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <section
          className="border-y bg-muted/30"
          aria-labelledby="como-empezar"
        >
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-16 sm:px-6">
            <SectionTitle
              eyebrow="Cómo empezar"
              title="En cuatro pasos"
              id="como-empezar"
            />
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex flex-col gap-2">
                  {/* Número, título e ícono en una sola línea (Daniel, 2026-11-26). */}
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <h3 className="text-base font-semibold">{s.title}</h3>
                    <span className="text-primary [&_svg]:size-4" aria-hidden>
                      {s.icon}
                    </span>
                  </div>
                  <p className="text-sm text-pretty text-muted-foreground">
                    {s.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.4fr]"
          aria-labelledby="preguntas"
        >
          <div className="flex flex-col gap-4">
            <SectionTitle
              eyebrow="Preguntas"
              title="Lo que más nos preguntan"
              id="preguntas"
            />
            <p className="text-sm text-pretty text-muted-foreground">
              Cómo se usa, paso a paso, en{" "}
              <Link
                to="/help/$seccion/$tarea"
                params={{ seccion: "jugador", tarea: "launcher" }}
                className={link}
              >
                Ayuda
              </Link>{" "}
              (con sesión). Qué guarda en tu PC, en la{" "}
              <Link to="/privacidad" hash="navegador" className={link}>
                política de privacidad
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-col divide-y rounded-xl border">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary
                  className={`flex cursor-pointer items-center justify-between gap-4 rounded text-[15px] font-medium ${focusRing}`}
                >
                  {f.q}
                  <ChevronDownIcon
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="pt-3 text-sm leading-relaxed text-pretty text-muted-foreground">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start gap-5 px-4 py-16 sm:px-6">
            <h2 className="text-[clamp(26px,3vw,34px)] leading-tight font-bold tracking-[-0.8px]">
              Listo para jugar
            </h2>
            <DownloadButtons size="lg" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
