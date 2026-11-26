import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  BellRingIcon,
  DownloadIcon,
  MonitorIcon,
  PlayIcon,
  SettingsIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import { BrandLockup, BrandMark } from "@/components/brand/Brand"
import { Eyebrow } from "@/components/brand/SectionHeading"
import { SiteFooter } from "@/components/brand/SiteFooter"
import { ThemeToggle } from "@/components/brand/ThemeToggle"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { LAUNCHER } from "@/config/site"
import { inLauncher } from "@/lib/launcher"
import { fetchLatestLauncher } from "../lib/latest"

const focusRing = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <PlayIcon aria-hidden />,
    title: "Entra al servidor con un clic",
    text: "Conectar abre ClientMod ya conectado a tu sala, sin copiar la IP ni la contraseña.",
  },
  {
    icon: <BellRingIcon aria-hidden />,
    title: "Te avisa aunque estés en otra cosa",
    text: "Aviso de Windows y la ventana al frente cuando aparece la partida. Puedes aceptar desde la bandeja.",
  },
  {
    icon: <MonitorIcon aria-hidden />,
    title: "La misma web, en su ventana",
    text: "Tu cuenta, tu perfil y el matchmaking, como en el navegador. Cerrarlo lo deja en la bandeja y sigues en la cola.",
  },
  {
    icon: <SettingsIcon aria-hidden />,
    title: "Configuración propia",
    text: "Abrir con Windows, avisos, tu estado en Discord y el tema de tu perfil. No cambia la web.",
  },
]

/** Página pública de descarga del launcher de escritorio. */
export function LauncherPage() {
  const latest = useQuery({
    queryKey: ["launcher", "latest"],
    queryFn: ({ signal }) => fetchLatestLauncher(signal),
    staleTime: 5 * 60_000,
  })
  const release = latest.data ?? null

  return (
    <div className="flex min-h-svh flex-col bg-background leading-design text-foreground">
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

      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-10 px-4 pt-12 pb-20 sm:px-6">
        <div className="flex max-w-[760px] flex-col gap-4">
          <Eyebrow>Para Windows</Eyebrow>
          <h1 className="text-[clamp(32px,4.4vw,48px)] leading-[1.05] font-bold tracking-[-1.4px] text-balance">
            El launcher de CMLeague
          </h1>
          <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">
            La web de la liga en su propia ventana, con lo que el navegador no
            puede hacer: abrir ClientMod conectado a tu sala y avisarte cuando
            aparece la partida.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {inLauncher() ? (
              <p className="text-sm font-medium text-primary">
                Ya lo estás usando.
              </p>
            ) : release ? (
              <>
                <a
                  href={release.url}
                  className={buttonVariants({ size: "lg" })}
                >
                  <DownloadIcon aria-hidden />
                  Descargar para Windows
                </a>
                <a
                  href={LAUNCHER.openUrl}
                  className={buttonVariants({ size: "lg", variant: "outline" })}
                >
                  Ya lo tengo: abrirlo
                </a>
                <span className="font-mono text-xs text-muted-foreground">
                  Versión {release.version}
                </span>
              </>
            ) : latest.isPending ? (
              <span className="text-sm text-muted-foreground">Cargando…</span>
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavía no está publicado. Lo anunciamos en el Discord.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Card
              key={f.title}
              variant="outline"
              className="flex flex-col gap-2 p-5 [&_svg]:size-5 [&_svg]:text-primary"
            >
              {f.icon}
              <h2 className="text-base font-semibold">{f.title}</h2>
              <p className="text-sm text-muted-foreground">{f.text}</p>
            </Card>
          ))}
        </div>

        <div className="flex max-w-[760px] flex-col gap-2 text-sm text-muted-foreground">
          <h2 className="text-base font-semibold text-foreground">
            Antes de instalarlo
          </h2>
          <p>
            Necesitas ClientMod instalado (el launcher lo abre, no lo
            reemplaza). Windows puede mostrar «Windows protegió su PC» al
            instalarlo: elige <strong>Más información</strong> y{" "}
            <strong>Ejecutar de todas formas</strong>. Al entrar a una sala,
            Windows te pide permiso para abrir ClientMod, igual que cuando lo
            abres a mano.
          </p>
          <p>
            Cómo se usa, paso a paso, en{" "}
            <Link
              to="/help/$seccion/$tarea"
              params={{ seccion: "jugador", tarea: "launcher" }}
              className="text-primary underline underline-offset-2"
            >
              Ayuda
            </Link>{" "}
            (con sesión). Qué guarda en tu PC, en la{" "}
            <Link
              to="/privacidad"
              hash="navegador"
              className="text-primary underline underline-offset-2"
            >
              política de privacidad
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
