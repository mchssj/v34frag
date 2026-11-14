import { cn } from "cn"
import type { ReactNode } from "react"

import { initialOf } from "@/components/brand/initial"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  AvatarThumb,
  FramedAvatar,
  MiniCard,
  NameFx,
  Stickers,
  VipBadge,
} from "./cosmetics"
import {
  COLLECTIONS,
  KINDS,
  fileUrl,
  posterUrl,
  type Drawable,
  type Equipped,
  type ItemKind,
  type ShopItem,
} from "./types"

// Vista previa de un artículo en una ventana (bitácora 2026-11-13-avatar-y-fondo-propios): el artículo grande y cómo
// queda en el perfil, en el lobby y en las filas. La usan la Tienda y Administración › Tienda.

export type PreviewItem = Drawable &
  Pick<ShopItem, "description" | "collection" | "animated" | "vip_only">

const NOTHING: Equipped = {
  frame: null,
  avatar: null,
  background: null,
  theme: null,
  name: null,
  stickers: [],
}

const WHERE: Record<PreviewItem["kind"], string> = {
  frame:
    "Va alrededor de tu foto en tu perfil y en tu tarjeta del lobby. En las filas del ranking y de la sala no se ve.",
  avatar:
    "Reemplaza tu foto en tu perfil, en el lobby y en las filas. En las filas se ve quieto y se mueve al pasar el mouse.",
  sticker: "Se ve debajo de tu nombre en tu perfil. Puedes ponerte hasta 3.",
  theme:
    "Cambia los colores de toda tu página de jugador: la tarjeta, el nivel, el gráfico de ELO, las estadísticas y las pestañas.",
  name: "Se ve en tu nombre en tu perfil, en el lobby, en el ranking, en la sala y en los amigos.",
  background: "Se ve detrás de tu tarjeta en el lobby de Jugar.",
}

/** El artículo solo y grande. */
function Art({
  item,
  alias,
  photo,
}: {
  item: PreviewItem
  alias: string
  photo: string | null
}) {
  return (
    <div className="grid h-[220px] place-items-center overflow-hidden rounded-lg border bg-muted/40 bg-[radial-gradient(120%_90%_at_50%_0%,color-mix(in_oklch,var(--foreground)_7%,transparent),transparent_70%)]">
      {item.kind === "frame" && (
        <FramedAvatar alias={alias} src={photo} frame={item} size={180} />
      )}
      {item.kind === "avatar" && (
        <FramedAvatar alias={alias} src={photo} avatar={item} size={180} />
      )}
      {item.kind === "sticker" && (
        <img src={fileUrl(item) ?? ""} alt="" className="size-40" />
      )}
      {item.kind === "theme" && (
        <div
          className={cn("w-4/5 rounded-lg border bg-card p-4", item.css_class)}
        >
          <b className="text-primary">Perfil</b>
          <small className="block text-xs text-muted-foreground">
            Así se ve el color
          </small>
          <i className="mt-3 block h-2 rounded bg-primary" />
        </div>
      )}
      {item.kind === "name" && (
        <NameFx
          text={alias}
          effect={item}
          className="text-4xl font-black text-primary"
        />
      )}
      {item.kind === "background" && (
        <img
          src={fileUrl(item) ?? ""}
          alt=""
          className="size-full object-cover"
        />
      )}
    </div>
  )
}

function Block({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <span className="text-[11px] font-semibold tracking-[.04em] text-muted-foreground uppercase">
        {title}
      </span>
      {children}
    </div>
  )
}

/**
 * La ventana. `base` es lo que la cuenta ya tiene puesto (el artículo se ve encima); `pick` resuelve sus ids.
 * `price` y `actions` van abajo: la Tienda pone comprar o equipar, y el admin nada.
 */
export function ItemPreviewDialog({
  item,
  onClose,
  alias,
  photo,
  level,
  vip = false,
  base = NOTHING,
  pick = () => null,
  price,
  actions,
}: {
  item: PreviewItem | null
  onClose: () => void
  alias: string
  photo: string | null
  level: number | null
  vip?: boolean
  base?: Equipped
  /** `kind` distingue lo propio (`custom`): el avatar o el fondo. */
  pick?: (id: string | null, kind?: ItemKind) => Drawable | null
  price?: ReactNode
  actions?: ReactNode
}) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      {item && (
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <Body
            item={item}
            alias={alias}
            photo={photo}
            level={level}
            vip={vip}
            base={base}
            pick={pick}
          />
          {(price || actions) && (
            <DialogFooter className="items-center sm:justify-between">
              <div>{price}</div>
              <div className="flex gap-2">{actions}</div>
            </DialogFooter>
          )}
        </DialogContent>
      )}
    </Dialog>
  )
}

function Body({
  item,
  alias,
  photo,
  level,
  vip,
  base,
  pick,
}: {
  item: PreviewItem
  alias: string
  photo: string | null
  level: number | null
  vip: boolean
  base: Equipped
  pick: (id: string | null, kind?: ItemKind) => Drawable | null
}) {
  // Lo puesto, con el artículo encima (un sticker se suma a los que ya hay, hasta 3).
  const look: Equipped =
    item.kind === "sticker"
      ? {
          ...base,
          stickers: [
            ...base.stickers.filter((s) => s !== item.id),
            item.id,
          ].slice(-3),
        }
      : { ...base, [item.kind]: item.id }
  const get = (id: string | null, kind?: ItemKind) =>
    id === item.id ? item : pick(id, kind)
  const frame = get(look.frame)
  const avatar = get(look.avatar, "avatar")
  const name = get(look.name)
  const theme = get(look.theme)
  const stickers = look.stickers
    .map((s) => get(s))
    .filter((s): s is Drawable => !!s)
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {item.name}
          {item.vip_only && <VipBadge className="h-6" />}
        </DialogTitle>
        <DialogDescription>
          {KINDS[item.kind]} · {COLLECTIONS[item.collection] ?? item.collection}
          {item.animated ? " · Animado" : ""}
          {item.description ? ` — ${item.description}` : ""}
        </DialogDescription>
      </DialogHeader>

      <Art item={item} alias={alias} photo={photo} />

      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{WHERE[item.kind]}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Block title="En tu perfil">
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-card p-3",
                theme?.css_class
              )}
            >
              <FramedAvatar
                alias={alias}
                src={photo}
                frame={frame}
                avatar={avatar}
                size={84}
              />
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-lg font-semibold text-primary">
                  <NameFx className="truncate" text={alias} effect={name} />
                  {vip && <VipBadge className="h-5" />}
                </div>
                <Stickers size={28} items={stickers} />
              </div>
            </div>
          </Block>
          <Block title="En el lobby de Jugar">
            <MiniCard
              alias={alias}
              photo={photo}
              level={level}
              frame={frame}
              avatarItem={avatar}
              name={name}
              background={get(look.background, "background")}
            />
          </Block>
        </div>
        <Block title="En el ranking y en la sala">
          <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
            <span className="w-6 font-mono text-xs text-muted-foreground tabular-nums">
              #1
            </span>
            {avatar && fileUrl(avatar) ? (
              <AvatarThumb avatar={avatar} size={30} className="rounded-full" />
            ) : photo ? (
              <img
                src={photo}
                alt=""
                className="size-[30px] shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                {initialOf(alias)}
              </span>
            )}
            <NameFx
              className="truncate font-semibold"
              text={alias}
              effect={name}
            />
            <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
              1.250 ELO
            </span>
          </div>
        </Block>
      </div>
    </>
  )
}

/** Miniatura cuadrada de un artículo, para las listas (Administración › Tienda). */
export function ItemThumb({
  item,
  size = 44,
}: {
  item: PreviewItem
  size?: number
}) {
  const src = item.kind === "avatar" ? posterUrl(item) : fileUrl(item)
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-md border bg-muted/50",
        item.kind === "theme" && item.css_class
      )}
      style={{ width: size, height: size }}
    >
      {item.kind === "name" ? (
        <NameFx
          text="Aa"
          effect={item}
          className="text-base font-black text-primary"
        />
      ) : item.kind === "theme" ? (
        <i className="block size-1/2 rounded-full bg-primary" />
      ) : src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      ) : null}
    </span>
  )
}
