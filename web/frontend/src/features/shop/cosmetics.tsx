import { cn } from "cn"
import type { ReactNode } from "react"

import { LevelBadge } from "@/components/brand/LevelBadge"

import "./cosmeticos.css"
import { COSMETICS_BASE, type ShopItem } from "./types"

// Piezas para dibujar los cosméticos: avatar con marco, nombre con efecto, stickers y fondo de miniperfil.

export function FramedAvatar({
  src,
  alias,
  frame,
  frameSrc,
  size,
}: {
  src?: string | null
  alias: string
  frame?: ShopItem | null
  /** URL del marco, para quien ya lo tiene resuelto (el matchmaking). Gana sobre frame. */
  frameSrc?: string | null
  size: number
}) {
  const initials = alias.replace(/^v34\|/, "").slice(0, 2).toUpperCase()
  const inner = src ? (
    <img className="avf-img" src={src} alt="" />
  ) : (
    <div
      className="avf-img grid place-items-center bg-muted font-bold text-muted-foreground"
      style={{ fontSize: size * 0.26 }}
    >
      {initials}
    </div>
  )
  const marco = frameSrc ?? (frame?.file ? COSMETICS_BASE + frame.file : null)
  if (!marco)
    return (
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
      >
        <div className="absolute inset-[12.5%] overflow-hidden rounded-[8%]">
          {src ? (
            <img className="size-full object-cover" src={src} alt="" />
          ) : (
            <div
              className="grid size-full place-items-center bg-muted font-bold text-muted-foreground"
              style={{ fontSize: size * 0.26 }}
            >
              {initials}
            </div>
          )}
        </div>
      </div>
    )
  return (
    <div className="avf" style={{ ["--avf" as string]: `${size}px` }}>
      {inner}
      <img
        className="avf-marco"
        src={marco}
        alt=""
        loading="lazy"
      />
    </div>
  )
}

export function NameFx({
  text,
  effect,
  className,
}: {
  text: string
  effect?: Pick<ShopItem, "css_class"> | null
  className?: string
}) {
  return (
    <span className={cn(effect?.css_class, className)} data-nombre={text}>
      {text}
    </span>
  )
}

export function Stickers({
  items,
  size,
  className,
}: {
  items: ShopItem[]
  size: number
  className?: string
}) {
  if (!items.length) return null
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {items.map((s) => (
        <img
          key={s.id}
          src={COSMETICS_BASE + (s.file ?? "")}
          alt={s.name}
          title={s.name}
          loading="lazy"
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  )
}

export function VipBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-gradient-to-r from-[#f7d76a] to-[#c8952a] px-1.5 py-px text-[10px] font-black tracking-[1px] text-[#1b1407]",
        className,
      )}
    >
      VIP
    </span>
  )
}

/** El fondo de miniperfil detrás de una tarjeta. La tarjeta tiene que tener `isolate` y `overflow-hidden`. */
export function CardBackground({ src }: { src?: string | null }) {
  if (!src) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <img src={src} alt="" className="size-full object-cover" />
      {/* Oscurece abajo, donde van el nick y el nivel, para que se lean con cualquier fondo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
    </div>
  )
}

/** La tarjeta chica del jugador (miniperfil): fondo, avatar con marco, nombre con efecto y nivel. */
export function MiniCard({
  alias,
  frame,
  name,
  background,
  level,
  sub,
  avatar = 104,
  className,
}: {
  alias: string
  frame?: ShopItem | null
  name?: ShopItem | null
  background?: ShopItem | null
  level: number
  sub?: ReactNode
  avatar?: number
  className?: string
}) {
  const bg = background?.file ? COSMETICS_BASE + background.file : null
  return (
    <div
      className={cn(
        "relative isolate flex h-[124px] w-full max-w-[340px] items-center gap-3 overflow-hidden rounded-xl border p-2 pr-4",
        bg ? "border-white/15 text-white" : "bg-card",
        className,
      )}
    >
      <CardBackground src={bg} />
      <FramedAvatar alias={alias} frame={frame} size={avatar} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <NameFx text={alias} effect={name} className="truncate text-lg font-black" />
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <LevelBadge level={level} size={20} className="rounded-full" />
          Nivel {level}
        </span>
        {sub && <span className="text-[11px] opacity-75">{sub}</span>}
      </div>
    </div>
  )
}
