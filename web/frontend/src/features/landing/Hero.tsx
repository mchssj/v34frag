import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"

import heroAvif from "@/assets/landing-bg.avif"
import heroWebp from "@/assets/landing-bg.webp"
import { LiveDot } from "@/components/brand/LiveDot"
import { Button } from "@/components/ui/button"
import { SERVERS } from "@/config/site"
import { formatNumber, liveCountOptions } from "@/features/public/queries"
import { scrollToSection } from "./scroll"

const heroImage = `image-set(url("${heroAvif}") type("image/avif"), url("${heroWebp}") type("image/webp"))`
// Jugadores en los servidores: valor fijo hasta que la API exponga el estado en vivo.
const playersOnline = SERVERS.filter((s) => s.online).reduce(
  (sum, s) => sum + s.players,
  0
)

function LivePill() {
  const live = useQuery(liveCountOptions).data
  const parts = [
    live !== undefined &&
      `${formatNumber(live)} ${live === 1 ? "partida" : "partidas"} en vivo`,
    `${formatNumber(playersOnline)} jugadores en el servidor`,
  ].filter(Boolean)
  return (
    <span className="inline-flex h-7 items-center gap-2 rounded-full border bg-card pr-3 pl-2.5 text-xs font-medium">
      <LiveDot />
      {parts.join(" · ")}
    </span>
  )
}

export function Hero() {
  return (
    <section className="relative flex min-h-[calc(88svh-70px)] items-center overflow-hidden border-b">
      {/* Imagen con filtros distintos en claro y oscuro, y degradado para leer el texto. */}
      <div
        aria-hidden
        style={{ backgroundImage: heroImage }}
        className="pointer-events-none absolute inset-0 bg-cover bg-right bg-no-repeat opacity-35 mix-blend-multiply contrast-[1.15] dark:opacity-20 dark:mix-blend-screen dark:contrast-[1.2] dark:invert"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,var(--background)_0%,var(--background)_32%,transparent_70%)]"
      />
      <div className="relative mx-auto flex w-full max-w-[1200px] flex-col items-start gap-6 px-6 py-24">
        <LivePill />
        <h1 className="max-w-[720px] text-[clamp(40px,5.4vw,64px)] leading-[1.04] font-bold tracking-[-2px] text-balance">
          La liga competitiva de{" "}
          <span className="text-primary">Counter-Strike: Source</span>.
        </h1>
        <p className="max-w-[540px] text-[17px] leading-[1.55] text-pretty text-muted-foreground">
          Juega mixes en nuestros servidores y tu ELO se actualiza solo. Arma tu
          equipo, busca prácticas y compite en torneos con veto y reporte de
          resultados desde la web.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="xl">
            <Link to="/register" search={{}}>
              Crear cuenta gratis
              <ArrowRightIcon className="size-[15px]" aria-hidden />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="xl"
            onClick={() => scrollToSection("como-funciona")}
          >
            Cómo funciona
            <ArrowRightIcon className="size-[15px]" aria-hidden />
          </Button>
        </div>
      </div>
    </section>
  )
}
