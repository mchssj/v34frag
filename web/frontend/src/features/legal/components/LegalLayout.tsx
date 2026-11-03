import { Link } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"
import type { ReactNode } from "react"

import { BrandLockup, BrandMark } from "@/components/brand/Brand"
import { Eyebrow } from "@/components/brand/SectionHeading"
import { SiteFooter } from "@/components/brand/SiteFooter"
import { ThemeToggle } from "@/components/brand/ThemeToggle"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { HELP_PAGES } from "../lib/pages"

export type LegalSection = { id: string; title: string; body: ReactNode }

const focusRing = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

// Estilo del texto legal: no hay plugin de tipografía, así que se fija acá para todas las secciones.
const prose =
  "flex flex-col gap-3 text-[15px] leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-foreground [&_em]:text-foreground [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5 [&_ul_ul]:mt-1.5"

/** Dato que falta completar antes de publicar (provincia, correo…). */
export function Pending({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-primary/10 px-1 font-semibold text-primary">
      {children}
    </span>
  )
}

/** Función que todavía no está disponible para los jugadores. */
export function Wip({ children = "En preparación" }: { children?: ReactNode }) {
  return (
    <Badge variant="soft" className="align-middle">
      {children}
    </Badge>
  )
}

/** Página de ayuda o legal: barra, título, menú entre páginas, índice y secciones numeradas. */
export function LegalLayout({
  eyebrow,
  title,
  updated,
  intro,
  sections,
}: {
  eyebrow: string
  title: string
  updated: string
  intro: ReactNode
  sections: LegalSection[]
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background leading-design text-foreground">
      <header className="sticky top-0 z-20 px-4 pt-3.5">
        <div className="mx-auto flex h-14 max-w-[1260px] items-center gap-3 rounded-[var(--radius)] border bg-background/85 pr-2 pl-[18px] shadow-[0_1px_2px_rgb(0_0_0/.04),0_8px_24px_-12px_rgb(0_0_0/.12)] backdrop-blur-md">
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

      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-4 pt-12 pb-20 sm:px-6">
        <div className="flex max-w-[760px] flex-col gap-3">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="text-[clamp(32px,4.4vw,48px)] leading-[1.05] font-bold tracking-[-1.4px] text-balance">
            {title}
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            Última actualización: {updated}
          </p>
          <div className={`${prose} mt-2`}>{intro}</div>
        </div>

        <div className="grid gap-10 min-[1000px]:grid-cols-[260px_1fr]">
          <aside className="flex flex-col gap-4 min-[1000px]:sticky min-[1000px]:top-24 min-[1000px]:self-start">
            <Card variant="outline" radius="tile" asChild className="p-1.5">
              <nav aria-label="Ayuda y legales">
                <ul className="flex flex-col gap-0.5">
                  {HELP_PAGES.map((p) => (
                    <li key={p.to}>
                      {/* El router marca la página actual con data-status="active". */}
                      <Link
                        to={p.to}
                        className={`flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground ${focusRing}`}
                      >
                        {p.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </Card>

            <nav
              aria-label="En esta página"
              className="hidden px-1.5 min-[1000px]:block"
            >
              <p className="mb-2 px-2 font-mono text-[11px] font-semibold tracking-[1px] text-muted-foreground uppercase">
                En esta página
              </p>
              <ol className="flex flex-col gap-0.5 text-[13px]">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className={`flex gap-2 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:text-foreground ${focusRing}`}
                    >
                      <span className="w-5 shrink-0 font-mono text-xs leading-5 text-primary">
                        {i + 1}
                      </span>
                      <span>{s.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <div className="flex max-w-[760px] min-w-0 flex-col gap-10">
            {sections.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                aria-labelledby={`${s.id}-titulo`}
                className="flex scroll-mt-24 flex-col gap-3"
              >
                <h2
                  id={`${s.id}-titulo`}
                  className="flex items-baseline gap-3 text-xl font-bold tracking-[-0.4px]"
                >
                  <span className="font-mono text-sm text-primary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.title}
                </h2>
                <div className={prose}>{s.body}</div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
