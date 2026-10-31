import { cn } from "cn"
import { useState } from "react"

/**
 * Escudo del equipo: el logo si tiene; si no (o si no carga), la sigla o las iniciales sobre
 * `foreground`.
 */
export function TeamCrest({
  team,
  size = "md",
  className,
}: {
  team: { name: string; tag: string | null; logo_url?: string | null }
  size?: "xs" | "row" | "sm" | "md" | "lg" | "xl"
  className?: string
}) {
  // La URL que falló: si el equipo cambia de logo, la nueva se vuelve a intentar.
  const [failed, setFailed] = useState<string | null>(null)
  const logo = team.logo_url && team.logo_url !== failed ? team.logo_url : null
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden font-mono font-bold",
        logo ? "border bg-card" : "bg-foreground text-background",
        {
          xs: "size-6 rounded-[5px] text-[9px]",
          row: "size-8 rounded-md text-[10px]",
          sm: "size-11 rounded-md text-xs",
          md: "size-14 rounded-lg text-sm",
          // En teléfono el escudo achica para que entre el nombre.
          lg: "size-16 rounded-[14px] text-xl tracking-[-0.5px] shadow-[0_4px_0_var(--primary)] sm:size-[104px] sm:rounded-[18px] sm:text-3xl sm:tracking-[-1px] sm:shadow-[0_5px_0_var(--primary)]",
          xl: "size-[120px] rounded-[20px] text-4xl tracking-[-1px] shadow-[0_5px_0_var(--primary)]",
        }[size],
        className
      )}
    >
      {logo ? (
        <img
          src={logo}
          alt=""
          onError={() => setFailed(logo)}
          className="size-full object-cover"
        />
      ) : (
        crestText(team)
      )}
    </span>
  )
}

/** Lo que va en el escudo: la sigla o, si no tiene, las iniciales del nombre (hasta 3). */
export function crestText(team: { name: string; tag: string | null }) {
  const tag = team.tag?.trim()
  if (tag) return tag.toUpperCase().slice(0, 4)
  const words = team.name.trim().split(/\s+/).filter(Boolean)
  const initials =
    words.length > 1
      ? words.map((w) => w[0]).join("")
      : (words[0] ?? "?").slice(0, 3)
  return initials.toUpperCase().slice(0, 3)
}
