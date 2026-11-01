import type { ReactNode } from "react"

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
      {children}
    </span>
  )
}

/** Eyebrow + H2 de las secciones de la landing; `aside` va a la derecha. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  aside,
  narrow = false,
}: {
  id?: string
  /** Limita el título a 560px (solo "Cómo funciona" en el handoff). */
  narrow?: boolean
  eyebrow: string
  title: string
  aside?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div
        className={
          narrow
            ? "flex max-w-[560px] flex-col gap-2.5"
            : "flex flex-col gap-2.5"
        }
      >
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2
          id={id}
          className="text-[clamp(28px,3.4vw,40px)] leading-[1.1] font-bold tracking-[-1.2px] text-balance"
        >
          {title}
        </h2>
      </div>
      {aside}
    </div>
  )
}
