import { cn } from "cn"

import "./cosmeticos.css"
import { COSMETICS_BASE, type ShopItem } from "./types"

// Piezas para dibujar los cosméticos: avatar con marco, nombre con efecto y stickers.

export function FramedAvatar({
  src,
  alias,
  frame,
  size,
}: {
  src?: string | null
  alias: string
  frame?: ShopItem | null
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
  if (!frame?.file)
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
        src={COSMETICS_BASE + frame.file}
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
  effect?: ShopItem | null
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
