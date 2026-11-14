import { cn } from "cn"
import { useState, type CSSProperties, type ReactNode } from "react"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { initialOf } from "@/components/brand/initial"

import { usePlayerAvatar } from "./avatars"
import "./cosmeticos.css"
import {
  COSMETICS_BASE,
  fileUrl,
  posterUrl,
  type Drawable,
  type Media as MediaFields,
} from "./types"

// Piezas para dibujar los cosméticos (prototipo de Kyan, kyan/ejemplo-matchmaking): avatar con marco,
// nombre con efecto, stickers y fondo de miniperfil. Los archivos están en public/cosmetics/.

type Media = Partial<MediaFields> | null | undefined

/**
 * El avatar animado de la tienda (bitácora 2026-11-12-avatares-animados): el .webm en bucle, mudo, con su .webp de
 * póster. `animate={false}` muestra solo la imagen fija (las filas) y la anima al pasar el mouse.
 */
export function AvatarMedia({
  avatar,
  animate = true,
  className,
  style,
}: {
  avatar: NonNullable<Media>
  animate?: boolean
  className?: string
  style?: CSSProperties
}) {
  const [hover, setHover] = useState(false)
  const src = fileUrl(avatar) ?? undefined
  // Los avatares de Kyan son SVG (los VIP, animados por dentro): se muestran como imagen, sin póster.
  if (!isVideo(src))
    return (
      <span className={cn("block overflow-hidden", className)} style={style}>
        <img
          className="size-full object-cover"
          src={src}
          alt=""
          loading="lazy"
        />
      </span>
    )
  const poster = posterUrl(avatar) ?? undefined
  const play = animate || hover
  return (
    <span
      className={cn("block overflow-hidden", className)}
      style={style}
      onMouseEnter={animate ? undefined : () => setHover(true)}
      onMouseLeave={animate ? undefined : () => setHover(false)}
    >
      {play ? (
        <video
          className="size-full object-cover"
          src={src}
          poster={poster}
          autoPlay
          loop
          muted
          playsInline
          disablePictureInPicture
          aria-hidden
        />
      ) : (
        <img
          className="size-full object-cover"
          src={poster}
          alt=""
          loading="lazy"
        />
      )}
    </span>
  )
}

/** La foto (o el avatar animado, si tiene uno puesto) y, si hay, el marco encima. */
export function FramedAvatar({
  src,
  alias,
  frame,
  avatar,
  animate = true,
  size,
  className,
}: {
  src?: string | null
  alias: string
  frame?: Media
  avatar?: Media
  animate?: boolean
  size: number
  className?: string
}) {
  const inner =
    avatar && fileUrl(avatar) ? (
      <AvatarMedia avatar={avatar} animate={animate} className="size-full" />
    ) : src ? (
      <img className="size-full object-cover" src={src} alt="" />
    ) : (
      <div
        className="grid size-full place-items-center bg-muted font-bold text-muted-foreground"
        style={{ fontSize: size * 0.3 }}
      >
        {initialOf(alias)}
      </div>
    )
  const marco = fileUrl(frame)
  if (!marco)
    return (
      <div
        className={cn("relative shrink-0", className)}
        style={{ width: size, height: size }}
      >
        <div className="absolute inset-[12.5%] overflow-hidden rounded-[8%]">
          {inner}
        </div>
      </div>
    )
  return (
    <div
      className={cn("avf", className)}
      style={{ ["--avf" as string]: `${size}px` }}
    >
      <div className="avf-img overflow-hidden">{inner}</div>
      <img className="avf-marco" src={marco} alt="" loading="lazy" />
    </div>
  )
}

/**
 * Dentro de un `<Avatar>` que no usa `PlayerAvatar`: el avatar puesto de la ficha, con el redondeo del contenedor, o
 * `children` (la foto de siempre) si no tiene. `animate`: en las fotos de 48 px o más (bitácora
 * 2026-11-14-avatar-en-toda-la-web).
 */
export function EquippedAvatar({
  playerId,
  animate = false,
  className,
  children,
}: {
  playerId?: string | null
  animate?: boolean
  className?: string
  children?: ReactNode
}) {
  const avatar = usePlayerAvatar(playerId)
  if (!avatar) return <>{children}</>
  return (
    <AvatarMedia
      avatar={avatar}
      animate={animate}
      className={cn("size-full rounded-[inherit]", className)}
    />
  )
}

/** En una fila (ranking, sala): el avatar animado quieto, del tamaño de la foto; se anima al pasar el mouse. */
export function AvatarThumb({
  avatar,
  size,
  className,
}: {
  avatar: NonNullable<Media>
  size: number
  className?: string
}) {
  return (
    <AvatarMedia
      avatar={avatar}
      animate={false}
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
    />
  )
}

/** El nombre con su efecto. Los efectos que usan ::before y ::after leen data-nombre. */
export function NameFx({
  text,
  effect,
  className,
}: {
  text: string
  effect?: Pick<Drawable, "css_class"> | null
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
  items: Drawable[]
  size: number
  className?: string
}) {
  if (!items.length) return null
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {items.map((s) => (
        <img
          key={s.id}
          src={fileUrl(s) ?? ""}
          alt={s.name}
          title={s.name}
          loading="lazy"
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  )
}

/** La medalla VIP de CM League. Toma la altura del texto de al lado. */
export function VipBadge({ className }: { className?: string }) {
  return (
    <img
      src={COSMETICS_BASE + "insignias/vip.svg"}
      alt="VIP"
      title="VIP"
      className={cn(
        "inline-block h-[1.6em] w-auto shrink-0 drop-shadow",
        className
      )}
    />
  )
}

/** Un archivo de video (lo animado propio y los avatares viejos): WebM. */
export const isVideo = (src?: string | null) =>
  !!src && /\.webm(\?|$)/.test(src)

/**
 * El fondo de miniperfil detrás de una tarjeta. La tarjeta tiene que tener `isolate` y `overflow-hidden`. El fondo
 * animado propio es un WebM en bucle, mudo, con su imagen fija mientras carga.
 */
export function CardBackground({
  src,
  poster,
}: {
  src?: string | null
  poster?: string | null
}) {
  if (!src) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {isVideo(src) ? (
        <video
          className="size-full object-cover"
          src={src}
          poster={poster ?? undefined}
          autoPlay
          loop
          muted
          playsInline
          disablePictureInPicture
        />
      ) : (
        <img src={src} alt="" className="size-full object-cover" />
      )}
      {/* Oscurece abajo, donde van el nick y el nivel, para que se lean con cualquier fondo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
    </div>
  )
}

/** La proporción del fondo de miniperfil: la de la tarjeta del grupo en Jugar, en la computadora (1:2, vertical). */
export const MINI_CARD_ASPECT = 1 / 2

/**
 * La tarjeta del jugador en el grupo de Jugar (miniperfil), con la misma forma: vertical (1:2), con el fondo de
 * miniperfil, el avatar con marco, el nombre con efecto y el nivel. `size` "sm" es la miniatura del catálogo (solo el
 * avatar). `sub` va debajo, fuera de la tarjeta.
 */
export function MiniCard({
  alias,
  photo,
  frame,
  avatarItem,
  name,
  background,
  level,
  sub,
  size = "md",
  className,
}: {
  alias: string
  photo?: string | null
  frame?: Media
  /** El avatar animado de la tienda o el propio. */
  avatarItem?: Media
  name?: Pick<Drawable, "css_class"> | null
  background?: Media
  level: number | null
  sub?: ReactNode
  size?: "sm" | "md"
  className?: string
}) {
  const bg = fileUrl(background)
  const sm = size === "sm"
  const card = (
    <div
      className={cn(
        "relative isolate flex aspect-[1/2] shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border",
        sm ? "w-[70px] gap-1 p-1.5" : "w-[132px] gap-2.5 p-2.5",
        bg ? "border-white/15 text-white" : "bg-card",
        !sub && className
      )}
    >
      <CardBackground src={bg} poster={posterUrl(background)} />
      <FramedAvatar
        alias={alias}
        src={photo}
        frame={frame}
        avatar={avatarItem}
        size={sm ? 44 : 76}
      />
      {!sm && (
        <>
          <NameFx
            text={alias}
            effect={name}
            className="max-w-full truncate text-sm font-semibold"
          />
          {level !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-background/40 px-2 py-1 font-mono text-xs font-semibold tabular-nums">
              <LevelBadge level={level} size={20} />
              Nivel {level}
            </span>
          )}
        </>
      )}
    </div>
  )
  if (!sub) return card
  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      {card}
      <span className="text-[11px] text-muted-foreground">{sub}</span>
    </div>
  )
}
